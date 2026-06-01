# Step-by-Step GCP Deployment Guide

## Prerequisites

Before starting, ensure you have:

1. **GCP Account** with billing enabled
   - Sign up at: https://cloud.google.com
   - Free $300 credit for new users (12 months)

2. **Install gcloud CLI**
   ```bash
   # macOS
   brew install --cask google-cloud-sdk
   
   # Then initialize
   gcloud init
   gcloud auth login
   ```

3. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

4. **Docker installed** (for testing locally)
   ```bash
   brew install docker  # or Docker Desktop
   ```

5. **GitHub repository** with your code pushed

---

## Step 1: Create GCP Project

```bash
# Set project name
export PROJECT_ID="task-app-$(date +%s)"

# Create project
gcloud projects create $PROJECT_ID --name="Task Management App"

# Set as current project
gcloud config set project $PROJECT_ID

# Enable billing (requires manual setup in Console)
# Go to: https://console.cloud.google.com/billing
```

---

## Step 2: Enable Required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sql-component.googleapis.com \
  sqladmin.googleapis.com \
  compute.googleapis.com \
  containerregistry.googleapis.com \
  cloudbuild.googleapis.com \
  firebase.googleapis.com
```

---

## Step 3: Create Cloud SQL PostgreSQL Database

```bash
# Set variables
export DB_INSTANCE="task-db"
export DB_PASSWORD=$(openssl rand -base64 32)
export DB_USER="postgres"

# Create Cloud SQL instance
gcloud sql instances create $DB_INSTANCE \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --availability-type=REGIONAL \
  --enable-bin-log

# Set root password
gcloud sql users set-password postgres \
  --instance=$DB_INSTANCE \
  --password=$DB_PASSWORD

# Create application database
gcloud sql databases create taskdb \
  --instance=$DB_INSTANCE

# Create application user
gcloud sql users create taskuser \
  --instance=$DB_INSTANCE \
  --password=$(openssl rand -base64 32)

# Get connection details
gcloud sql instances describe $DB_INSTANCE \
  --format='value(connectionName)'
```

---

## Step 4: Deploy Backend to Cloud Run

### Option A: Using gcloud CLI (Simple)

```bash
# Set variables
export REGION="us-central1"
export SERVICE_NAME="task-backend"
export DB_CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE --format='value(connectionName)')
export SECRET_KEY=$(openssl rand -base64 32)

# Create .env file with secrets
cat > backend/.env.production << EOF
DATABASE_URL=postgresql://taskuser:PASSWORD@/$DB_NAME?host=/cloudsql/$DB_CONNECTION_NAME
SECRET_KEY=$SECRET_KEY
PORT=8080
EOF

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
  --source backend \
  --region $REGION \
  --platform managed \
  --memory 512Mi \
  --cpu 1 \
  --timeout 3600 \
  --set-env-vars DATABASE_URL=postgresql://taskuser:PASSWORD@/$DB_NAME?host=/cloudsql/$DB_CONNECTION_NAME,SECRET_KEY=$SECRET_KEY \
  --no-allow-unauthenticated

# Get service URL
gcloud run services describe $SERVICE_NAME --region $REGION --format='value(status.url)'
```

### Option B: Using Docker Locally First (Recommended)

```bash
# Build Docker image locally
cd backend
docker build -t task-backend:latest .

# Test it locally
docker run -p 5000:8080 \
  -e DATABASE_URL="sqlite:///tasks.db" \
  -e SECRET_KEY="test-key" \
  task-backend:latest

# Push to Google Container Registry
docker tag task-backend:latest gcr.io/$PROJECT_ID/task-backend:latest
docker push gcr.io/$PROJECT_ID/task-backend:latest

# Deploy from Container Registry
gcloud run deploy task-backend \
  --image gcr.io/$PROJECT_ID/task-backend:latest \
  --region us-central1 \
  --platform managed \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars DATABASE_URL=$DATABASE_URL,SECRET_KEY=$SECRET_KEY \
  --no-allow-unauthenticated
```

---

## Step 5: Configure Cloud Run with Cloud SQL

```bash
# Get the Cloud Run service account
gcloud iam service-accounts list --filter="email~cloudrun"

