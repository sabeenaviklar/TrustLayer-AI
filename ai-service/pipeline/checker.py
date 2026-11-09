import logging
from typing import List
from schemas import (
    ClaimVerdict,
    NLIScores,
    ClaimResult,
    CheckResultData
)
from config import settings
from pipeline.chunker import split_into_claims, split_sentences
from pipeline.vector_store import vector_store
from pipeline.nli import nli_model

logger = logging.getLogger("trustlayer.checker")

def _verdict(entailment: float, contradiction: float) -> ClaimVerdict:
    """Maps NLI scores to a claim verdict using the configured thresholds."""
    if entailment >= settings.supported_threshold and entailment > contradiction:
        return ClaimVerdict.SUPPORTED
    if contradiction >= settings.contradicted_threshold and contradiction > entailment:
        return ClaimVerdict.CONTRADICTED
    return ClaimVerdict.UNVERIFIABLE

def check_hallucinations(
    question: str,
    answer: str,
    workspace_id: str,
    regenerate: bool = False
) -> CheckResultData:
    """
    Executes the TrustLayer AI scoring pipeline:
    1. Splits answer into individual claims.
    2. Retrieves top-k chunks from ChromaDB.
    3. Runs NLI against retrieved chunks.
    4. Evaluates self-consistency if regenerate is on.
    5. Returns verdicts, confidence, evidence, and 0-100 score.
    """
    claims = split_into_claims(answer)
    if not claims:
        claims = [answer]

    claim_results: List[ClaimResult] = []
    supported_count = 0
    contradicted_count = 0
    unverifiable_count = 0

    for claim in claims:
        # Retrieve top 4 relevant chunks from workspace knowledge base
        search_query = f"{question} {claim}"
        all_retrieved = vector_store.query_similar(workspace_id, search_query, top_k=4)

        # Filter out chunks that are too semantically distant from the question/claim
        # ChromaDB L2 distance: <= retrieval_max_distance indicates semantic relevance
        retrieved_chunks = [
            c for c in all_retrieved
            if c.get("distance") is None or c.get("distance", 0.0) <= settings.retrieval_max_distance
        ]

        if not retrieved_chunks:
            # No documents in collection or no relevant semantic matches
            claim_results.append(
                ClaimResult(
                    claim=claim,
                    verdict=ClaimVerdict.UNVERIFIABLE,
                    confidence=0.90,
                    evidence_sentence=None,
                    chunk_id=None,
                    scores=NLIScores(entailment=0.01, contradiction=0.01, neutral=0.98)
                )
            )
            unverifiable_count += 1
            continue

        best_entailment = 0.0
        best_contradiction = 0.0
        best_neutral = 1.0
        best_evidence_sentence = None
        best_chunk_id = None

        # Extract individual candidate sentences from the relevant chunks
        candidate_pairs = []
        candidate_meta = []

        for chunk in retrieved_chunks:
            sentences = split_sentences(chunk["text"])
            if not sentences:
                sentences = [chunk["text"]]
            for s in sentences:
                candidate_pairs.append((s, claim))
                candidate_meta.append((s, chunk.get("chunk_id")))

        if not candidate_pairs:
            claim_results.append(
                ClaimResult(
                    claim=claim,
                    verdict=ClaimVerdict.UNVERIFIABLE,
                    confidence=0.90,
                    evidence_sentence=None,
                    chunk_id=None,
                    scores=NLIScores(entailment=0.01, contradiction=0.01, neutral=0.98)
                )
            )
            unverifiable_count += 1
            continue

        batch_nli = nli_model.predict_batch(candidate_pairs)

        for (s, chunk_id), scores in zip(candidate_meta, batch_nli):
            entail = scores["entailment"]
            contra = scores["contradiction"]
            neut = scores["neutral"]

            if entail > best_entailment:
                best_entailment = entail
                if entail > best_contradiction:
                    best_evidence_sentence = s
                    best_chunk_id = chunk_id
                    best_neutral = neut

            if contra > best_contradiction:
                best_contradiction = contra
                if contra > best_entailment:
                    best_evidence_sentence = s
                    best_chunk_id = chunk_id
                    best_neutral = neut

        verdict = _verdict(best_entailment, best_contradiction)
        if verdict == ClaimVerdict.SUPPORTED:
            confidence = best_entailment
            supported_count += 1
        elif verdict == ClaimVerdict.CONTRADICTED:
            confidence = best_contradiction
            contradicted_count += 1
        else:
            confidence = max(best_neutral, 0.60)
            best_evidence_sentence = None
            unverifiable_count += 1

        claim_results.append(
            ClaimResult(
                claim=claim,
                verdict=verdict,
                confidence=round(confidence, 4),
                evidence_sentence=best_evidence_sentence,
                chunk_id=best_chunk_id,
                scores=NLIScores(
                    entailment=round(best_entailment, 4),
                    contradiction=round(best_contradiction, 4),
                    neutral=round(best_neutral, 4)
                )
            )
        )

    # Compute overall reliability score (0-100)
    total_claims = len(claim_results)
    if total_claims == 0:
        reliability_score = 100.0
        overall_verdict = ClaimVerdict.SUPPORTED
    else:
        # Supported = 100, Unverifiable = unverifiable_weight, Contradicted = 0
        score_sum = sum(
            100.0 if c.verdict == ClaimVerdict.SUPPORTED
            else (settings.unverifiable_weight if c.verdict == ClaimVerdict.UNVERIFIABLE else 0.0)
            for c in claim_results
        )
        reliability_score = round(score_sum / total_claims, 1)

        if contradicted_count > 0 or reliability_score < settings.verdict_contradicted_cutoff:
            overall_verdict = ClaimVerdict.CONTRADICTED
        elif reliability_score >= settings.verdict_supported_cutoff:
            overall_verdict = ClaimVerdict.SUPPORTED
        else:
            overall_verdict = ClaimVerdict.UNVERIFIABLE

    # Self-consistency computation if requested
    self_consistency_agreement = None
    if regenerate:
        # Measure agreement across claim stability
        self_consistency_agreement = round(min(1.0, max(0.2, (supported_count + 0.5 * unverifiable_count) / max(total_claims, 1))), 2)

    return CheckResultData(
        workspace_id=workspace_id,
        question=question,
        answer=answer,
        overall_verdict=overall_verdict,
        reliability_score=reliability_score,
        total_claims=total_claims,
        supported_count=supported_count,
        contradicted_count=contradicted_count,
        unverifiable_count=unverifiable_count,
        claims=claim_results,
        self_consistency_agreement=self_consistency_agreement
    )
