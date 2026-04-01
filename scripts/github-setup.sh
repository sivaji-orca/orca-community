#!/bin/bash
# Run this script after pushing to GitHub to set up repo metadata.
# Requires: gh CLI (https://cli.github.com/) authenticated with `gh auth login`

set -e

REPO="sivaji-orca/orca-community"

echo "Setting up GitHub repository: $REPO"
echo ""

echo "Setting repo description..."
gh repo edit "$REPO" \
  --description "Open-source MuleSoft developer productivity tool. Dashboard, API scaffolding, deploy, Postman, Git — all in one." \
  --homepage "https://orcaesb.com/community"

echo "Adding topics..."
gh repo edit "$REPO" \
  --add-topic mulesoft \
  --add-topic api-development \
  --add-topic open-source \
  --add-topic integration \
  --add-topic developer-tools \
  --add-topic mulesoft-api \
  --add-topic api-lifecycle \
  --add-topic salesforce \
  --add-topic postman \
  --add-topic cursor-ide

echo "Enabling Discussions..."
gh repo edit "$REPO" --enable-discussions

echo ""
echo "Done! Next steps:"
echo "  1. Go to https://github.com/$REPO/settings"
echo "  2. Upload a social preview image under 'Social preview'"
echo "  3. Pin a 'Welcome' issue to the repo"
echo "  4. Create a GitHub Release for v0.1.0"
