#!/bin/bash
# Double-click this file on a Mac to open the We Love Scripture console.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "The console needs Node.js (a free helper program)."
  echo "Opening the download page. Install the LTS version, then double-click this file again."
  open "https://nodejs.org/en/download" ; read -n 1 -s -r -p "Press any key to close"; exit 1
fi
while true; do
  npm install --no-audit --no-fund --loglevel=error || { read -n 1 -s -r -p "Something went wrong. Press any key"; exit 1; }
  node console/server.mjs
  [ $? -eq 75 ] || break
  echo "Restarting after an update..."
done
read -n 1 -s -r -p "The console has stopped. Press any key to close"
