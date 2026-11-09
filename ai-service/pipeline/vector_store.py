import os

# Suppress chromadb telemetry before import
os.environ["ANONYMIZED_TELEMETRY"] = "False"
os.environ["CHROMA_TELEMETRY"] = "False"

import logging
import re
import threading
import uuid
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
        logger.info("Initializing ChromaDB PersistentClient at '%s'", self.persist_dir)
        self.client = chromadb.PersistentClient(
            path=self.persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        # Fixed lock striping avoids an unbounded per-document lock registry.
        self._document_locks = [threading.RLock() for _ in range(64)]

    def get_collection(self, workspace_id: str):
        collection_name = sanitize_collection_name(workspace_id)
        return self.client.get_or_create_collection(
            name=collection_name,
            metadata={"workspace_id": str(workspace_id)},
        )

    def _get_document_lock(self, workspace_id: str, document_id: str):
        # Lazily initialize as well so lightweight test doubles created with
        # object.__new__ can exercise the store without calling __init__.
        if not hasattr(self, "_document_locks"):
            self._document_locks = [threading.RLock() for _ in range(64)]
        key = (str(workspace_id), str(document_id))
        return self._document_locks[hash(key) % len(self._document_locks)]

    @staticmethod
    def _document_filter(workspace_id: str, document_id: str):
        return {
            "$and": [
                {"workspace_id": str(workspace_id)},
                {"document_id": str(document_id)},
            ]
        }

    def add_chunks(
        self,
        workspace_id: str,
        document_id: str,
        filename: str,
        chunks: List[str],
    ) -> int:
        """
        Replace the current document index without removing the last valid copy
        until all replacement chunks have been written successfully.

        New chunk IDs are staged with a fresh ingestion token. If writing the
        replacement fails, only staged IDs are cleaned up and the old chunks
        remain available. Once the replacement is complete, old IDs are deleted.
        """
        if not chunks:
            return 0

        workspace_id = str(workspace_id)
        document_id = str(document_id)
        with self._get_document_lock(workspace_id, document_id):
            collection = self.get_collection(workspace_id)
            old_records = collection.get(
                where=self._document_filter(workspace_id, document_id),
                include=["metadatas"],
            )
            old_ids = old_records.get("ids") or []

            ingestion_id = uuid.uuid4().hex
            new_ids = [
                f"{document_id}_{ingestion_id}_{index}"
                for index in range(len(chunks))
            ]
            metadatas = [
                {
                    "document_id": document_id,
                    "filename": filename,
                    "chunk_index": index,
                    "workspace_id": workspace_id,
                    "ingestion_id": ingestion_id,
                }
                for index in range(len(chunks))
            ]

            try:
                collection.add(ids=new_ids, documents=chunks, metadatas=metadatas)
            except Exception:
                # Chroma may have accepted a subset before surfacing a failure.
                # Remove only this attempt's unique IDs; preserve the old index.
                try:
                    collection.delete(ids=new_ids)
                except Exception:
                    logger.exception(
                        "Failed to clean staged chunks for document '%s' after "
                        "ingestion failure",
                        document_id,
                    )
                raise

            try:
                if old_ids:
                    collection.delete(ids=old_ids)
            except Exception:
                # Do not leave two document versions searchable when the old
                # version could not be removed.
                try:
                    collection.delete(ids=new_ids)
                except Exception:
                    logger.exception(
                        "Failed to roll back staged chunks for document '%s'",
                        document_id,
                    )
                raise

            logger.info(
                "Replaced document '%s' with %s chunks in workspace '%s'",
                document_id,
                len(new_ids),
                workspace_id,
            )
            return len(new_ids)

    def query_similar(
        self,
        workspace_id: str,
        query_text: str,
        top_k: int = 5,
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
            n_results=actual_k,
        )

        output: List[Dict[str, Any]] = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metadatas = (
                results["metadatas"][0]
                if "metadatas" in results
                else [{}] * len(docs)
            )
            ids = results["ids"][0] if "ids" in results else [""] * len(docs)
            distances = (
                results["distances"][0]
                if "distances" in results and results["distances"] is not None
                else [0.0] * len(docs)
            )

            for doc, meta, chunk_id, distance in zip(
                docs, metadatas, ids, distances
            ):
                output.append(
                    {
                        "text": doc,
                        "metadata": meta,
                        "chunk_id": chunk_id,
                        "distance": distance,
                    }
                )

        return output

    def delete_workspace(self, workspace_id: str):
        collection_name = sanitize_collection_name(workspace_id)
        try:
            self.client.delete_collection(name=collection_name)
            logger.info(
                "Deleted collection '%s' for workspace '%s'",
                collection_name,
                workspace_id,
            )
        except Exception as exc:
            logger.warning(
                "Collection '%s' could not be deleted: %s",
                collection_name,
                exc,
            )

    def delete_document(self, workspace_id: str, document_id: str):
        """
        Idempotently delete only the requested document's chunks in a workspace.
        """
        workspace_id = str(workspace_id)
        document_id = str(document_id)
        with self._get_document_lock(workspace_id, document_id):
            collection = self.get_collection(workspace_id)
            collection.delete(
                where=self._document_filter(workspace_id, document_id)
            )
        logger.info(
            "Deleted document '%s' from workspace '%s'",
            document_id,
            workspace_id,
        )

    def count(self, workspace_id: str) -> int:
        collection_name = sanitize_collection_name(workspace_id)
        try:
            collection = self.client.get_collection(name=collection_name)
            return collection.count()
        except Exception:
            return 0


# Global singleton
vector_store = VectorStore()
