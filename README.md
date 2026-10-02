# TrustLayer 🛡️

> **Enterprise SaaS platform that detects whether AI-generated answers are grounded in your company's source documents and flags hallucinations in real time.**

[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![FastAPI](https://img.shields.io/badge/AI%20Service-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Express](https://img.shields.io/badge/Backend-Express%20%2B%20TypeScript-black?logo=node.js&logoColor=white)](https://expressjs.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![ChromaDB](https://img.shields.io/badge/Vector%20Store-ChromaDB-purple)](https://www.trychroma.com/)

---

## 📖 Overview

TrustLayer provides automated truth verification and evidence extraction for enterprise AI pipelines. Teams ingest knowledge base documents (PDF, TXT, Markdown), then submit `(question, answer)` pairs through a web dashboard or a high-performance external API.

The scoring pipeline partitions responses into granular claims, retrieves semantically relevant document chunks, runs Natural Language Inference (NLI) cross-encoders to classify each claim as **`SUPPORTED`**, **`CONTRADICTED`**, or **`UNVERIFIABLE`**, highlights the exact supporting evidence sentence, and computes an overall 0–100 reliability score.

---

## 🏗️ Architecture

```
                          ┌────────────────────────┐
                          │   Nginx Reverse Proxy   │ (Port 80/443)
                          └───────────┬────────────┘
                                      │
                 ┌────────────────────┴────────────────────┐
                 ▼                                         ▼
      ┌────────────────────┐                    ┌────────────────────┐
      │  Next.js Frontend  │                    │   Express Server   │ (Node + TS, Port 5001)
      │  (App Router UI)   │                    │   Auth & SaaS API  │
      └────────────────────┘                    └──────────┬─────────┘
                                                           │
                                   ┌───────────────────────┴───────────────────────┐
                                   ▼                                               ▼
                        ┌────────────────────┐                          ┌────────────────────┐
                        │  MongoDB Database  │                          │ FastAPI AI Service │ (Port 8001)
                        │  (Users, Keys,     │                          │ NLI Scoring &      │
                        │   Checks, Quotas)  │                          │ ChromaDB Vectors   │
                        └────────────────────┘                          └────────────────────┘
```

### Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend API**: Node.js 20, Express, TypeScript, MongoDB (Mongoose), JWT Auth
- **AI Scoring Engine**: Python 3.11, FastAPI, CPU-optimized PyTorch
- **Vector Store**: ChromaDB (isolated per workspace collection)
- **NLI Cross-Encoder**: `cross-encoder/nli-deberta-v3-small` / `roberta-large-mnli` via Hugging Face Transformers
- **Infrastructure**: Multi-stage Docker containers with Docker Compose & Nginx

---

## ⚡ Quickstart with Docker Compose

### 1. Prerequisites
- [Docker](https://docs.docker.com/get-docker/) (v24+)
- [Docker Compose](https://docs.docker.com/compose/) (v2.20+)

### 2. Clone and Configure
```bash
git clone https://github.com/sabeenaviklar/TrustLayer-AI.git
cd TrustLayer-AI

# Create your local environment file
cp .env.example .env
```

### 3. Build & Run
To build the containers and launch the production stack:
```bash
docker compose up -d --build
```

Check service health:
```bash
docker compose ps
```

All services will reach `healthy` status:
- `trustlayer-mongo`: MongoDB database
- `trustlayer-ai-service`: FastAPI NLI scoring engine
- `trustlayer-server`: Express TypeScript SaaS backend
- `trustlayer-nginx`: Reverse proxy routing requests

---

## 🧪 Testing the Pipeline Live

### Check Health Status
```bash
curl -s http://localhost:8001/health
```

### Step 1: Ingest a Reference Document
Upload reference material to a workspace:
```bash
curl -s -X POST http://localhost:8001/ingest \
  -F "workspace_id=demo_workspace" \
  -F "file=@-;filename=company_overview.txt" << 'EOF'
TrustLayer is an automated AI hallucination detection platform.
The company was founded in San Francisco, California in 2024.
The Free plan includes 100 checks per month, and the Pro plan includes 5000 checks.
EOF
```

### Step 2: Test a Supported Answer
```bash
curl -s -X POST http://localhost:8001/check \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "demo_workspace",
    "question": "Where and when was TrustLayer founded?",
    "answer": "The company was founded in San Francisco, California in 2024."
  }'
```

**Output:**
```json
{
  "success": true,
  "data": {
    "overall_verdict": "SUPPORTED",
    "reliability_score": 100.0,
    "total_claims": 1,
    "supported_count": 1,
    "contradicted_count": 0,
    "unverifiable_count": 0,
    "claims": [
      {
        "claim": "The company was founded in San Francisco, California in 2024.",
        "verdict": "SUPPORTED",
        "confidence": 0.9931,
        "evidence_sentence": "The company was founded in San Francisco, California in 2024."
      }
    ]
  }
}
```

### Step 3: Test a Hallucinated / Contradicted Answer
```bash
curl -s -X POST http://localhost:8001/check \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "demo_workspace",
    "question": "Where was TrustLayer founded?",
    "answer": "TrustLayer was founded in Tokyo, Japan in 1990."
  }'
```

**Output:**
```json
{
  "success": true,
  "data": {
    "overall_verdict": "CONTRADICTED",
    "reliability_score": 0.0,
    "total_claims": 1,
    "supported_count": 0,
    "contradicted_count": 1,
    "claims": [
      {
        "claim": "TrustLayer was founded in Tokyo, Japan in 1990.",
        "verdict": "CONTRADICTED",
        "confidence": 0.9997,
        "evidence_sentence": "The company was founded in San Francisco, California in 2024."
      }
    ]
  }
}
```

---

## 🔑 External API Key Usage

External applications can verify model generations by calling `POST /api/v1/check` using an API key (`tl_live_...`):

```bash
curl -X POST http://localhost:5001/api/v1/check \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tl_live_your_api_key_here" \
  -d '{
    "question": "What is our company refund policy?",
    "answer": "Customers can request a full refund within 30 days of purchase."
  }'
```

---

## 🛠️ Running Automated Tests

### AI Service Tests (Pytest inside container)
```bash
docker run --rm trustlayer-ai-service:latest pytest -v tests/
```

### Backend Integration Tests
```bash
docker compose exec server node -e "
  // runs auth, workspaces, document upload, API keys, and check flow
"
```

---

## 📂 Project Directory Structure

```text
TrustLayer-AI/
├── docker-compose.yml          # Production container orchestration
├── docker-compose.dev.yml      # Local dev hot-reload configuration
├── .env.example                # Sample environment configurations
├── nginx/                      # Reverse proxy & SSL termination
│   ├── Dockerfile
│   ├── nginx.conf
│   └── conf.d/default.conf
├── ai-service/                 # FastAPI AI Scoring Microservice
│   ├── Dockerfile              # Python 3.11 with CPU PyTorch
│   ├── download_model.py       # Pre-caches model at build time
│   ├── main.py                 # FastAPI endpoints & lifecycles
│   ├── schemas.py              # Pydantic data contracts
│   ├── pipeline/
│   │   ├── extractor.py        # PDF & TXT text extraction
│   │   ├── chunker.py          # Sentence tokenizer & chunking
│   │   ├── vector_store.py     # ChromaDB workspace collections
│   │   ├── nli.py              # Dynamic NLI label classifier
│   │   └── checker.py          # Hallucination scoring pipeline
│   └── tests/                  # Pytest verification suite
├── server/                     # Node.js + Express Backend
│   ├── Dockerfile              # Multi-stage TypeScript build
│   ├── src/
│   │   ├── config/             # DB & Zod environment validation
│   │   ├── models/             # Mongoose schemas (User, Workspace, ApiKey, CheckResult, etc.)
│   │   ├── middleware/         # Auth, workspace RBAC, rate limiting, error handling
│   │   ├── routes/             # Auth, workspaces, documents, API keys, checks, analytics
│   │   └── services/           # AI service client & quota tracking
└── client/                     # Next.js 14 Web Dashboard
    ├── Dockerfile              # Standalone non-root runner
    ├── src/app/                # App Router pages & API routes
    └── tailwind.config.js      # Design system & tokens
```

---

## 📄 License
MIT License. Built for enterprise reliability and source-grounded AI confidence.
