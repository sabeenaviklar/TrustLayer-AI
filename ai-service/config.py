import os
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    nli_model: str = os.getenv("NLI_MODEL", "cross-encoder/nli-deberta-v3-small")
    chroma_persist_dir: str = os.getenv("CHROMA_PERSIST_DIR", "/data/chroma")
    hf_home: str = os.getenv("HF_HOME", "/data/models")
    port: int = int(os.getenv("PORT", "8001"))
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    environment: str = os.getenv("ENVIRONMENT", "production")

    # The AI service enforces its own limits even when called without Express.
    max_upload_size_mb: int = Field(
        default=25,
        gt=0,
        validation_alias="AI_MAX_UPLOAD_SIZE_MB",
    )
    max_pdf_pages: int = Field(
        default=500,
        gt=0,
        validation_alias="AI_MAX_PDF_PAGES",
    )
    max_extracted_chars: int = Field(
        default=2_000_000,
        gt=0,
        validation_alias="AI_MAX_EXTRACTED_CHARS",
    )

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
