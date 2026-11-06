import pytest
from pydantic import ValidationError

from config import Settings
from pipeline import checker
from schemas import ClaimVerdict


def scores(entailment=0.0, contradiction=0.0):
    return {"entailment": entailment, "contradiction": contradiction, "neutral": round(1 - entailment - contradiction, 4)}


class FakeVectorStore:
    def __init__(self, chunks):
        self.chunks = chunks

    def query_similar(self, workspace_id, query_text, top_k=5):
        return self.chunks


class FakeNLI:
    """Returns pre-set scores keyed by the premise sentence."""

    def __init__(self, by_premise):
        self.by_premise = by_premise

    def predict_batch(self, pairs):
        return [self.by_premise[premise] for premise, _ in pairs]


@pytest.fixture
def run_check(monkeypatch):
    def _run(chunks, by_premise, answer="The plan costs ten dollars.", regenerate=False):
        monkeypatch.setattr(checker, "vector_store", FakeVectorStore(chunks))
        monkeypatch.setattr(checker, "nli_model", FakeNLI(by_premise))
        return checker.check_hallucinations("How much?", answer, "ws_1", regenerate)
    return _run


def chunk(chunk_id, text, distance=0.5):
    return {"chunk_id": chunk_id, "text": text, "distance": distance}


SUPPORTING = [chunk("c1", "The plan costs ten dollars.")]
SUPPORTING_NLI = {"The plan costs ten dollars.": scores(entailment=0.70)}


def test_defaults_keep_existing_behaviour(run_check):
    result = run_check(SUPPORTING, SUPPORTING_NLI)
    assert result.claims[0].verdict == ClaimVerdict.SUPPORTED
    assert result.reliability_score == 100.0
    assert result.overall_verdict == ClaimVerdict.SUPPORTED


def test_supported_threshold_is_configurable(run_check, monkeypatch):
    monkeypatch.setattr(checker.settings, "supported_threshold", 0.9)
    result = run_check(SUPPORTING, SUPPORTING_NLI)
    assert result.claims[0].verdict == ClaimVerdict.UNVERIFIABLE


def test_contradicted_threshold_is_configurable(run_check, monkeypatch):
    nli = {"The plan costs ten dollars.": scores(contradiction=0.60)}
    assert run_check(SUPPORTING, nli).claims[0].verdict == ClaimVerdict.CONTRADICTED
    monkeypatch.setattr(checker.settings, "contradicted_threshold", 0.8)
    assert run_check(SUPPORTING, nli).claims[0].verdict == ClaimVerdict.UNVERIFIABLE


def test_retrieval_max_distance_is_configurable(run_check, monkeypatch):
    far_chunks = [chunk("c1", "The plan costs ten dollars.", distance=1.0)]
    assert run_check(far_chunks, SUPPORTING_NLI).claims[0].verdict == ClaimVerdict.SUPPORTED
    monkeypatch.setattr(checker.settings, "retrieval_max_distance", 0.5)
    assert run_check(far_chunks, SUPPORTING_NLI).claims[0].verdict == ClaimVerdict.UNVERIFIABLE


def test_unverifiable_weight_and_cutoffs_are_configurable(run_check, monkeypatch):
    assert run_check([], {}).reliability_score == 40.0
    monkeypatch.setattr(checker.settings, "unverifiable_weight", 80.0)
    monkeypatch.setattr(checker.settings, "verdict_supported_cutoff", 70.0)
    result = run_check([], {})
    assert result.reliability_score == 80.0
    assert result.overall_verdict == ClaimVerdict.SUPPORTED


@pytest.mark.parametrize("override", [
    {"supported_threshold": 1.5},
    {"contradicted_threshold": -0.1},
    {"retrieval_max_distance": 0},
    {"unverifiable_weight": 101},
    {"verdict_contradicted_cutoff": 90, "verdict_supported_cutoff": 60},
])
def test_invalid_settings_fail_at_startup(override):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **override)


def test_settings_read_environment_variables(monkeypatch):
    monkeypatch.setenv("SUPPORTED_THRESHOLD", "0.8")
    assert Settings(_env_file=None).supported_threshold == 0.8
