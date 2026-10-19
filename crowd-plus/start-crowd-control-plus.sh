#!/bin/sh
# Linux: ./start-crowd-control-plus.sh   (add --test for practice mode)
cd "$(dirname "$0")"
exec node bridge.mjs "$@"
