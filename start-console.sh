#!/usr/bin/env bash
# Run this on Linux to open the We Love Scripture console.
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Please install Node.js 20 or newer from https://nodejs.org and run this again."; exit 1; }
while true; do
  npm install --no-audit --no-fund --loglevel=error || exit 1
  node console/server.mjs
  [ $? -eq 75 ] || break
  echo "Restarting after an update..."
done
