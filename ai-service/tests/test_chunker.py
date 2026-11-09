import pytest
from pipeline.chunker import chunk_document, split_sentences


def test_sentence_starting_with_number_keeps_digits():
    assert split_sentences("2023 revenue grew 5%.") == ["2023 revenue grew 5%."]


def test_list_markers_are_removed():
    text = "- First point here.\n2. Second point here.\n3) Third point here.\n• Fourth point here."
    assert split_sentences(text) == [
        "First point here.", "Second point here.", "Third point here.", "Fourth point here."
    ]


def test_decimal_at_line_start_is_not_a_list_marker():
    assert split_sentences("2.5 million units were sold.") == ["2.5 million units were sold."]


def test_abbreviations_keep_casing_and_do_not_split():
    result = split_sentences("Contact Dr. Smith at Acme Inc. today. Refunds take 30 days.")
    assert result == ["Contact Dr. Smith at Acme Inc. today.", "Refunds take 30 days."]


def test_abbreviation_inside_word_does_not_block_split():
    assert split_sentences("Visit Tesco. Prices dropped.") == ["Visit Tesco.", "Prices dropped."]


@pytest.mark.parametrize("text", ["", "   \n\n  "])
def test_chunk_document_blank_input(text):
    assert chunk_document(text) == []


def test_chunk_document_short_text_is_single_chunk():
    assert chunk_document("A short document.") == ["A short document."]


@pytest.mark.parametrize("text", [
    "word " * 400,
    "A" * 1200,
    ("Sentence number one is here. " * 60 + "\n\n") * 3,
])
def test_chunks_never_exceed_chunk_size(text):
    chunks = chunk_document(text, chunk_size=500, chunk_overlap=100)
    assert len(chunks) > 1
    assert all(0 < len(c) <= 500 for c in chunks)


def test_unpunctuated_text_is_fully_covered():
    chunks = chunk_document("A" * 1200, chunk_size=500, chunk_overlap=100)
    assert chunks[0] == "A" * 500
    assert sum(len(c) for c in chunks) >= 1200


def test_consecutive_chunks_overlap():
    text = " ".join(f"Sentence {i} talks about topic {i}." for i in range(60))
    chunks = chunk_document(text, chunk_size=300, chunk_overlap=60)
    assert all(nxt.startswith(prev[-60:]) for prev, nxt in zip(chunks, chunks[1:]))


def test_invalid_overlap_raises():
    with pytest.raises(ValueError):
        chunk_document("text", chunk_size=100, chunk_overlap=100)
