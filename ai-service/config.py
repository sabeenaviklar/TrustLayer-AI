import os
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    nli_model: str = os.getenv("NLI_MODEL", "cross-encoder/nli-deberta-v3-small")
    chroma_persist_dir: str = os.getenv("CHROMA_PERSIST_DIR", "/data/chroma")
    hf_home: str = os.getenv("HF_HOME", "/data/models")
    port: int = int(os.getenv("PORT", "8001"))
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    environment: str = os.getenv("ENVIRONMENT", "production")

    # Verification tuning (override via environment variables of the same name, upper-cased)
    retrieval_max_distance: float = Field(1.25, gt=0)  # max ChromaDB L2 distance for a chunk to count as relevant
    supported_threshold: float = Field(0.55, ge=0, le=1)  # min entailment score for SUPPORTED
    contradicted_threshold: float = Field(0.50, ge=0, le=1)  # min contradiction score for CONTRADICTED
    unverifiable_weight: float = Field(40.0, ge=0, le=100)  # reliability points an UNVERIFIABLE claim earns
    verdict_supported_cutoff: float = Field(75.0, ge=0, le=100)  # min reliability score for overall SUPPORTED
    verdict_contradicted_cutoff: float = Field(50.0, ge=0, le=100)  # reliability score below this is overall CONTRADICTED

    @model_validator(mode="after")
    def _check_cutoff_order(self):
        if self.verdict_contradicted_cutoff > self.verdict_supported_cutoff:
            raise ValueError("verdict_contradicted_cutoff must not exceed verdict_supported_cutoff")
        return self

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
