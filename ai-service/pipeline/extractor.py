import io
import re
from typing import Tuple
from pypdf import PdfReader

def clean_text(text: str) -> str:
    """Normalize whitespace and strip non-printable characters."""
    if not text:
        return ""
    # Replace non-breaking spaces and tabs
    text = text.replace("\xa0", " ").replace("\t", " ")
    # Replace carriage returns
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Collapse 3+ newlines to 2
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Collapse multiple inline spaces to one
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()

def extract_text_from_bytes(file_bytes: bytes, filename: str) -> str:
    """
    Extracts plain text from raw bytes of PDF or TXT files.
    """
    lower_name = filename.lower()
    
    if lower_name.endswith(".pdf"):
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            pages_text = []
            for i, page in enumerate(reader.pages):
                extracted = page.extract_text()
                if extracted:
                    pages_text.append(extracted)
            full_text = "\n\n".join(pages_text)
            return clean_text(full_text)
        except Exception as e:
            raise ValueError(f"Failed to parse PDF '{filename}': {str(e)}")
            
    elif lower_name.endswith(".txt") or lower_name.endswith(".md"):
        # Try UTF-8 first, fallback to latin-1
        try:
            text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            text = file_bytes.decode("latin-1", errors="replace")
        return clean_text(text)
        
    else:
        # Default try decoding as text
        try:
            text = file_bytes.decode("utf-8")
            return clean_text(text)
        except Exception:
            raise ValueError(f"Unsupported file type for '{filename}'. Supported types: .pdf, .txt, .md")
