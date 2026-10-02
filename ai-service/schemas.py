from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field

class ClaimVerdict(str, Enum):
    SUPPORTED = "SUPPORTED"
    CONTRADICTED = "CONTRADICTED"
    UNVERIFIABLE = "UNVERIFIABLE"

class NLIScores(BaseModel):
    entailment: float = 0.0
    contradiction: float = 0.0
    neutral: float = 0.0

class ClaimResult(BaseModel):
    claim: str
    verdict: ClaimVerdict
    confidence: float
    evidence_sentence: Optional[str] = None
    chunk_id: Optional[str] = None
    scores: NLIScores

class CheckRequest(BaseModel):
    question: str = Field(..., min_length=1, description="The user question asked to the AI")
    answer: str = Field(..., min_length=1, description="The AI generated answer to verify")
    workspace_id: str = Field(..., min_length=1, description="Workspace ID scoping the document collection")
    regenerate: Optional[bool] = Field(False, description="Enable self-consistency regeneration check")

class CheckResultData(BaseModel):
    workspace_id: str
    question: str
    answer: str
    overall_verdict: ClaimVerdict
    reliability_score: float = Field(..., ge=0.0, le=100.0, description="0-100 reliability score")
    total_claims: int
    supported_count: int
    contradicted_count: int
    unverifiable_count: int
    claims: List[ClaimResult]
    self_consistency_agreement: Optional[float] = None

class IngestResultData(BaseModel):
    workspace_id: str
    document_id: str
    filename: str
    chunks_count: int
    characters_count: int

# Generic standardized API envelope
class ApiResponse(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[Dict[str, Any]] = None
