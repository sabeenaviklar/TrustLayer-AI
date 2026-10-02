import re
from typing import List

def split_sentences(text: str) -> List[str]:
    """Splits a block of text into distinct sentences."""
    if not text:
        return []

    # Protect common abbreviations like e.g., i.e., Dr., etc.
    protected = text
    abbreviations = ["e.g.", "i.e.", "etc.", "mr.", "mrs.", "ms.", "dr.", "vs.", "inc.", "ltd.", "co.", "corp."]
    for abbr in abbreviations:
        pattern = re.compile(re.escape(abbr), re.IGNORECASE)
        protected = pattern.sub(abbr.replace(".", "___DOT___"), protected)

    # Split paragraphs first
    paragraphs = [p.strip() for p in protected.split("\n") if p.strip()]
    sentences = []

    for p in paragraphs:
        # Clean leading bullet points or numbered lists
        p_clean = re.sub(r"^[-*•\d+.)]\s*", "", p).strip()
        # Split on sentence-ending punctuation followed by whitespace or quote
        raw_splits = re.split(r'(?<=[.!?])\s+', p_clean)
        for s in raw_splits:
            restored = s.replace("___DOT___", ".").strip()
            if len(restored) > 3:
                sentences.append(restored)

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

def chunk_document(text: str, chunk_size: int = 500, chunk_overlap: int = 100) -> List[str]:
    """
    Chunks a long document text into overlapping segments respecting sentence / paragraph breaks.
    """
    if not text or len(text) <= chunk_size:
        return [text] if text.strip() else []

    paragraphs = text.split("\n\n")
    chunks: List[str] = []
    current_chunk = ""

    for paragraph in paragraphs:
        p = paragraph.strip()
        if not p:
            continue
            
        if len(current_chunk) + len(p) + 2 <= chunk_size:
            current_chunk = f"{current_chunk}\n\n{p}".strip()
        else:
            if current_chunk:
                chunks.append(current_chunk)
                # Keep tail for overlap
                overlap_text = current_chunk[-chunk_overlap:] if len(current_chunk) > chunk_overlap else current_chunk
                current_chunk = f"{overlap_text}\n\n{p}".strip()
            else:
                # Paragraph itself exceeds chunk_size, split by sentences
                sentences = split_sentences(p)
                for sentence in sentences:
                    if len(current_chunk) + len(sentence) + 1 <= chunk_size:
                        current_chunk = f"{current_chunk} {sentence}".strip()
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                            overlap_text = current_chunk[-chunk_overlap:] if len(current_chunk) > chunk_overlap else current_chunk
                            current_chunk = f"{overlap_text} {sentence}".strip()
                        else:
                            # Single sentence larger than chunk_size, slice directly
                            chunks.append(sentence[:chunk_size])
                            current_chunk = sentence[chunk_size - chunk_overlap:]

    if current_chunk and current_chunk not in chunks:
        chunks.append(current_chunk)

    return chunks
