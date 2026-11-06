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

@pytest.fixture(scope="session", autouse=True)
def init_test_env():
    # TestClient starts the FastAPI lifespan and loads the NLI model for
    # integration tests. Direct unit tests can run without downloading it.
    yield
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
