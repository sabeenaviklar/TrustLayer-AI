import os
import sys
from transformers import AutoTokenizer, AutoModelForSequenceClassification

def download():
    model_name = os.getenv("NLI_MODEL", "cross-encoder/nli-deberta-v3-small")
    cache_dir = os.getenv("HF_HOME", "/data/models")
    print(f"--> Pre-downloading NLI model '{model_name}' to cache directory '{cache_dir}'...")
    os.makedirs(cache_dir, exist_ok=True)
    
    tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir=cache_dir)
    model = AutoModelForSequenceClassification.from_pretrained(model_name, cache_dir=cache_dir)
    print(f"--> Successfully downloaded and cached '{model_name}'.")

if __name__ == "__main__":
    download()
