import io
import pytest
from schemas import ClaimVerdict

SAMPLE_DOC_TEXT = (
    "TrustLayer was founded in 2024 to combat artificial intelligence hallucinations. "
    "The headquarters of TrustLayer is located in San Francisco, California. "
    "TrustLayer offers two pricing plans: Free Plan with 100 checks per month, and Pro Plan with 5,000 checks per month. "
    "The system utilizes cross-encoder NLI models to score whether AI answers are supported by source documents. "
    "Customers must not share their API keys with unauthorized third parties."
)

@pytest.fixture
def seeded_workspace(client):
    ws_id = "ws_test_seeded_01"
    files = {
        "file": ("company_overview.txt", io.BytesIO(SAMPLE_DOC_TEXT.encode("utf-8")), "text/plain")
    }
    data = {
        "workspace_id": ws_id,
        "document_id": "doc_seed_01"
    }
    res = client.post("/ingest", files=files, data=data)
    assert res.status_code == 200
    assert res.json()["success"] is True
    return ws_id

def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["status"] == "healthy"
    assert data["data"]["model_loaded"] is True

def test_ingest_txt_document(client):
    workspace_id = "ws_test_txt_02"
    files = {
        "file": ("notes.txt", io.BytesIO(b"TrustLayer automated verification engine."), "text/plain")
    }
    data = {
        "workspace_id": workspace_id,
        "document_id": "doc_txt_02"
    }
    response = client.post("/ingest", files=files, data=data)
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["success"] is True
    assert res_json["data"]["workspace_id"] == workspace_id
    assert res_json["data"]["chunks_count"] >= 1

def test_check_supported_claim(client, seeded_workspace):
    payload = {
        "workspace_id": seeded_workspace,
        "question": "Where is TrustLayer located?",
        "answer": "The headquarters of TrustLayer is located in San Francisco, California."
    }
    response = client.post("/check", json=payload)
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    data = res["data"]
    assert data["supported_count"] >= 1
    assert data["contradicted_count"] == 0
    assert data["reliability_score"] >= 70.0
    assert data["claims"][0]["verdict"] == ClaimVerdict.SUPPORTED
    assert "San Francisco" in data["claims"][0]["evidence_sentence"]

def test_check_contradicted_claim(client, seeded_workspace):
    payload = {
        "workspace_id": seeded_workspace,
        "question": "Where is TrustLayer located and when was it founded?",
        "answer": "TrustLayer was founded in 1990 and is headquartered in Tokyo, Japan."
    }
    response = client.post("/check", json=payload)
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    data = res["data"]
    assert data["contradicted_count"] >= 1
    assert data["reliability_score"] < 50.0
    has_contradiction = any(c["verdict"] == ClaimVerdict.CONTRADICTED for c in data["claims"])
    assert has_contradiction is True

def test_check_unverifiable_claim(client, seeded_workspace):
    payload = {
        "workspace_id": seeded_workspace,
        "question": "What is the capital of Mars?",
        "answer": "The capital of Mars is Olympus Mons City."
    }
    response = client.post("/check", json=payload)
    assert response.status_code == 200
    res = response.json()
    assert res["success"] is True
    data = res["data"]
    assert data["unverifiable_count"] >= 1
    assert any(c["verdict"] == ClaimVerdict.UNVERIFIABLE for c in data["claims"])

def test_check_empty_inputs(client):
    response = client.post("/check", json={"workspace_id": "ws_1", "question": "", "answer": ""})
    assert response.status_code == 400
    res = response.json()
    assert res["success"] is False
    assert res["error"]["code"] == "VALIDATION_ERROR"

def test_ingest_empty_file(client):
    files = {
        "file": ("empty.txt", io.BytesIO(b""), "text/plain")
    }
    response = client.post("/ingest", files=files, data={"workspace_id": "ws_empty"})
    assert response.status_code == 400
    assert response.json()["success"] is False
