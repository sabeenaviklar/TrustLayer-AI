import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    nli_model: str = os.getenv("NLI_MODEL", "cross-encoder/nli-deberta-v3-small")
    chroma_persist_dir: str = os.getenv("CHROMA_PERSIST_DIR", "/data/chroma")
    hf_home: str = os.getenv("HF_HOME", "/data/models")
    port: int = int(os.getenv("PORT", "8001"))
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    environment: str = os.getenv("ENVIRONMENT", "production")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
