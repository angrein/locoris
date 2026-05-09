#!/usr/bin/env bash

set -euo pipefail

IDENTIFIER="com.locoris.desktop"
APP_BUNDLE="${1:-/Applications/Locoris.app}"
WIPE_DATA="${LOCORIS_WIPE_DATA:-0}"

if [[ "${2:-}" == "--wipe-data" ]]; then
  WIPE_DATA="1"
fi

echo "Removing Locoris bundle: ${APP_BUNDLE}"
rm -rf "${APP_BUNDLE}"

if [[ "${WIPE_DATA}" == "1" ]]; then
  echo "Removing Locoris user data"
  rm -rf "${HOME}/Library/Application Support/${IDENTIFIER}"
  rm -rf "${HOME}/Library/Caches/${IDENTIFIER}"
  rm -rf "${HOME}/Library/Logs/${IDENTIFIER}"
else
  echo "User data preserved."
  echo "To wipe it as well, run:"
  echo "  LOCORIS_WIPE_DATA=1 $0 \"${APP_BUNDLE}\" --wipe-data"
fi
