# GCP Deployment Guide for Task Management App

## GCP Resources Required

### 1. **Cloud Run** (Backend)
- **Purpose:** Run your Flask backend application
- **Why:** Serverless, auto-scaling, pay-per-request pricing, no infrastructure management
- **Cost:** Free tier: 2 million requests/month
- **Custom Domain:** Optional but recommended
- **Container Registry:** Store Docker images

### 2. **Cloud SQL** (Database)
- **Purpose:** Managed PostgreSQL database
- **Why:** Fully managed, automatic backups, high availability options
- **Cost:** Pay-per-hour (small instances ~$10-15/month)
- **Features:** Automatic patching, backups, SSL connections
- **Instance:** PostgreSQL 14+ recommended

### 3. **Firebase Hosting** (Frontend) - RECOMMENDED
- **Purpose:** Host static frontend files
- **Why:** Free tier included, fast CDN, automatic SSL/TLS, easy deployment
- **Cost:** Free for most projects
- **Features:** Global CDN, automatic HTTPS, preview channels

### ALTERNATIVE: Cloud Storage + Cloud CDN (Frontend)
- If you prefer manual control over hosting

### 4. **Artifact Registry** (Optional but Recommended)
- **Purpose:** Store Docker container images
- **Cost:** Free tier for many images
- **Alternative:** Docker Hub (free)

### 5. **Cloud Build** (Optional but Recommended)
- **Purpose:** Automated CI/CD pipeline
- **Cost:** Free tier: 120 build-minutes/day
- **Features:** Auto-deploy on GitHub push

---

## Cost Estimate (Monthly - US Region)

| Resource | Tier | Cost |
|----------|------|------|
| Cloud Run | Free Tier | $0 (2M requests/month) |
| Cloud SQL PostgreSQL | db-f1-micro | $13-15 |
| Firebase Hosting | Free Tier | $0 |
| Data Transfer | Free | $0 |
| **Total** | | **$13-15/month** |

---

## Recommended Architecture

```
┌─────────────────────┐
│    Frontend         │
│ (Firebase Hosting)  │
└──────────┬──────────┘
           │ HTTPS
┌──────────V──────────┐
│    Cloud Run        │
│  (Flask Backend)    │
└──────────┬──────────┘
           │ Private IP
┌──────────V──────────┐
│   Cloud SQL         │
│  (PostgreSQL)       │
└─────────────────────┘
```

---

## Deployment Steps Overview

### Phase 1: Prepare Your Backend
1. Create `Dockerfile` for Flask app
2. Update `app.py` to read environment variables
3. Push code to GitHub

### Phase 2: Set up GCP Project
1. Create GCP project
2. Enable required APIs
3. Create Cloud SQL instance
4. Configure environment variables

### Phase 3: Deploy Backend
1. Create Docker image
2. Deploy to Cloud Run

### Phase 4: Deploy Frontend
1. Update API URLs
2. Deploy to Firebase Hosting

---

## What You Need to Get Started

1. **GCP Account** (Free tier: $300 credit)
2. **Docker** installed locally (for testing)
3. **gcloud CLI** installed
4. **GitHub repository** with your code
5. **Firebase CLI** (for frontend deployment)


