import os
import shutil
import tempfile
import pytest
from fastapi.testclient import TestClient

# Use a temporary chroma directory during tests
temp_dir = tempfile.mkdtemp(prefix="trustlayer_test_")
os.environ["CHROMA_PERSIST_DIR"] = temp_dir
os.environ["ENVIRONMENT"] = "testing"

from main import app
from pipeline.nli import nli_model

@pytest.fixture(scope="session", autouse=True)
def init_test_env():
    # Pre-load NLI model once for test session
    nli_model.load()
    yield
    # Cleanup temp directory after test session
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir, ignore_errors=True)

@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