# Grant Cloud SQL Client role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member=serviceAccount:PROJECT_ID-compute@developer.gserviceaccount.com \
  --role=roles/cloudsql.client

# Enable Cloud Run to communicate with Cloud SQL
gcloud run services update task-backend \
  --region us-central1 \
  --set-cloudsql-instances=$DB_CONNECTION_NAME
```

---

## Step 6: Deploy Frontend to Firebase Hosting

### 6.1 Initialize Firebase

```bash
cd ../frontend

# Initialize Firebase
firebase init hosting

# When prompted:
# - Select your GCP project
# - Use current directory as public directory
# - Don't configure as single-page app (yet)
```

### 6.2 Update API URL in Frontend

```bash
# Get your Cloud Run backend URL
export BACKEND_URL=$(gcloud run services describe task-backend \
  --region us-central1 \
  --format='value(status.url)')

# Update app.js with the backend URL
sed -i "" "s|const API_URL = .*|const API_URL = '$BACKEND_URL';|g" app.js
```

### 6.3 Deploy to Firebase Hosting

```bash
firebase deploy --only hosting

# Get your hosting URL
firebase apps:list
```

---

## Step 7: Enable CORS on Cloud Run

If you get CORS errors, update your backend:

**Edit backend/app.py:**

```python
from flask_cors import CORS

CORS(app, resources={
    r"/*": {
        "origins": ["https://YOUR-FIREBASE-DOMAIN.web.app"],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
```

Then redeploy:
```bash
gcloud run deploy task-backend --source backend --region us-central1
```

---

## Step 8: Set Up Custom Domain (Optional)

### For Backend (Cloud Run):
```bash
gcloud run domain-mappings create \
  --service=task-backend \
  --domain=api.yourdomain.com \
  --region=us-central1
```

### For Frontend (Firebase):
1. Go to Firebase Console
2. Hosting → Domain Settings
3. Add custom domain and verify DNS records

---

## Monitoring & Logs

```bash
# View Cloud Run logs
gcloud run services describe task-backend --region us-central1

# Stream logs
gcloud logging read "resource.type=cloud_run_revision" --limit 50 --format json

# Monitor Cloud SQL
gcloud sql instances describe $DB_INSTANCE

# View database connections
gcloud sql operations list --instance=$DB_INSTANCE
```

---

## Cost Management

```bash
# View current usage
gcloud compute project-info describe --project=$PROJECT_ID

# Set up budget alerts
# Go to: https://console.cloud.google.com/billing/budgets
```

---

## Troubleshooting

### Issue: "Container failed to start"
```bash
# Check logs
gcloud logging read "resource.type=cloud_run_revision" --limit 10 --format=text

# Verify DATABASE_URL format:
# postgresql://user:password@host/database
```

### Issue: "Connection refused" to database
```bash
# Ensure Cloud SQL Admin API is enabled
gcloud services enable sqladmin.googleapis.com

# Check service account permissions
gcloud projects get-iam-policy $PROJECT_ID
```

### Issue: CORS errors
```bash
# Update CORS in Flask app and redeploy
gcloud run deploy task-backend --source backend --region us-central1
```

---

## Complete Checklist

- [ ] GCP Account created with billing
- [ ] gcloud CLI installed and authenticated
- [ ] APIs enabled (Run, SQL, Cloud Build, etc.)
- [ ] Cloud SQL PostgreSQL instance created
- [ ] Docker image built and tested locally
- [ ] Backend deployed to Cloud Run
- [ ] Firebase project initialized
- [ ] Frontend API URL updated
- [ ] Frontend deployed to Firebase Hosting
- [ ] CORS configured
- [ ] Environment variables set
- [ ] Custom domains added (optional)
- [ ] Monitoring configured
- [ ] Budget alerts set up

---

## Estimated Costs (Monthly)

| Service | Tier | Cost |
|---------|------|------|
| Cloud Run | Free + usage | $0-5 |
| Cloud SQL | db-f1-micro | $13-15 |
| Firebase Hosting | Free | $0 |
| Data Transfer | Free tier | $0 |
| **Total** | | **$13-20/month** |

---

## Next Steps

1. Test your app at the Firebase hosting URL
2. Set up CI/CD with Cloud Build
3. Configure backups for Cloud SQL
4. Monitor performance and costs
5. Scale Cloud SQL if needed


