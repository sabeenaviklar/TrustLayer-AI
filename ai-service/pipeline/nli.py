import os
import logging
from typing import List, Dict, Tuple, Optional
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from config import settings

logger = logging.getLogger("trustlayer.nli")

class NLIClassifier:
    def __init__(self, model_name: Optional[str] = None, cache_dir: Optional[str] = None):
        self.model_name = model_name or settings.nli_model
        self.cache_dir = cache_dir or settings.hf_home
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tokenizer = None
        self.model = None
        self.label_map = {"entailment": 1, "contradiction": 0, "neutral": 2}
        self.is_loaded = False

    def load(self):
        """Loads tokenizer and model weights into memory."""
        if self.is_loaded:
            return

        logger.info(f"Loading NLI model '{self.model_name}' on device '{self.device}'...")
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_name,
            cache_dir=self.cache_dir
        )
        self.model = AutoModelForSequenceClassification.from_pretrained(
            self.model_name,
            cache_dir=self.cache_dir
        )
        self.model.to(self.device)
        self.model.eval()

        # Dynamically resolve label indices from model.config.id2label
        if hasattr(self.model.config, "id2label") and self.model.config.id2label:
            logger.info(f"Found model id2label mapping: {self.model.config.id2label}")
            resolved = {}
            for idx, label_name in self.model.config.id2label.items():
                lbl = str(label_name).lower()
                int_idx = int(idx)
                if "entail" in lbl:
                    resolved["entailment"] = int_idx
                elif "contra" in lbl:
                    resolved["contradiction"] = int_idx
                elif "neut" in lbl:
                    resolved["neutral"] = int_idx
            if len(resolved) == 3:
                self.label_map = resolved
                logger.info(f"Dynamically mapped NLI labels: {self.label_map}")

        self.is_loaded = True
        logger.info(f"NLI model '{self.model_name}' loaded successfully.")

    @torch.inference_mode()
    def predict_pair(self, premise: str, hypothesis: str) -> Dict[str, float]:
        """
        Runs NLI inference on a single (premise, hypothesis) pair.
        Premise: The reference evidence chunk or sentence from documents.
        Hypothesis: The AI claim to be verified.
        """
        if not self.is_loaded:
            self.load()

        inputs = self.tokenizer(
            premise,
            hypothesis,
            truncation=True,
            max_length=512,
            return_tensors="pt"
        ).to(self.device)

        outputs = self.model(**inputs)
        probs = torch.softmax(outputs.logits[0], dim=-1).cpu().tolist()

        entailment = float(probs[self.label_map["entailment"]])
        contradiction = float(probs[self.label_map["contradiction"]])
        neutral = float(probs[self.label_map["neutral"]])

        return {
            "entailment": round(entailment, 4),
            "contradiction": round(contradiction, 4),
            "neutral": round(neutral, 4)
        }

    @torch.inference_mode()
    def predict_batch(self, pairs: List[Tuple[str, str]]) -> List[Dict[str, float]]:
        """
        Runs batch NLI inference on multiple (premise, hypothesis) pairs.
        """
        if not pairs:
            return []
        if not self.is_loaded:
            self.load()

        premises = [p for p, _ in pairs]
        hypotheses = [h for _, h in pairs]

        inputs = self.tokenizer(
            premises,
            hypotheses,
            truncation=True,
            padding=True,
            max_length=512,
            return_tensors="pt"
        ).to(self.device)

        outputs = self.model(**inputs)
        probs = torch.softmax(outputs.logits, dim=-1).cpu().tolist()

        results = []
        for p in probs:
            results.append({
                "entailment": round(float(p[self.label_map["entailment"]]), 4),
                "contradiction": round(float(p[self.label_map["contradiction"]]), 4),
                "neutral": round(float(p[self.label_map["neutral"]]), 4)
            })

        return results

# Global singleton
nli_model = NLIClassifier()
