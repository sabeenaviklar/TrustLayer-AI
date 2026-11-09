import pytest

from pipeline.vector_store import VectorStore


def matches(metadata, where):
    if "$and" in where:
        return all(matches(metadata, clause) for clause in where["$and"])
    return all(metadata.get(key) == value for key, value in where.items())


class FakeCollection:
    def __init__(self):
        self.records = []
        self.fail_next_add = False

    def get(self, where=None, include=None):
        records = [
            record for record in self.records
            if where is None or matches(record["metadata"], where)
        ]
        return {
            "ids": [record["id"] for record in records],
            "metadatas": [record["metadata"] for record in records],
        }

    def add(self, ids, documents, metadatas):
        if self.fail_next_add:
            self.fail_next_add = False
            # Simulate a partial write followed by an exception.
            if ids:
                self.records.append({
                    "id": ids[0],
                    "document": documents[0],
                    "metadata": metadatas[0],
                })
            raise RuntimeError("simulated Chroma write failure")

        for chunk_id, document, metadata in zip(ids, documents, metadatas):
            self.records.append({
                "id": chunk_id,
                "document": document,
                "metadata": metadata,
            })

    def delete(self, ids=None, where=None):
        ids_to_delete = set(ids or [])
        self.records = [
            record for record in self.records
            if not (
                (ids is not None and record["id"] in ids_to_delete)
                or (where is not None and matches(record["metadata"], where))
            )
        ]

    def count(self):
        return len(self.records)


class FakeClient:
    def __init__(self):
        self.collection = FakeCollection()

    def get_or_create_collection(self, name, metadata):
        return self.collection

    def get_collection(self, name):
        return self.collection


@pytest.fixture
def vector_store():
    store = object.__new__(VectorStore)
    store.client = FakeClient()
    return store


def documents_for(store, workspace_id, document_id):
    return [
        record["document"]
        for record in store.client.collection.records
        if record["metadata"].get("workspace_id") == workspace_id
        and record["metadata"].get("document_id") == document_id
    ]


def test_reingestion_replaces_existing_chunks_without_increasing_count(vector_store):
    first_count = vector_store.add_chunks(
        "workspace-a", "document-1", "notes.txt", ["first chunk", "second chunk"]
    )
    initial_ids = {
        record["id"] for record in vector_store.client.collection.records
    }

    second_count = vector_store.add_chunks(
        "workspace-a", "document-1", "notes.txt", ["first chunk", "second chunk"]
    )

    assert first_count == second_count == 2
    assert vector_store.count("workspace-a") == 2
    assert len(vector_store.client.collection.records) == 2
    assert not initial_ids.intersection(
        record["id"] for record in vector_store.client.collection.records
    )


def test_updated_content_removes_outdated_chunks(vector_store):
    vector_store.add_chunks(
        "workspace-a", "document-1", "notes.txt", ["old evidence", "stale evidence"]
    )

    vector_store.add_chunks(
        "workspace-a", "document-1", "notes.txt", ["replacement evidence"]
    )

    assert documents_for(vector_store, "workspace-a", "document-1") == [
        "replacement evidence"
    ]
    assert vector_store.count("workspace-a") == 1


def test_failed_reingestion_preserves_previous_valid_index(vector_store):
    vector_store.add_chunks(
        "workspace-a", "document-1", "notes.txt", ["existing valid evidence"]
    )
    vector_store.client.collection.fail_next_add = True

    with pytest.raises(RuntimeError, match="simulated Chroma write failure"):
        vector_store.add_chunks(
            "workspace-a", "document-1", "notes.txt", ["new partial", "new second"]
        )

    assert documents_for(vector_store, "workspace-a", "document-1") == [
        "existing valid evidence"
    ]
    assert vector_store.count("workspace-a") == 1


def test_document_deletion_does_not_affect_other_documents(vector_store):
    vector_store.add_chunks(
        "workspace-a", "document-1", "one.txt", ["document one evidence"]
    )
    vector_store.add_chunks(
        "workspace-a", "document-2", "two.txt", ["document two evidence"]
    )

    vector_store.delete_document("workspace-a", "document-1")

    assert documents_for(vector_store, "workspace-a", "document-1") == []
    assert documents_for(vector_store, "workspace-a", "document-2") == [
        "document two evidence"
    ]
    assert vector_store.count("workspace-a") == 1
    # Repeated deletes are safe and leave the other document untouched.
    vector_store.delete_document("workspace-a", "document-1")
    assert vector_store.count("workspace-a") == 1


def test_document_delete_is_scoped_to_workspace(vector_store):
    vector_store.add_chunks(
        "workspace-a", "shared-document-id", "a.txt", ["workspace A data"]
    )
    vector_store.add_chunks(
        "workspace-b", "shared-document-id", "b.txt", ["workspace B data"]
    )

    vector_store.delete_document("workspace-a", "shared-document-id")

    assert documents_for(vector_store, "workspace-a", "shared-document-id") == []
    assert documents_for(vector_store, "workspace-b", "shared-document-id") == [
        "workspace B data"
    ]
