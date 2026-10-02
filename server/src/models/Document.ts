import mongoose, { Document as MongooseDoc, Schema } from 'mongoose';

export type DocumentStatus = 'processing' | 'indexed' | 'failed';

export interface IDocument extends MongooseDoc {
  _id: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  title: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  chunksCount: number;
  charactersCount: number;
  status: DocumentStatus;
  errorMessage?: string;
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    sizeBytes: {
      type: Number,
      required: true,
    },
    chunksCount: {
      type: Number,
      default: 0,
    },
    charactersCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['processing', 'indexed', 'failed'],
      default: 'processing',
      index: true,
    },
    errorMessage: {
      type: String,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const DocumentModel = mongoose.model<IDocument>('Document', DocumentSchema);
