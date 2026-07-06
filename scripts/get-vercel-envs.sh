#!/bin/bash
set -e

PROJECT_ID="brand-tanmatra-tmg"
REGION="asia-south2"
INSTANCE_NAME="brand-tanmatra-db"

echo "=========================================================="
echo "Tanmatra Vercel Environment Variables Extractor"
echo "=========================================================="
echo "This script will fetch secrets from Google Cloud Secret Manager"
echo "and describe the running Cloud Run service to pull env values."
echo "You may be prompted by gcloud to authenticate."
echo ""

# Check gcloud login status
if ! gcloud auth list --filter=status=ACTIVE --format="value(account)" | grep -q "@"; then
  echo "⚠️ Not authenticated with gcloud. Initiating login..."
  gcloud auth login
fi

echo "Fetching environment variables from Cloud Run service 'wellness-foods'..."
RUN_ENVS=$(gcloud run services describe wellness-foods --region=${REGION} --project=${PROJECT_ID} --format="value(spec.template.spec.containers[0].env)")

echo ""
echo "--- 🖥️ FRONTEND ENV VARIABLES (Vercel Project settings) ---"
echo ""

# Extract allowed origins and other variables from Cloud Run service
API_URL="https://wellness-foods-475157072474.asia-south2.run.app/api"
echo "VITE_API_BASE=${API_URL}"

# Razorpay Key ID
RAZORPAY_KEY_ID=$(echo "$RUN_ENVS" | grep -oP '(?<=RAZORPAY_KEY_ID=)[^,;]*' || echo "")
if [ -n "$RAZORPAY_KEY_ID" ]; then
  echo "VITE_RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID}"
else
  echo "VITE_RAZORPAY_KEY_ID= # Get from Razorpay Dashboard (rzp_live_...)"
fi

echo "VITE_GOOGLE_MAPS_API_KEY= # Get from Google Cloud Console"
echo "VITE_FIREBASE_API_KEY= # Get from Firebase Console"

echo ""
echo "--- ⚙️ BACKEND ENV VARIABLES (For Vercel deployment of api-server) ---"
echo ""
echo "NODE_ENV=production"

# Database URL
echo "Fetching Database URL from Secret Manager..."
RAW_DB_URL=$(gcloud secrets versions access latest --secret="brand-tanmatra-database-url" --project=${PROJECT_ID} || echo "")

if [ -n "$RAW_DB_URL" ]; then
  echo "# Socket-based connection string (GCP default):"
  echo "# DATABASE_URL=${RAW_DB_URL}"
  echo ""
  
  # Fetch Public IP of the SQL Instance to make a public connection string
  echo "Fetching Cloud SQL Public IP..."
  PUBLIC_IP=$(gcloud sql instances describe ${INSTANCE_NAME} --project ${PROJECT_ID} --format='value(ipAddresses[0].ipAddress)' || echo "")
  
  if [ -n "$PUBLIC_IP" ]; then
    DB_USER=$(echo "$RAW_DB_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
    DB_PASS=$(echo "$RAW_DB_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    DB_NAME=$(echo "$RAW_DB_URL" | sed -e 's|?.*||' | sed -n 's|.*/\([^/]*\)$|\1|p')
    
    echo "# Public IP connection string for Vercel Serverless:"
    echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@${PUBLIC_IP}:5432/${DB_NAME}"
  else
    echo "# Could not fetch public IP. Ensure Public IP is enabled on brand-tanmatra-db."
  fi
else
  echo "DATABASE_URL= # Failed to fetch database url secret"
fi
echo ""

# Admin session secret
ADMIN_SESSION_SECRET=$(gcloud secrets versions access latest --secret="brand-tanmatra-admin-session-secret" --project=${PROJECT_ID} 2>/dev/null || echo "PLACEHOLDER_SECRET_MIN_32_CHARS")
echo "ADMIN_SESSION_SECRET=${ADMIN_SESSION_SECRET}"

# Session secret
SESSION_SECRET=$(gcloud secrets versions access latest --secret="brand-tanmatra-session-secret" --project=${PROJECT_ID} 2>/dev/null || echo "PLACEHOLDER_SESSION_SECRET")
echo "SESSION_SECRET=${SESSION_SECRET}"

# Allowed origins
ALLOWED_ORIGINS=$(echo "$RUN_ENVS" | grep -oP '(?<=ALLOWED_ORIGINS=)[^;]*' || echo "")
echo "ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-https://tanmatra.food,https://www.tanmatra.food}"

# Razorpay secrets
RAZORPAY_KEY_SECRET=$(echo "$RUN_ENVS" | grep -oP '(?<=RAZORPAY_KEY_SECRET=)[^;]*' || echo "")
echo "RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID}"
echo "RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET:-# Fetch from Razorpay Dashboard}"
echo "RAZORPAY_WEBHOOK_SECRET=# Fetch from Razorpay Dashboard -> Webhooks"

# Admin username / password hash
ADMIN_USERNAME=$(echo "$RUN_ENVS" | grep -oP '(?<=ADMIN_USERNAME=)[^;]*' || echo "")
ADMIN_PASSWORD_HASH=$(echo "$RUN_ENVS" | grep -oP '(?<=ADMIN_PASSWORD_HASH=)[^;]*' || echo "")
echo "ADMIN_USERNAME=${ADMIN_USERNAME:-admin}"
echo "ADMIN_PASSWORD_HASH=${ADMIN_PASSWORD_HASH:-# From gcloud run description}"

echo ""
echo "=========================================================="
echo "Done."
echo "=========================================================="
