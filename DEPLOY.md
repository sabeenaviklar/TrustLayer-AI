# TrustLayer Production Deployment Guide

This guide details how to deploy **TrustLayer** to a fresh Ubuntu Linux server (DigitalOcean Droplet, AWS EC2, Hetzner, Linode, or any VPS) using Docker Compose and Nginx with free automated SSL certificates (Let's Encrypt / Certbot).

---

## 1. Recommended Server Specifications

- **OS:** Ubuntu 22.04 LTS or Ubuntu 24.04 LTS
- **CPU:** 2 vCPU or higher (required for efficient CPU PyTorch NLI inference)
- **RAM:** 4 GB RAM minimum (8 GB recommended for concurrent batch verification)
- **Disk:** 25 GB SSD or NVMe
- **Domain:** A registered domain name with an `A` record pointing to your server's public IP address (e.g. `trustlayer.yourcompany.com`).

---

## 2. Server Initial Setup & Docker Installation

SSH into your clean Ubuntu server as `root` or a user with `sudo` privileges:

```bash
ssh root@YOUR_SERVER_IP
```

### Update system packages:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw ca-certificates
```

### Configure Firewall (UFW):
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
```

### Install Docker Engine & Docker Compose Plugin:
```bash
# Add Docker's official GPG key & repository
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

---

## 3. Clone Repository & Configure Environment

Clone the repository into your deployment folder (e.g., `/opt/trustlayer`):

```bash
sudo git clone https://github.com/sabeenaviklar/TrustLayer-AI.git /opt/trustlayer
cd /opt/trustlayer
```

### Generate Production Secrets:
Create your production `.env` file from the example:
```bash
cp .env.example .env
```

Generate a secure random string for `JWT_SECRET`:
```bash
openssl rand -hex 32
```

Edit your `.env` file:
```bash
nano .env
```

Ensure the following variables are configured:
```ini
# Environment
NODE_ENV=production

# Security - Paste the generated secret here
JWT_SECRET=paste_your_generated_64_character_hex_secret_here
JWT_EXPIRES_IN=7d

# Ports
PORT=5001
AI_SERVICE_PORT=8001

# Database & AI Service (Internal Docker Network)
MONGO_URI=mongodb://mongo:27017/trustlayer
AI_SERVICE_URL=http://ai-service:8001

# Storage
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE_MB=25

# Billing & Payments (Razorpay)
# In production, paste your live or test keys from dashboard.razorpay.com
RAZORPAY_KEY_ID=rzp_test_your_real_key_here
RAZORPAY_KEY_SECRET=your_real_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here

# AI Pipeline Model
NLI_MODEL=cross-encoder/nli-deberta-v3-small
EMBEDDING_MODEL=all-MiniLM-L6-v2
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

---

## 4. Launching the Application

Build and start all 5 containers in detached daemon mode:

```bash
docker compose up --build -d
```

### Check Container Status:
```bash
docker compose ps
```
All containers should display state `healthy` or `running`:
- `trustlayer-mongo`
- `trustlayer-ai-service`
- `trustlayer-server`
- `trustlayer-client`
- `trustlayer-nginx`

### Seed Demo Account & Documents:
Run the seeder once inside the server container:
```bash
docker compose exec server npm run seed
```

This creates the initial admin user:
- **Email:** `demo@trustlayer.ai`
- **Password:** `Password123!`

You can now open `http://YOUR_SERVER_IP` in your browser and log in!

---

## 5. SSL & Domain Configuration (HTTPS)

To configure your custom domain with a free Let's Encrypt SSL certificate:

### Step 1: Install Certbot on the Host:
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Step 2: Stop temporary Nginx to release port 80:
```bash
docker compose stop nginx
```

### Step 3: Obtain SSL Certificate:
Replace `trustlayer.yourcompany.com` with your real domain:
```bash
sudo certbot certonly --standalone -d trustlayer.yourcompany.com --non-interactive --agree-tos -m admin@yourcompany.com
```

Your certificates will be stored at:
`/etc/letsencrypt/live/trustlayer.yourcompany.com/fullchain.pem`
`/etc/letsencrypt/live/trustlayer.yourcompany.com/privkey.pem`

### Step 4: Mount Certificates into Nginx:
Create an SSL mount in `docker-compose.yml` under the `nginx` service:
```yaml
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

Update `/opt/trustlayer/nginx/nginx.conf` with your domain:
```nginx
server {
    listen 80;
    server_name trustlayer.yourcompany.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name trustlayer.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/trustlayer.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/trustlayer.yourcompany.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location /api/ {
        proxy_pass http://server:5001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / {
        proxy_pass http://client:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

### Step 5: Start Nginx:
```bash
docker compose up -d nginx
```

---

## 6. Backups & Maintenance

### Database Backup (MongoDB):
Run this command on your host or in a daily cron job:
```bash
docker compose exec -T mongo mongodump --db trustlayer --archive > /opt/trustlayer_backup_$(date +%F).archive
```

### Database Restore:
```bash
cat /opt/trustlayer_backup_2026-10-03.archive | docker compose exec -T mongo mongorestore --archive --drop
```

### Viewing Logs:
```bash
# View combined live logs
docker compose logs -f

# View specific service logs
docker compose logs -f ai-service
docker compose logs -f server
```

### Updating to the Latest Version:
```bash
cd /opt/trustlayer
git pull origin main
docker compose up --build -d
```

---

## 7. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `ai-service` exited with code 137 | Server ran out of memory downloading or running PyTorch | Ensure server has at least 4 GB RAM or enable a 2 GB swap file (`sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`) |
| `502 Bad Gateway` on `/api` | Server container is still booting or MongoDB connection failed | Check `docker compose logs server` |
| `EACCES: permission denied, mkdir '/app/uploads'` | Non-root container permissions | Verify that `server/Dockerfile` has `chown -R node:node /app` |
| Upload size error | File exceeded limit | Increase `MAX_FILE_SIZE_MB` in `.env` and `client_max_body_size` in `nginx/nginx.conf` |
