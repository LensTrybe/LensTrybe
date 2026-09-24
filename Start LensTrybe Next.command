#!/bin/bash
# Double-click to run the local preview. Installs once, then opens the browser.
cd "$(dirname "$0")/LensTrybe-app"
echo "LensTrybe Next, local preview"
echo "This folder is separate from the live site. Nothing here touches lenstrybe.com."
echo
if ! command -v npm >/dev/null 2>&1; then
  echo "Node is not on this Mac's PATH. Install it from https://nodejs.org (LTS), then double-click this file again."
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "First run: installing dependencies (about a minute)..."
  npm install
fi
# Stop any earlier LensTrybe Next server still running from this folder.
pkill -f "LensTrybe Next/LensTrybe-app/node_modules/.bin/vite" 2>/dev/null
pkill -f "LensTrybe Next/LensTrybe-app/node_modules/vite/bin/vite.js" 2>/dev/null
sleep 1
# First free port from 5180 up. Your original site's dev server stays on 5173.
PORT=5180
while lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT+1)); done
echo
echo "Starting at http://localhost:$PORT   (original site stays on 5173; press Ctrl+C here to stop)"
echo
npx vite --port $PORT --strictPort --open "http://localhost:$PORT/"
