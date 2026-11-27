#!/usr/bin/env bash
# One-time: lets the main branch of one GitHub repo deploy to Firebase, with no stored key.
#
#   scripts/setup-github-deploy.sh <google-account> <github-owner>/<repo>
#
# The Google account must own the Firebase project. The script opens a browser to sign it
# in, and keeps that sign-in in a temporary folder, deleted at the end. Accounts and settings
# already in gcloud are neither used nor changed.
set -euo pipefail

if [[ $# -ne 2 || ! $2 =~ ^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$ ]]; then
  echo "Usage: $0 <google-account> <github-owner>/<repo>" >&2
  exit 1
fi

for var in $(compgen -e CLOUDSDK_ || true) GOOGLE_APPLICATION_CREDENTIALS; do
  unset "$var"
done
CLOUDSDK_CONFIG=$(mktemp -d)
export CLOUDSDK_CONFIG
trap 'rm -rf "$CLOUDSDK_CONFIG"' EXIT
export CLOUDSDK_CORE_ACCOUNT=$1
export CLOUDSDK_CORE_PROJECT=yule-swoon
REPO=$2
PROJECT_NUMBER=842316071349
SA="github-deploy@yule-swoon.iam.gserviceaccount.com"

gcloud auth login "$1" --brief

gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com

gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 ||
  gcloud iam service-accounts create github-deploy --display-name="GitHub deploy"

# A new service account can take a few seconds to be usable in IAM policies.
for attempt in 1 2 3 4 5 6; do
  gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 && break
  sleep 5
done
sleep 10

gcloud services enable cloudfunctions.googleapis.com cloudbuild.googleapis.com run.googleapis.com \
  eventarc.googleapis.com artifactregistry.googleapis.com pubsub.googleapis.com storage.googleapis.com

# Publish the site, publish the rules, check indexes, check that APIs are enabled, read the Storage
# bucket for its rules, and deploy the functions (which run as the default compute service account).
for role in firebasehosting.admin firebaserules.admin datastore.indexAdmin serviceusage.serviceUsageConsumer \
  firebasestorage.viewer cloudfunctions.developer run.developer artifactregistry.writer eventarc.developer; do
  gcloud projects add-iam-policy-binding yule-swoon \
    --member="serviceAccount:$SA" --role="roles/$role" --condition=None --quiet >/dev/null
  echo "Granted $role"
done

# Deploying a function means acting as the service account it runs as.
gcloud iam service-accounts add-iam-policy-binding "$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --member="serviceAccount:$SA" --role=roles/iam.serviceAccountUser --quiet >/dev/null
echo "Granted iam.serviceAccountUser on the functions' service account"

gcloud iam workload-identity-pools describe github --location=global >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools create github --location=global --display-name="GitHub"

# Only this repo, and only its main branch, can sign in.
CONDITION="assertion.repository == '$REPO' && assertion.ref == 'refs/heads/main'"
PROVIDER_FLAGS=(
  --location=global
  --workload-identity-pool=github
  --issuer-uri=https://token.actions.githubusercontent.com
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository"
  --attribute-condition="$CONDITION"
)
if gcloud iam workload-identity-pools providers describe github --location=global \
  --workload-identity-pool=github >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers update-oidc github "${PROVIDER_FLAGS[@]}"
else
  gcloud iam workload-identity-pools providers create-oidc github "${PROVIDER_FLAGS[@]}"
fi

gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$REPO" \
  --quiet >/dev/null

echo "Done. Pushes to main of $REPO can now deploy to yule-swoon."
