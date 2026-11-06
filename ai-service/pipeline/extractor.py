import io
import re
from typing import Optional

from pypdf import PdfReader


class IngestionLimitError(ValueError):
    """Raised when an upload exceeds a configured extraction resource limit."""


def clean_text(text: str) -> str:
    """Normalize whitespace and strip non-printable characters."""
    if not text:
        return ""
    text = text.replace("\xa0", " ").replace("\t", " ")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _enforce_character_limit(
    text: str,
    max_extracted_chars: Optional[int],
    filename: str,
) -> None:
    if max_extracted_chars is not None and len(text) > max_extracted_chars:
        raise IngestionLimitError(
            f"Extracted text from '{filename}' exceeds the configured limit "
            f"of {max_extracted_chars:,} characters."
        )


def extract_text_from_bytes(
    file_bytes: bytes,
    filename: str,
    max_pdf_pages: Optional[int] = None,
    max_extracted_chars: Optional[int] = None,
) -> str:
    """
    Extract text from a PDF or text file while enforcing page and character
    ceilings before expensive downstream chunking and vector indexing.
    """
    lower_name = filename.lower()

    if lower_name.endswith(".pdf"):
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            page_count = len(reader.pages)
            if max_pdf_pages is not None and page_count > max_pdf_pages:
                raise IngestionLimitError(
                    f"PDF '{filename}' contains {page_count} pages; the configured "
                    f"maximum is {max_pdf_pages}."
                )

            pages_text = []
            extracted_chars = 0
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    extracted_chars += len(extracted) + (2 if pages_text else 0)
                    if (
                        max_extracted_chars is not None
                        and extracted_chars > max_extracted_chars
                    ):
                        raise IngestionLimitError(
                            f"Extracted text from '{filename}' exceeds the "
                            f"configured limit of {max_extracted_chars:,} characters."
                        )
                    pages_text.append(extracted)

            full_text = clean_text("\n\n".join(pages_text))
            _enforce_character_limit(full_text, max_extracted_chars, filename)
            return full_text
        except IngestionLimitError:
            raise
        except Exception as exc:
            raise ValueError(f"Failed to parse PDF '{filename}': {exc}") from exc

    if lower_name.endswith(".txt") or lower_name.endswith(".md"):
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1", errors="replace")
        _enforce_character_limit(text, max_extracted_chars, filename)
        cleaned = clean_text(text)
        _enforce_character_limit(cleaned, max_extracted_chars, filename)
        return cleaned

    try:
        text = file_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError(
            f"Unsupported file type for '{filename}'. Supported types: .pdf, .txt, .md"
        ) from exc

    _enforce_character_limit(text, max_extracted_chars, filename)
    cleaned = clean_text(text)
    _enforce_character_limit(cleaned, max_extracted_chars, filename)
    return cleaned
