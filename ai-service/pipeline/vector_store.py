import os

# Suppress chromadb telemetry before import
os.environ["ANONYMIZED_TELEMETRY"] = "False"
os.environ["CHROMA_TELEMETRY"] = "False"

import hashlib
import logging
import re
import uuid
from typing import List, Dict, Any, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from chromadb.errors import InvalidCollectionException

from config import settings

logger = logging.getLogger("trustlayer.vector_store")


class WorkspaceCollectionIdentityError(RuntimeError):
    """Raised when a Chroma collection is not owned by the requested workspace."""


def legacy_sanitize_collection_name(workspace_id: str) -> str:
    """Return the collection name used before collision-resistant naming."""
    clean_id = re.sub(r"[^a-zA-Z0-9_-]", "_", str(workspace_id))
    return f"ws_{clean_id}"[:63]


def sanitize_collection_name(workspace_id: str) -> str:
    """
    Build a deterministic, collision-resistant Chroma collection name.

    The readable prefix is bounded and a SHA-256 suffix preserves the identity
    of the complete workspace ID, including characters removed by sanitization
    and characters beyond the ChromaDB name-length limit.
    """
    workspace_id = str(workspace_id)
    readable_id = re.sub(r"[^a-zA-Z0-9_-]", "_", workspace_id).strip("_-")
    if not readable_id:
        readable_id = "workspace"

    digest = hashlib.sha256(workspace_id.encode("utf-8")).hexdigest()[:16]
    # ChromaDB collection names are limited to 63 characters.
    max_prefix_length = 63 - len("ws_") - 1 - len(digest)
    readable_id = readable_id[:max_prefix_length]
    return f"ws_{readable_id}_{digest}"


