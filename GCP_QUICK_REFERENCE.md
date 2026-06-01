# GCP Deployment Quick Reference

## GCP Resources Summary

| Resource | Purpose | Cost | Notes |
|----------|---------|------|-------|
| **Cloud Run** | Backend (Flask) | $0.40/1M requests + $0.00001667/GB-sec | Serverless, auto-scaling |
| **Cloud SQL** | PostgreSQL Database | ~$13-15/month | db-f1-micro tier, hourly billing |
| **Firebase Hosting** | Frontend (Static) | Free | Global CDN, auto HTTPS |
| **Container Registry** | Docker images | Free (first 1GB/month) | Store Docker images |
| **Cloud Build** | CI/CD | Free (120 min/day) | Auto-deploy on Git push |

---

## Resources Needed (Architecture Diagram)

```
┌────────────────────────────────────────────┐
│         Your Custom Domain (Optional)      │
└────────────┬─────────────────────────────────┘
             │
     ┌───────┴────────┐
     │                │
┌────V──────┐    ┌───V──────────────┐
│ Firebase  │    │   Cloud Run      │
│ Hosting   │    │   (Backend)      │
│           │    │                  │
│- Static   │    │- Flask App       │
│- CDN      │    │- gunicorn        │
│- HTTPS    │    │- Auto-scale      │
└───────────┘    └────────┬─────────┘
                          │
                     ┌────V──────────┐
                     │  Cloud SQL    │
                     │ PostgreSQL    │
                     │               │
                     │- 9.5GB free   │
                     │- Auto backup  │
                     │- SSL/TLS      │
                     └───────────────┘
```

---

## Quick Setup Commands

### 1. Initialize Project
```bash
export PROJECT_ID="my-task-app"
gcloud projects create $PROJECT_ID
gcloud config set project $PROJECT_ID

# Enable APIs
gcloud services enable run.googleapis.com sqladmin.googleapis.com \
  containerregistry.googleapis.com firebase.googleapis.com
```

### 2. Create Database
```bash
gcloud sql instances create task-db \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=us-central1

gcloud sql databases create taskdb --instance=task-db
```

### 3. Deploy Backend
```bash
cd backend

# Build & push Docker image
docker build -t gcr.io/$PROJECT_ID/task-backend .
docker push gcr.io/$PROJECT_ID/task-backend

# Deploy to Cloud Run
gcloud run deploy task-backend \
  --image gcr.io/$PROJECT_ID/task-backend \
  --set-env-vars DATABASE_URL=<YOUR_DATABASE_URL>,SECRET_KEY=<YOUR_SECRET> \
  --region us-central1
```

### 4. Deploy Frontend
```bash
cd ../frontend

firebase init hosting
firebase deploy
```

---

## Environment Variables to Set

### For Cloud Run Backend

```
DATABASE_URL=postgresql://user:password@/database?host=/cloudsql/PROJECT:REGION:INSTANCE
SECRET_KEY=<generate-random-string>
PORT=8080
```

**Get DATABASE_URL:**
```bash
gcloud sql instances describe task-db --format='value(connectionName)'
# Format: GCP_PROJECT:REGION:INSTANCE_NAME
```

---

## Monitoring URLs

### View Services
```bash
# List Cloud Run services
gcloud run services list

# Get service URL
gcloud run services describe task-backend --region us-central1 --format='value(status.url)'

# View database
gcloud sql instances list

# View Firebase apps
firebase apps:list
```

---

## Common Issues & Solutions

### Issue: Docker image won't push
```bash
# Ensure Docker daemon is running
docker ps

# Configure Docker authentication
gcloud auth configure-docker

# Then push again
docker push gcr.io/$PROJECT_ID/task-backend
```

### Issue: Cloud Run can't connect to database
```bash
# Check Cloud SQL Admin API is enabled
gcloud services list | grep sqladmin

# Grant permissions
gcloud run services update task-backend \
  --set-cloudsql-instances PROJECT:REGION:INSTANCE
```

### Issue: Frontend can't reach backend
```bash
# Update CORS in app.py with Firebase URL
# Redeploy backend
gcloud run deploy task-backend --source backend
```

### Issue: 403 Forbidden on Cloud Run
```bash
# Make Cloud Run service public (if needed)
gcloud run services add-iam-policy-binding task-backend \
  --member=allUsers \
  --role=roles/run.invoker
```

---

## Scaling Configuration

### For Increased Traffic

**Update Cloud Run:**
```bash
gcloud run services update task-backend \
  --max-instances=100 \
  --memory=1Gi \
  --cpu=2
```

**Update Cloud SQL (if needed):**
```bash
gcloud sql instances patch task-db \
  --tier=db-n1-standard-1
```

---

## Backup & Restore

### Backup Cloud SQL
```bash
gcloud sql backups create \
  --instance=task-db \
  --description="Manual backup"

# List backups
gcloud sql backups list --instance=task-db
```

### Export Database
```bash
gcloud sql export sql task-db gs://your-bucket/backup.sql \
  --database=taskdb
```

---

## Cost Optimization Tips

1. **Use db-f1-micro** for small apps (~$13/month)
2. **Cloud Run auto-scales down** when not in use
3. **Firebase free tier** for static hosting
4. **Set up budget alerts** in GCP Console
5. **Enable Cloud SQL backups** (auto or manual)
6. **Use Cloud CDN** if high traffic

---

## Useful Links

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [Firebase Hosting](https://firebase.google.com/docs/hosting)
- [GCP Pricing Calculator](https://cloud.google.com/products/calculator)
- [Cloud SDK CLI Reference](https://cloud.google.com/sdk/gcloud/reference)

---

## Pre-Deployment Checklist

- [ ] GCP Project created
- [ ] Billing account configured
- [ ] All APIs enabled
- [ ] Cloud SQL instance created
- [ ] Docker image built & tested
- [ ] DATABASE_URL format verified
- [ ] Backend deployed to Cloud Run
- [ ] Frontend deployed to Firebase
- [ ] API URL updated in frontend
- [ ] CORS configured
- [ ] Custom domain set (optional)


