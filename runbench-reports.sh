#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(realpath $(dirname $0))"
cd $BASE_DIR

for PROF_LOG in ./prof/*/*/*.nodeprof.log ; do
  PROF_REPORT=$(dirname "$PROF_LOG")/$(basename "$PROF_LOG" .nodeprof.log).stack.txt
  if [ ! -e "${PROF_REPORT}" ] ; then
    echo "Processing $PROF_LOG to $PROF_REPORT"
    node --prof-process "$PROF_LOG" > "$PROF_REPORT"
    # else echo "Skipping $PROF_REPORT, already processed"
  fi
done
