import re
from typing import List

_ABBREVIATIONS = re.compile(r"\b(?:e\.g|i\.e|etc|mr|mrs|ms|dr|vs|inc|ltd|co|corp)\.", re.IGNORECASE)
_LIST_MARKER = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+")
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")
_DOT = "\ue000"  # private-use placeholder for protected abbreviation dots

def split_sentences(text: str) -> List[str]:
    """Splits a block of text into distinct sentences."""
    if not text:
        return []

    # Protect abbreviations (e.g., Dr., Inc.) from sentence splitting, preserving their casing
    protected = _ABBREVIATIONS.sub(lambda m: m.group().replace(".", _DOT), text)

    sentences = []
    for line in protected.split("\n"):
        line = _LIST_MARKER.sub("", line).strip()
        for part in _SENTENCE_END.split(line):
            sentence = part.replace(_DOT, ".").strip()
            if len(sentence) > 3:
                sentences.append(sentence)

    return sentences

def split_into_claims(answer: str) -> List[str]:
    """
    Splits an AI-generated answer into individual testable claims.
    If the answer has multiple sentences or numbered points, splits accordingly.
    """
    sentences = split_sentences(answer)
    if not sentences and answer.strip():
        return [answer.strip()]
    return sentences

def _hard_split(text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
    """Slices text with no usable break points into overlapping pieces of at most chunk_size."""
    step = chunk_size - chunk_overlap
    return [text[i:i + chunk_size] for i in range(0, len(text) - chunk_overlap, step)]

def chunk_document(text: str, chunk_size: int = 500, chunk_overlap: int = 100) -> List[str]:
    """
    Chunks a long document text into overlapping segments respecting sentence / paragraph breaks.
    Every returned chunk is at most chunk_size characters long.
    """
    if not 0 <= chunk_overlap < chunk_size:
        raise ValueError("chunk_overlap must be >= 0 and smaller than chunk_size")

    # Break the text into units that each fit in a chunk: paragraphs, then sentences, then raw slices
    units: List[str] = []
    for paragraph in re.split(r"\n\s*\n", text or ""):
        paragraph = paragraph.strip()
        if len(paragraph) <= chunk_size:
            units.append(paragraph)
            continue
        for sentence in split_sentences(paragraph):
            units.extend([sentence] if len(sentence) <= chunk_size else _hard_split(sentence, chunk_size, chunk_overlap))

    # Pack units into chunks, carrying the tail of the previous chunk as overlap when it fits
    chunks: List[str] = []
    current = ""
    for unit in filter(None, units):
        if current and len(current) + 1 + len(unit) <= chunk_size:
            current = f"{current}\n{unit}"
            continue
        tail = current[max(0, len(current) - chunk_overlap):]
        if current:
            chunks.append(current)
        current = f"{tail}\n{unit}" if tail and len(tail) + 1 + len(unit) <= chunk_size else unit
    if current:
        chunks.append(current)

    return chunks
