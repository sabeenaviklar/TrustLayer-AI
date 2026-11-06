import io

import pytest
from fastapi import HTTPException
from pypdf import PdfWriter

from config import settings
from main import ingest_document, read_upload_with_limit
from pipeline.vector_store import vector_store
from pipeline.extractor import IngestionLimitError, extract_text_from_bytes


class FakeUpload:
    def __init__(self, payload: bytes, filename: str):
        self.payload = payload
        self.filename = filename
        self.offset = 0
        self.closed = False

    async def read(self, size: int = -1):
        if size < 0:
            size = len(self.payload) - self.offset
        chunk = self.payload[self.offset:self.offset + size]
        self.offset += len(chunk)
        return chunk

    async def close(self):
        self.closed = True


def make_pdf(page_count: int) -> bytes:
    output = io.BytesIO()
    writer = PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=72, height=72)
    writer.write(output)
    return output.getvalue()


@pytest.mark.asyncio
async def test_upload_reader_accepts_file_at_byte_limit():
    upload = FakeUpload(b"12345", "exact.txt")

    assert await read_upload_with_limit(upload, 5) == b"12345"


@pytest.mark.asyncio
async def test_upload_reader_rejects_file_above_byte_limit():
    upload = FakeUpload(b"123456", "large.txt")

    with pytest.raises(HTTPException) as error:
        await read_upload_with_limit(upload, 5)

    assert error.value.status_code == 413
    # The reader stops after one byte beyond the configured limit.
    assert upload.offset == 6


def test_extractor_rejects_pdf_above_page_limit():
    payload = make_pdf(3)

    with pytest.raises(IngestionLimitError, match="maximum is 2"):
        extract_text_from_bytes(payload, "many-pages.pdf", max_pdf_pages=2)


def test_extractor_rejects_text_above_character_limit():
    with pytest.raises(IngestionLimitError, match="limit of 5 characters"):
        extract_text_from_bytes(
            b"123456",
            "too-long.txt",
            max_extracted_chars=5,
        )


@pytest.mark.asyncio
async def test_oversized_upload_never_reaches_vector_indexing(monkeypatch):
    monkeypatch.setattr(settings, "max_upload_size_mb", 1)
    indexed = []
    monkeypatch.setattr(
        vector_store,
        "add_chunks",
        lambda **kwargs: indexed.append(kwargs),
    )
    upload = FakeUpload(b"x" * (1024 * 1024 + 1), "large.txt")

    with pytest.raises(HTTPException) as error:
        await ingest_document(upload, "workspace-1", "document-1")

    assert error.value.status_code == 413
    assert indexed == []
    assert upload.closed is True


@pytest.mark.asyncio
async def test_pdf_page_limit_never_reaches_vector_indexing(monkeypatch):
    monkeypatch.setattr(settings, "max_upload_size_mb", 1)
    monkeypatch.setattr(settings, "max_pdf_pages", 2)
    indexed = []
    monkeypatch.setattr(
        vector_store,
        "add_chunks",
        lambda **kwargs: indexed.append(kwargs),
    )
    upload = FakeUpload(make_pdf(3), "too-many-pages.pdf")

    with pytest.raises(HTTPException) as error:
        await ingest_document(upload, "workspace-1", "document-2")

    assert error.value.status_code == 413
    assert indexed == []
    assert upload.closed is True


@pytest.mark.asyncio
async def test_extracted_text_limit_never_reaches_vector_indexing(monkeypatch):
    monkeypatch.setattr(settings, "max_upload_size_mb", 1)
    monkeypatch.setattr(settings, "max_extracted_chars", 5)
    indexed = []
    monkeypatch.setattr(
        vector_store,
        "add_chunks",
        lambda **kwargs: indexed.append(kwargs),
    )
    upload = FakeUpload(b"123456", "too-long.txt")

    with pytest.raises(HTTPException) as error:
        await ingest_document(upload, "workspace-1", "document-3")

    assert error.value.status_code == 413
    assert indexed == []
    assert upload.closed is True