class VectorStore:
    LEGACY_MIGRATION_BATCH_SIZE = 500

    def __init__(self, persist_dir: Optional[str] = None):
        self.persist_dir = persist_dir or settings.chroma_persist_dir
        os.makedirs(self.persist_dir, exist_ok=True)
        logger.info("Initializing ChromaDB PersistentClient at '%s'", self.persist_dir)
        self.client = chromadb.PersistentClient(
            path=self.persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )

    @staticmethod
    def _verify_collection_identity(collection, workspace_id: str):
        metadata = collection.metadata or {}
        if metadata.get("workspace_id") != workspace_id:
            raise WorkspaceCollectionIdentityError(
                "Chroma collection identity mismatch: refusing to access a "
                f"collection that is not owned by workspace '{workspace_id}'."
            )
        return collection

    def _get_existing_collection(self, collection_name: str):
        try:
            return self.client.get_collection(name=collection_name)
        except InvalidCollectionException:
            return None

    def _migrate_legacy_workspace_records(
        self,
        legacy_collection,
        target_collection,
        workspace_id: str,
    ) -> int:
        """
        Move only this workspace's records from a legacy shared collection.

        Older versions could put multiple workspaces in one sanitized
        collection. Per-record workspace metadata is therefore authoritative;
        collection-level metadata alone is not sufficient for safe migration.
        """
        migrated_count = 0

        while True:
            batch = legacy_collection.get(
                where={"workspace_id": workspace_id},
                limit=self.LEGACY_MIGRATION_BATCH_SIZE,
                include=["documents", "metadatas"],
            )
            ids = batch.get("ids") or []
            if not ids:
                break

            documents = batch.get("documents")
            metadatas = batch.get("metadatas")
            if (
                documents is None
                or metadatas is None
                or len(documents) != len(ids)
                or len(metadatas) != len(ids)
            ):
                raise RuntimeError(
                    "Cannot safely migrate legacy Chroma records: "
                    "documents or metadata are missing."
                )

            if any(
                not metadata or metadata.get("workspace_id") != workspace_id
                for metadata in metadatas
            ):
                raise WorkspaceCollectionIdentityError(
                    "Legacy collection returned records outside the requested "
                    f"workspace '{workspace_id}'. Migration was stopped."
                )

            # Upsert first so a retry is safe if deleting the legacy batch fails.
            target_collection.upsert(
                ids=ids,
                documents=documents,
                metadatas=metadatas,
            )
            legacy_collection.delete(ids=ids)
            migrated_count += len(ids)

        if migrated_count:
            logger.info(
                "Migrated %s legacy vector chunks into the isolated collection "
                "for workspace '%s'",
                migrated_count,
                workspace_id,
            )

        if legacy_collection.count() == 0:
            self.client.delete_collection(name=legacy_collection.name)

        return migrated_count

    def _get_workspace_collection(self, workspace_id: str, create: bool = True):
        """
        Resolve a workspace collection and migrate any matching legacy records.

        Existing hashed collections take precedence. A legacy collection is
        never exposed directly: only records whose own workspace_id matches
        exactly are copied into the isolated collection.
        """
        workspace_id = str(workspace_id)
        collection_name = sanitize_collection_name(workspace_id)

        collection = self._get_existing_collection(collection_name)
        if collection is not None:
            self._verify_collection_identity(collection, workspace_id)

        legacy_name = legacy_sanitize_collection_name(workspace_id)
        legacy_name_is_valid = (
            3 <= len(legacy_name) <= 63
            and legacy_name[0].isalnum()
            and legacy_name[-1].isalnum()
        )
        legacy_collection = None
        if legacy_name != collection_name and legacy_name_is_valid:
            legacy_collection = self._get_existing_collection(legacy_name)

        if legacy_collection is not None:
            if collection is None:
                collection = self.client.get_or_create_collection(
                    name=collection_name,
                    metadata={"workspace_id": workspace_id},
                )
                self._verify_collection_identity(collection, workspace_id)

            self._migrate_legacy_workspace_records(
                legacy_collection,
                collection,
                workspace_id,
            )
            return collection

        if collection is not None:
            return collection

        if not create:
            return None

        collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"workspace_id": workspace_id},
        )
        return self._verify_collection_identity(collection, workspace_id)

    def get_collection(self, workspace_id: str):
        return self._get_workspace_collection(workspace_id, create=True)

    def add_chunks(
        self,
        workspace_id: str,
        document_id: str,
        filename: str,
        chunks: List[str],
    ) -> int:
        if not chunks:
            return 0

        collection = self.get_collection(workspace_id)
        ids = [
            f"{document_id}_{i}_{uuid.uuid4().hex[:6]}"
            for i in range(len(chunks))
        ]
        metadatas = [
            {
                "document_id": document_id,
                "filename": filename,
                "chunk_index": i,
                "workspace_id": str(workspace_id),
            }
            for i in range(len(chunks))
        ]

        collection.add(ids=ids, documents=chunks, metadatas=metadatas)
        logger.info(
            "Added %s chunks for doc '%s' (ID: %s) to workspace '%s'",
            len(chunks),
            filename,
            document_id,
            workspace_id,
        )
        return len(chunks)

    def query_similar(
        self,
        workspace_id: str,
        query_text: str,
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        workspace_id = str(workspace_id)
        collection = self._get_workspace_collection(workspace_id, create=False)
        if collection is None:
            return []

        count = len(
            collection.get(
                where={"workspace_id": workspace_id},
                include=["metadatas"],
            ).get("ids", [])
        )
        if count == 0:
            return []

        actual_k = min(top_k, count)
        results = collection.query(
            query_texts=[query_text],
            n_results=actual_k,
            where={"workspace_id": workspace_id},
        )

        output: List[Dict[str, Any]] = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metadatas = (
                results["metadatas"][0]
                if "metadatas" in results and results["metadatas"]
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
        workspace_id = str(workspace_id)
        collection = self._get_workspace_collection(workspace_id, create=False)
        if collection is None:
            logger.info(
                "No collection found for workspace '%s'; nothing to delete.",
                workspace_id,
            )
            return

        # Delete only this workspace's records; a legacy collection may have
        # contained records belonging to multiple workspaces.
        collection.delete(where={"workspace_id": workspace_id})
        if collection.count() == 0:
            self.client.delete_collection(name=collection.name)

        logger.info(
            "Deleted vector records for workspace '%s'",
            workspace_id,
        )

    def delete_document(self, workspace_id: str, document_id: str):
        workspace_id = str(workspace_id)
        collection = self.get_collection(workspace_id)
        collection.delete(
            where={
                "$and": [
                    {"document_id": str(document_id)},
                    {"workspace_id": workspace_id},
                ]
            }
        )
        logger.info(
            "Deleted document '%s' from workspace '%s'",
            document_id,
            workspace_id,
        )

    def count(self, workspace_id: str) -> int:
        workspace_id = str(workspace_id)
        collection = self._get_workspace_collection(workspace_id, create=False)
        if collection is None:
            return 0
        records = collection.get(
            where={"workspace_id": workspace_id},
            include=["metadatas"],
        )
        return len(records.get("ids") or [])


# Global singleton
vector_store = VectorStore()
