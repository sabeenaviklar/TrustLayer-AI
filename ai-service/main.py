import os
import uuid
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from schemas import (
    ApiResponse,
    CheckRequest,
    CheckResultData,
    IngestResultData
)
from pipeline.extractor import extract_text_from_bytes
from pipeline.chunker import chunk_document
from pipeline.vector_store import vector_store
from pipeline.nli import nli_model
from pipeline.checker import check_hallucinations

# Structured logging configuration
logging.basicConfig(
    level=settings.log_level.upper(),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("trustlayer.ai_service")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes models and services on startup."""
    logger.info("Initializing TrustLayer AI Service...")
    logger.info(f"Target NLI Model: {settings.nli_model}")
    logger.info(f"ChromaDB Storage: {settings.chroma_persist_dir}")
    try:
        # Pre-load NLI model once at startup
        nli_model.load()
        logger.info("NLI Model successfully loaded into memory.")
    except Exception as e:
        logger.error(f"Failed to load NLI model at startup: {e}", exc_info=True)
        raise e

    yield

    logger.info("Shutting down TrustLayer AI Service...")

app = FastAPI(
    title="TrustLayer AI Scoring Service",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for internal and external network calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.exceptions import RequestValidationError

# Global error handler returning standard response shape
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_msg = exc.errors()[0].get("msg", "Validation error") if exc.errors() else "Invalid request data"
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "success": False,
            "data": None,
            "error": {
                "message": f"Request validation failed: {error_msg}",
                "code": "VALIDATION_ERROR",
                "details": exc.errors()
            }
        }
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error processing {request.method} {request.url}: {exc}", exc_info=True)
    message = str(exc) if settings.environment != "production" else "An internal server error occurred."
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "data": None,
            "error": {
                "message": message,
                "code": "INTERNAL_SERVER_ERROR"
            }
        }
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "data": None,
            "error": {
                "message": exc.detail,
                "code": f"HTTP_{exc.status_code}"
            }
        }
    )

@app.get("/health", response_model=ApiResponse)
async def health():
    """Healthcheck endpoint for Docker and monitoring."""
    return ApiResponse(
        success=True,
        data={
            "status": "healthy",
            "model": settings.nli_model,
            "device": nli_model.device,
            "model_loaded": nli_model.is_loaded,
            "environment": settings.environment
        },
        error=None
    )

@app.post("/ingest", response_model=ApiResponse)
async def ingest_document(
    file: UploadFile = File(..., description="PDF or TXT document"),
    workspace_id: str = Form(..., description="Workspace ID"),
    document_id: Optional[str] = Form(None, description="Optional document ID")
):
    """
    Ingests reference documents (PDF/TXT), chunks them, generates embeddings,
    and indexes them into the workspace's ChromaDB collection.
    """
    if not workspace_id or not workspace_id.strip():
        raise HTTPException(status_code=400, detail="workspace_id is required.")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file must have a filename.")

    doc_id = document_id.strip() if document_id and document_id.strip() else f"doc_{uuid.uuid4().hex[:12]}"
    filename = file.filename

    logger.info(f"Ingesting file '{filename}' for workspace '{workspace_id}' (DocID: {doc_id})")

    try:
        content_bytes = await file.read()
        if len(content_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        # Extract text from PDF or TXT
        text = extract_text_from_bytes(content_bytes, filename)
        if not text:
            raise HTTPException(status_code=400, detail="No readable text could be extracted from this document.")

        # Chunk text
        chunks = chunk_document(text, chunk_size=500, chunk_overlap=100)
        if not chunks:
            raise HTTPException(status_code=400, detail="Document could not be partitioned into text chunks.")

        # Store in ChromaDB
        added_count = vector_store.add_chunks(
            workspace_id=workspace_id,
            document_id=doc_id,
            filename=filename,
            chunks=chunks
        )

        return ApiResponse(
            success=True,
            data=IngestResultData(
                workspace_id=workspace_id,
                document_id=doc_id,
                filename=filename,
                chunks_count=added_count,
                characters_count=len(text)
            ).model_dump(),
            error=None
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error ingesting document '{filename}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to ingest document: {str(e)}")

@app.post("/check", response_model=ApiResponse)
async def check_answer(request: CheckRequest):
    """
    Validates an AI answer against ingested workspace documents.
    Scores each claim as SUPPORTED, CONTRADICTED, or UNVERIFIABLE,
    extracts the evidence sentence, and computes a 0-100 reliability score.
    """
    if not request.question.strip() or not request.answer.strip():
        raise HTTPException(status_code=400, detail="question and answer cannot be empty.")

    logger.info(f"Running hallucination check for workspace '{request.workspace_id}'")

    try:
        result: CheckResultData = check_hallucinations(
            question=request.question,
            answer=request.answer,
            workspace_id=request.workspace_id,
            regenerate=request.regenerate or False
        )

        return ApiResponse(
            success=True,
            data=result.model_dump(),
            error=None
        )
    except Exception as e:
        logger.error(f"Error executing check pipeline: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Check pipeline execution failed: {str(e)}")

@app.delete("/workspace/{workspace_id}", response_model=ApiResponse)
async def delete_workspace_index(workspace_id: str):
    """Clears all vector chunks indexed for a specific workspace."""
    try:
        vector_store.delete_workspace(workspace_id)
        return ApiResponse(
            success=True,
            data={"message": f"Successfully deleted knowledge index for workspace '{workspace_id}'"},
            error=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
