# TrustLayer 🛡️

> **Enterprise open-source SaaS platform that verifies whether AI-generated answers are grounded in company reference documents and detects hallucinations in real time.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker Ready](https://img.shields.io/badge/Docker-Multi--Container-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![CI Workflow](https://img.shields.io/badge/CI-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)](.github/workflows/ci.yml)
[![FastAPI](https://img.shields.io/badge/AI%20Service-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Express](https://img.shields.io/badge/Backend-Express%20%2B%20TypeScript-black?logo=node.js&logoColor=white)](https://expressjs.com/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![ChromaDB](https://img.shields.io/badge/Vector%20Store-ChromaDB-purple)](https://www.trychroma.com/)
[![Model](https://img.shields.io/badge/NLI%20Model-DeBERTa--v3-orange)](https://huggingface.co/cross-encoder/nli-deberta-v3-small)

---

## 📖 Overview

As Large Language Models (LLMs) are deployed into production customer support, healthcare, finance, and legal workflows, **hallucinations pose a critical business risk**. 

**TrustLayer** is an end-to-end open-source solution that validates LLM responses against your enterprise source-of-truth documents. Teams upload reference documents (PDFs, Markdown, plain text), then submit `(prompt, answer)` pairs through our web dashboard or low-latency REST API.

The pipeline:
1. **Partitions** the generated AI answer into discrete testable claims at sentence level.
2. **Retrieves** the most semantically relevant evidence passages from isolated per-workspace ChromaDB vector collections.
3. **Classifies** each individual claim using Natural Language Inference (NLI) cross-encoders into:
   - 🟢 **`SUPPORTED`** (Entailment): Directly verified by cited source text.
   - 🔴 **`CONTRADICTED`** (Contradiction): Directly conflicts with verified source text (Hallucination).
   - ⚪ **`UNVERIFIABLE`** (Neutral / Out-of-Domain): Cannot be verified from current knowledge base.
4. **Highlights** the exact supporting sentence from the source document with confidence scores.
5. **Calculates** an overall 0–100 reliability score and tracks organizational hallucination trends over time.

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
      │  Next.js Frontend  │                    │   Express Server   │ (Node 20 + TS, Port 5001)
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

---

## ⚡ 1-Minute Quickstart

Run TrustLayer locally or on any server with a single command:

### 1. Clone & Configure Environment
```bash
git clone https://github.com/sabeenaviklar/TrustLayer-AI.git
cd TrustLayer-AI

# Copy safe default environment configuration
cp .env.example .env
```

### 2. Launch All Microservices
```bash
docker compose up --build -d
```
All containers will build and start with automated healthchecks:
- **Web Dashboard:** [http://localhost](http://localhost)
- **REST API:** [http://localhost/api](http://localhost/api)
- **AI Engine Health:** [http://localhost:8001/health](http://localhost:8001/health)

### 3. Seed Demo Data & Accounts
Populate your instance with a ready-to-test workspace, pre-ingested reference documents, and historical verification checks:
```bash
docker compose exec server npm run seed
```

Now open [http://localhost/login](http://localhost/login) in your browser:
- **Email:** `demo@trustlayer.ai`
- **Password:** `Password123!`

---

## 💳 Usage Limits & Razorpay Billing

TrustLayer includes built-in multi-tenant subscription tiers and usage enforcement:
- **Free Tier:** 100 verification checks / month (default).
- **Pro Tier:** 5,000 verification checks / month, priority DeBERTa-v3 inference, team collaboration, and API key access.
- **Razorpay Sandbox / Mock Mode:** Runs out of the box with zero external payment credentials required. Simply click **"Upgrade to Pro"** on the dashboard or `/billing` to simulate an instant upgrade.
- **Production Payments:** Provide your live or test `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `.env` to process real credit card, UPI, and net banking transactions.

---

## 🚀 Public Developer API

TrustLayer allows developers to integrate hallucination verification directly into their LLM inference pipelines (e.g. LangChain, LlamaIndex, OpenAI, Anthropic).

### Verify an Answer via cURL
```bash
curl -X POST http://localhost/api/v1/check \
  -H "Content-Type: application/json" \
  -H "X-API-Key: tl_live_your_api_key_here" \
  -d '{
    "question": "Where is TrustLayer located and what plans are offered?",
    "answer": "TrustLayer is headquartered in San Francisco, California. The platform offers a Free plan with 100 checks and a Pro plan with 5,000 checks per month."
  }'
```

### Sample JSON Response
```json
{
  "success": true,
  "data": {
    "overallVerdict": "SUPPORTED",
    "reliabilityScore": 98.5,
    "totalClaims": 2,
    "supportedCount": 2,
    "contradictedCount": 0,
    "unverifiableCount": 0,
    "claims": [
      {
        "claim": "TrustLayer is headquartered in San Francisco, California.",
        "verdict": "SUPPORTED",
        "confidence": 0.99,
        "evidenceSentence": "TrustLayer is an enterprise AI safety and compliance SaaS platform founded in 2024 and headquartered in San Francisco, California.",
        "scores": {
          "entailment": 0.992,
          "contradiction": 0.003,
          "neutral": 0.005
        }
      }
    ]
  },
  "error": null
}
```

---

## 🛠️ Testing & Quality Assurance

### Run AI Pipeline Pytest Suite
```bash
docker compose exec ai-service pytest tests/ -v
```

### Run Backend Build
```bash
docker compose exec server npm run build
```

### Run Frontend Build
```bash
docker compose exec client npm run build
```

---

## 🚢 Production Deployment

For complete instructions on deploying to an Ubuntu VPS, configuring DNS, and setting up automated Let's Encrypt SSL HTTPS certificates with Certbot:

👉 **[Read the Production Deployment Guide (DEPLOY.md)](DEPLOY.md)**

---

## 🤝 Contributing

We welcome open-source contributions! Please read our **[Contributing Guidelines (CONTRIBUTING.md)](CONTRIBUTING.md)** and review our **[Code of Conduct (CODE_OF_CONDUCT.md)](CODE_OF_CONDUCT.md)** before opening a Pull Request.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) - feel free to use and adapt for commercial or personal applications.
