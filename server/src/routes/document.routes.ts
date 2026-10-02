import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { env } from '../config/env';
import { DocumentModel } from '../models/Document';
import { AuthenticatedRequest, authenticateJWT } from '../middleware/auth';
import { requireWorkspaceMember } from '../middleware/workspaceAccess';
import { AppError } from '../middleware/errorHandler';
import { aiServiceClient } from '../services/aiServiceClient';

const router = Router();

// Ensure upload directory exists
if (!fs.existsSync(env.UPLOAD_DIR)) {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, env.UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.pdf', '.txt', '.md'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new AppError(`Unsupported file format '${ext}'. Allowed: .pdf, .txt, .md`, 400, 'INVALID_FILE_TYPE'));
    }
  },
});

// GET /api/v1/workspaces/:id/documents - List documents in workspace
router.get(
  '/:id/documents',
  authenticateJWT,
  requireWorkspaceMember,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const documents = await DocumentModel.find({
        workspaceId: req.workspaceId,
      }).sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        data: documents.map((d) => ({
          id: d._id,
          title: d.title,
          originalName: d.originalName,
          mimeType: d.mimeType,
          sizeBytes: d.sizeBytes,
          chunksCount: d.chunksCount,
          charactersCount: d.charactersCount,
          status: d.status,
          errorMessage: d.errorMessage,
          createdAt: d.createdAt,
        })),
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/workspaces/:id/documents - Upload and ingest document
router.post(
  '/:id/documents',
  authenticateJWT,
  requireWorkspaceMember,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    let savedDoc: any = null;
    let filePath: string | null = null;

    try {
      if (!req.file) {
        throw new AppError('File upload is required (multipart/form-data with field "file").', 400, 'FILE_REQUIRED');
      }

      filePath = req.file.path;
      const title = req.body.title?.trim() || req.file.originalname;

      // Create Document in MongoDB with processing status
      savedDoc = await DocumentModel.create({
        workspaceId: req.workspaceId,
        title,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        status: 'processing',
        uploadedBy: req.user!._id,
      });

      // Stream to AI Service for chunking, embedding, and vector storage
      try {
        const aiResponse = await aiServiceClient.ingestDocument(
          req.workspaceId!,
          savedDoc._id.toString(),
          filePath,
          req.file.originalname
        );

        savedDoc.status = 'indexed';
        savedDoc.chunksCount = aiResponse.chunks_count;
        savedDoc.charactersCount = aiResponse.characters_count;
        await savedDoc.save();
      } catch (aiErr: any) {
        savedDoc.status = 'failed';
        savedDoc.errorMessage = aiErr.message || 'AI embedding indexing failed';
        await savedDoc.save();
        throw aiErr;
      }

      res.status(201).json({
        success: true,
        data: {
          id: savedDoc._id,
          title: savedDoc.title,
          originalName: savedDoc.originalName,
          mimeType: savedDoc.mimeType,
          sizeBytes: savedDoc.sizeBytes,
          chunksCount: savedDoc.chunksCount,
          charactersCount: savedDoc.charactersCount,
          status: savedDoc.status,
          createdAt: savedDoc.createdAt,
        },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/workspaces/:id/documents/:docId - Delete document
router.delete(
  '/:id/documents/:docId',
  authenticateJWT,
  requireWorkspaceMember,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const doc = await DocumentModel.findOne({
        _id: req.params.docId,
        workspaceId: req.workspaceId,
      });

      if (!doc) {
        throw new AppError('Document not found in this workspace.', 404, 'NOT_FOUND');
      }

      // Remove from filesystem if exists
      const fullPath = path.join(env.UPLOAD_DIR, doc.filename);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (e) {
          console.warn(`Could not delete file ${fullPath}: ${e}`);
        }
      }

      await DocumentModel.findByIdAndDelete(doc._id);

      res.status(200).json({
        success: true,
        data: { message: 'Document deleted successfully.' },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
