# Contributor Setup Guide 🛠️

Welcome to **TrustLayer AI**! This guide walks you through setting up your local development environment step-by-step, whether you prefer running everything in Docker with live hot-reloading or running microservices natively on your machine.

---

## 📋 System Prerequisites

Before starting, ensure you have the following installed:

- **Git** (v2.30+)
- **Docker Desktop** (v24.0+) or **Docker Engine** with **Docker Compose v2**
- *(Optional, for native development without Docker)*:
  - **Node.js** v20 LTS & **npm** v10+
  - **Python** 3.11+ & **pip**
  - **MongoDB** Community Server v7.0+

> [!NOTE]
> **Hardware Recommendation:** The AI service downloads and loads the HuggingFace `cross-encoder/nli-deberta-v3-small` model (~280 MB). We recommend having at least **4 GB of free RAM** and **5 GB of free disk space**.

---

## ⚡ Method A: Docker Dev Environment (Recommended)

This is the fastest and most consistent setup. All services (Next.js frontend, Express backend, FastAPI AI engine, MongoDB, and ChromaDB) run with live code reloading when you edit files.

### 1. Fork & Clone Repository
```bash
git clone https://github.com/<your-username>/TrustLayer-AI.git
cd TrustLayer-AI
```

### 2. Configure Environment Variables
Copy the default development environment variables:
```bash
cp .env.example .env
```
*(The default `.env.example` is fully pre-configured to work out of the box with zero external accounts or payment keys required).*

Optionally, tune how strictly claims are judged with the "Verification Tuning" variables in `.env.example` (for example `SUPPORTED_THRESHOLD`). With the dev compose file, add them under the `ai-service` `environment:` list in `docker-compose.dev.yml`.

### 3. Spin Up Development Containers
Use the dedicated development compose file which mounts local source code directories for live hot-reloading:
```bash
docker compose -f docker-compose.dev.yml up --build
```

### 4. Seed Sample Workspace & Test Data
In a new terminal window, populate your database with ready-to-test workspace records, sample enterprise documents, and historical verification checks:
```bash
docker compose -f docker-compose.dev.yml exec server npm run seed
```

### 5. Access Your Local Services
| Service | URL / Port | Description |
|---|---|---|
| **Web Dashboard** | [http://localhost:3000](http://localhost:3000) | Next.js 14 App Router UI |
| **Backend REST API** | [http://localhost:5001/api](http://localhost:5001/api) | Express + TypeScript SaaS API |
| **AI Engine Docs** | [http://localhost:8001/docs](http://localhost:8001/docs) | FastAPI interactive Swagger docs |
| **AI Engine Health** | [http://localhost:8001/health](http://localhost:8001/health) | NLI model & ChromaDB status |
| **MongoDB** | `localhost:27017` | Database instance |

### 6. Sign In with Demo Credentials
- **URL:** [http://localhost:3000/login](http://localhost:3000/login)
- **Email:** `demo@trustlayer.ai`
- **Password:** `Password123!`

---

## 💻 Method B: Native Local Setup (Without Full Docker)

If you prefer running individual services directly on your host machine (e.g., using your local Node and Python runtimes):

### Step 1: Start MongoDB
You can run standalone MongoDB using Docker:
```bash
docker run -d --name trustlayer-mongo -p 27017:27017 -v mongo_data:/data/db mongo:7.0
```

### Step 2: Set Up AI Service (FastAPI + Python)
1. Open a terminal and navigate to `ai-service`:
   ```bash
   cd ai-service
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate    # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```
4. Pre-download the NLI model (optional but recommended):
   ```bash
   python download_model.py
   ```
5. Start the AI service with live reload:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8001 --reload
   ```

### Step 3: Set Up Backend Server (Express + TypeScript)
1. In a new terminal window, navigate to `server`:
   ```bash
   cd server
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Seed the database with demo accounts:
   ```bash
   npm run seed
   ```
4. Start the backend development server:
   ```bash
   npm run dev
   ```
   *(Server starts on `http://localhost:5001`)*

### Step 4: Set Up Frontend Client (Next.js 14)
1. In a new terminal window, navigate to `client`:
   ```bash
   cd client
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js dev server:
   ```bash
   npm run dev
   ```
   *(Frontend starts on `http://localhost:3000`)*

---

## 🧪 Running Tests & Validations

Before submitting a Pull Request, verify your changes pass all tests and type checks:

### 1. Test AI Pipeline (Pytest)
```bash
# In Docker:
docker compose -f docker-compose.dev.yml exec ai-service pytest tests/ -v

# Or natively:
cd ai-service && pytest tests/ -v
```

### 2. Backend TypeScript Compilation
```bash
# In Docker:
docker compose -f docker-compose.dev.yml exec server npm run build

# Or natively:
cd server && npm run build
```

### 3. Frontend Next.js Build & Lint
```bash
# In Docker:
docker compose -f docker-compose.dev.yml exec client npm run build

# Or natively:
cd client && npm run build
```

---

## 🔍 Verifying the End-to-End Pipeline

To confirm that the complete pipeline works end-to-end:

1. Log into the dashboard at [http://localhost:3000/login](http://localhost:3000/login).
2. Go to **Documents** (`/documents`) and verify that seeded documents (or a test `.txt`/`.pdf` file) are indexed with status `indexed`.
3. Go to **Verify Answer** (`/check`).
4. Enter:
   - **Question:** `What are the tiers offered by TrustLayer?`
   - **Answer:** `TrustLayer offers a Free tier with 100 checks and a Pro tier with 5,000 checks.`
5. Click **Run Verification**.
6. You should see a green `SUPPORTED` claim verdict with source sentences highlighted from the document knowledge base.

---

## ❓ Common Troubleshooting & FAQ

### Port Already in Use (e.g. 3000, 5001, 8001, 27017)
If a local service is already using one of these ports, identify and terminate the process:
```bash
# On macOS / Linux
lsof -i :3000
kill -9 <PID>
```
Or edit the host port mappings in `docker-compose.dev.yml`.

### Docker Model Download Taking Time
On the first container startup, `ai-service` downloads `cross-encoder/nli-deberta-v3-small` from Hugging Face. The model is saved to the persistent Docker volume `model_cache_dev`, so subsequent launches will start instantly without re-downloading.

### Resetting the Database & Starting Fresh
If you want to wipe the local database and re-seed from scratch:
```bash
# Stop containers and remove volumes
docker compose -f docker-compose.dev.yml down -v

# Re-launch and re-seed
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml exec server npm run seed
```

---

## 🤝 Next Steps
- Pick an issue labeled [`good-first-issue`](https://github.com/sabeenaviklar/TrustLayer-AI/labels/good-first-issue) or check the levels in [CONTRIBUTING.md](CONTRIBUTING.md).
- Create a feature branch: `git checkout -b feature/my-feature-name`.
- Have questions? Feel free to ask directly in your issue thread!
