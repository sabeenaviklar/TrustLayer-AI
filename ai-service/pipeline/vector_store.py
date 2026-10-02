import os
# Suppress chromadb telemetry before import
os.environ["ANONYMIZED_TELEMETRY"] = "False"
os.environ["CHROMA_TELEMETRY"] = "False"

import re
import uuid
import logging
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from config import settings

logger = logging.getLogger("trustlayer.vector_store")

def sanitize_collection_name(workspace_id: str) -> str:
    """
    ChromaDB collection names must be 3-63 characters, start and end with alphanum,
    and contain only [a-zA-Z0-9._-].
    """
    clean_id = re.sub(r"[^a-zA-Z0-9_-]", "_", str(workspace_id))
    name = f"ws_{clean_id}"
    if len(name) > 63:
        name = name[:63]
    return name

class VectorStore:
    def __init__(self, persist_dir: Optional[str] = None):
        self.persist_dir = persist_dir or settings.chroma_persist_dir
        os.makedirs(self.persist_dir, exist_ok=True)
        logger.info(f"Initializing ChromaDB PersistentClient at '{self.persist_dir}'")
        self.client = chromadb.PersistentClient(
            path=self.persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False)
        )

    def get_collection(self, workspace_id: str):
        collection_name = sanitize_collection_name(workspace_id)
        return self.client.get_or_create_collection(
            name=collection_name,
            metadata={"workspace_id": workspace_id}
        )

    def add_chunks(
        self,
        workspace_id: str,
        document_id: str,
        filename: str,
        chunks: List[str]
    ) -> int:
        if not chunks:
            return 0
            
        collection = self.get_collection(workspace_id)
        ids = [f"{document_id}_{i}_{uuid.uuid4().hex[:6]}" for i in range(len(chunks))]
        metadatas = [
            {
                "document_id": document_id,
                "filename": filename,
                "chunk_index": i,
                "workspace_id": workspace_id
            }
            for i in range(len(chunks))
        ]
        
        collection.add(
            ids=ids,
            documents=chunks,
            metadatas=metadatas
        )
        logger.info(f"Added {len(chunks)} chunks for doc '{filename}' (ID: {document_id}) to workspace '{workspace_id}'")
        return len(chunks)

    def query_similar(
        self,
        workspace_id: str,
        query_text: str,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        collection_name = sanitize_collection_name(workspace_id)
        try:
            collection = self.client.get_collection(name=collection_name)
        except Exception:
            # Collection does not exist yet or is empty
            return []

        count = collection.count()
        if count == 0:
            return []

        actual_k = min(top_k, count)
        results = collection.query(
            query_texts=[query_text],
            n_results=actual_k
        )

        output: List[Dict[str, Any]] = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metadatas = results["metadatas"][0] if "metadatas" in results else [{}] * len(docs)
            ids = results["ids"][0] if "ids" in results else [""] * len(docs)
            distances = results["distances"][0] if "distances" in results and results["distances"] is not None else [0.0] * len(docs)
            
            for doc, meta, chunk_id, dist in zip(docs, metadatas, ids, distances):
                output.append({
                    "text": doc,
                    "metadata": meta,
                    "chunk_id": chunk_id,
                    "distance": dist
                })

        return output

    def delete_workspace(self, workspace_id: str):
        collection_name = sanitize_collection_name(workspace_id)
        try:
            self.client.delete_collection(name=collection_name)
            logger.info(f"Deleted collection '{collection_name}' for workspace '{workspace_id}'")
        except Exception as e:
            logger.warning(f"Collection '{collection_name}' could not be deleted: {e}")

    def delete_document(self, workspace_id: str, document_id: str):
        collection = self.get_collection(workspace_id)
        collection.delete(where={"document_id": document_id})
        logger.info(f"Deleted document '{document_id}' from workspace '{workspace_id}'")

    def count(self, workspace_id: str) -> int:
        collection_name = sanitize_collection_name(workspace_id)
        try:
            coll = self.client.get_collection(name=collection_name)
            return coll.count()
        except Exception:
            return 0

# Global singleton
vector_store = VectorStore()
