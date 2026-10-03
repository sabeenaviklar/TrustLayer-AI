# Contributing to TrustLayer AI

Thank you for your interest in contributing to **TrustLayer**! We are building the open-source standard for AI truth grounding and automated hallucination verification.

Whether you are fixing a typo, improving NLI accuracy, adding a vector database integration, or designing new UI components, your contributions are welcome.

---

## Code of Conduct

This project adheres to the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to `security@trustlayer.ai`.

---

## Development Setup

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose (v2.20+)
- [Node.js](https://nodejs.org/) v20+ (optional, for running outside containers)
- [Python](https://www.python.org/) 3.11+ (optional, for local model experimentation)
- Git

### 1. Fork & Clone
```bash
git clone https://github.com/<your-username>/TrustLayer-AI.git
cd TrustLayer-AI
git checkout -b feature/my-new-feature
```

### 2. Environment Configuration
```bash
cp .env.example .env
```
*(The defaults in `.env.example` are pre-configured to work out of the box with zero external accounts required).*

### 3. Start All Services with Docker Compose
```bash
docker compose up --build -d
```
All 5 microservices will spin up:
- **Client (Next.js):** http://localhost
- **Backend API (Express):** http://localhost/api
- **AI Service (FastAPI):** http://localhost:8001
- **MongoDB:** `localhost:27017`
- **ChromaDB:** embedded in `ai-service` volume

### 4. Seed Demo Data
To populate a complete demo workspace with sample documents and check history:
```bash
docker compose exec server npm run seed
```
You can now log in at `http://localhost/login` with:
- **Email:** `demo@trustlayer.ai`
- **Password:** `Password123!`

---

## Running Tests

### AI Service Tests (FastAPI + NLI + ChromaDB)
```bash
docker compose exec ai-service pytest -v
```

### Backend Typecheck & Build
```bash
docker compose exec server npm run build
```

### Frontend Typecheck & Build
```bash
docker compose exec client npm run build
```

---

## Architecture Overview

TrustLayer is organized as a modular microservices monorepo:

```
├── ai-service/          # Python 3.11 FastAPI service
│   ├── pipeline/        # Sentence chunker, ChromaDB store, DeBERTa NLI checker
│   └── tests/           # Pytest test suite
├── server/              # Node.js 20 + Express + TypeScript SaaS API
│   ├── src/models/      # Mongoose schemas (Workspace, CheckResult, ApiKey, etc.)
│   ├── src/routes/      # Express routes (Auth, Documents, Check, Billing, Team)
│   └── src/services/    # AI client, Usage limits, Razorpay sandbox
├── client/              # Next.js 14 App Router + Tailwind CSS
│   ├── src/app/         # Next.js pages (Landing, Dashboard, Check, Billing, Docs)
│   └── src/components/  # UI components, MetricCards, ClaimBreakdown
├── nginx/               # Production reverse proxy routing client & API
└── docker-compose.yml   # Production container orchestration
```

---

## Pull Request Guidelines

1. **Keep PRs focused:** Submit smaller, focused pull requests addressing a single bug or feature.
2. **Write tests:** Ensure all tests pass before submitting.
3. **Follow commit conventions:**
   - `feat: add Pinecone vector store adapter`
   - `fix: correct regex pattern for decimal numbers in sentence chunker`
   - `docs: update DEPLOY.md with Let's Encrypt instructions`
   - `refactor: optimize claim scoring threshold`
4. **Link issues:** Reference related issues in the PR description (e.g., `Fixes #12`).

---

## Security

If you discover a security vulnerability within TrustLayer, please send an email to `security@trustlayer.ai`. Please do NOT open public issues for sensitive vulnerabilities.
