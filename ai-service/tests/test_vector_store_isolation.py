import re

import pytest
from chromadb.errors import InvalidCollectionException

from pipeline.vector_store import (
    VectorStore,
    WorkspaceCollectionIdentityError,
    legacy_sanitize_collection_name,
    sanitize_collection_name,
)


def _matches(metadata, where):
    if "$and" in where:
        return all(_matches(metadata, clause) for clause in where["$and"])
    return all(metadata.get(key) == value for key, value in where.items())


class FakeCollection:
    def __init__(self, name, workspace_id):
        self.name = name
        self.metadata = {"workspace_id": workspace_id}
        self.records = []

    def add(self, ids, documents, metadatas):
        self.upsert(ids=ids, documents=documents, metadatas=metadatas)

    def upsert(self, ids, documents, metadatas):
        by_id = {record["id"]: record for record in self.records}
        for chunk_id, document, metadata in zip(ids, documents, metadatas):
            by_id[chunk_id] = {
                "id": chunk_id,
                "document": document,
                "metadata": metadata,
            }
        self.records = list(by_id.values())

    def count(self):
        return len(self.records)

    def get(self, where=None, limit=None, include=None):
        records = [
            record
            for record in self.records
            if where is None or _matches(record["metadata"], where)
        ]
        if limit is not None:
            records = records[:limit]
        return {
            "ids": [record["id"] for record in records],
            "documents": [record["document"] for record in records],
            "metadatas": [record["metadata"] for record in records],
        }

    def query(self, query_texts, n_results, where=None):
        records = [
            record
            for record in self.records
            if where is None or _matches(record["metadata"], where)
        ][:n_results]
        return {
            "documents": [[record["document"] for record in records]],
            "metadatas": [[record["metadata"] for record in records]],
            "ids": [[record["id"] for record in records]],
            "distances": [[0.0 for _ in records]],
        }

    def delete(self, ids=None, where=None):
        if ids is not None:
            ids_to_delete = set(ids)
            self.records = [
                record for record in self.records if record["id"] not in ids_to_delete
            ]
            return
        if where is not None:
            self.records = [
                record
                for record in self.records
                if not _matches(record["metadata"], where)
            ]


class FakeClient:
    def __init__(self):
        self.collections = {}

    def get_collection(self, name):
        if name not in self.collections:
            raise InvalidCollectionException(f"Collection {name} does not exist.")
        return self.collections[name]

    def get_or_create_collection(self, name, metadata):
        if name not in self.collections:
            self.collections[name] = FakeCollection(
                name=name,
                workspace_id=metadata["workspace_id"],
            )
        return self.collections[name]

    def delete_collection(self, name):
        if name not in self.collections:
            raise InvalidCollectionException(f"Collection {name} does not exist.")
        del self.collections[name]


@pytest.fixture
def vector_store():
    store = object.__new__(VectorStore)
    store.client = FakeClient()
    return store


@pytest.mark.parametrize(
    ("workspace_a", "workspace_b"),
    [
        ("team/acme", "team_acme"),
        ("x" * 80 + "-first", "x" * 80 + "-second"),
    ],
)
def test_collection_names_are_collision_resistant_and_valid(
    workspace_a, workspace_b
):
    name_a = sanitize_collection_name(workspace_a)
    name_b = sanitize_collection_name(workspace_b)

    assert name_a != name_b
    assert len(name_a) <= 63
    assert len(name_b) <= 63
    assert name_a[0].isalnum() and name_a[-1].isalnum()
    assert name_b[0].isalnum() and name_b[-1].isalnum()
    assert re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]{1,61}[a-zA-Z0-9]", name_a)
    assert re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]{1,61}[a-zA-Z0-9]", name_b)


def test_colliding_workspace_ids_are_isolated_for_reads_and_deletes(vector_store):
    workspace_a = "team/acme"
    workspace_b = "team_acme"

    vector_store.add_chunks(workspace_a, "doc-a", "a.txt", ["private data A"])
    vector_store.add_chunks(workspace_b, "doc-b", "b.txt", ["private data B"])

    assert vector_store.count(workspace_a) == 1
    assert vector_store.count(workspace_b) == 1

    results_a = vector_store.query_similar(workspace_a, "private data")
    results_b = vector_store.query_similar(workspace_b, "private data")
    assert [item["text"] for item in results_a] == ["private data A"]
    assert [item["text"] for item in results_b] == ["private data B"]

    vector_store.delete_workspace(workspace_a)

    assert vector_store.count(workspace_a) == 0
    assert vector_store.count(workspace_b) == 1
    assert vector_store.query_similar(workspace_b, "private data")[0]["text"] == (
        "private data B"
    )


def test_legacy_collection_migration_is_scoped_to_each_workspace(vector_store):
    workspace_a = "team/acme"
    workspace_b = "team_acme"
    legacy_name = legacy_sanitize_collection_name(workspace_a)
    legacy_collection = FakeCollection(legacy_name, workspace_a)
    legacy_collection.add(
        ids=["legacy-a-0", "legacy-b-0"],
        documents=["legacy private data A", "legacy private data B"],
        metadatas=[
            {"workspace_id": workspace_a, "document_id": "legacy-doc-a"},
            {"workspace_id": workspace_b, "document_id": "legacy-doc-b"},
        ],
    )
    vector_store.client.collections[legacy_name] = legacy_collection

    # Each tenant migrates only its own chunks, even though the old collection
    # metadata names just the workspace that originally created the collection.
    results_a = vector_store.query_similar(workspace_a, "legacy data")
    results_b = vector_store.query_similar(workspace_b, "legacy data")

    assert [item["text"] for item in results_a] == ["legacy private data A"]
    assert [item["text"] for item in results_b] == ["legacy private data B"]
    assert legacy_name not in vector_store.client.collections
    assert vector_store.count(workspace_a) == 1
    assert vector_store.count(workspace_b) == 1

    vector_store.delete_workspace(workspace_a)
    assert vector_store.count(workspace_a) == 0
    assert vector_store.count(workspace_b) == 1
    assert vector_store.query_similar(workspace_b, "legacy data")[0]["text"] == (
        "legacy private data B"
    )


def test_long_workspace_ids_use_distinct_collections(vector_store):
    workspace_a = "workspace-" + ("shared-prefix-" * 8) + "A"
    workspace_b = "workspace-" + ("shared-prefix-" * 8) + "B"

    vector_store.add_chunks(workspace_a, "doc-a", "a.txt", ["long ID A"])
    vector_store.add_chunks(workspace_b, "doc-b", "b.txt", ["long ID B"])

    assert vector_store.count(workspace_a) == 1
    assert vector_store.count(workspace_b) == 1
    vector_store.delete_workspace(workspace_a)
    assert vector_store.count(workspace_a) == 0
    assert vector_store.count(workspace_b) == 1


def test_hashed_collection_with_wrong_metadata_fails_closed(vector_store):
    workspace_id = "expected-workspace"
    collection_name = sanitize_collection_name(workspace_id)
    vector_store.client.collections[collection_name] = FakeCollection(
        collection_name, "different-workspace"
    )

    with pytest.raises(WorkspaceCollectionIdentityError):
        vector_store.get_collection(workspace_id)
