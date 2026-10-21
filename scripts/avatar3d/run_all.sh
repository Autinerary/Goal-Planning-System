#!/bin/bash
# The whole 3D character pipeline, in order (README.md says what each step does).
#   scripts/avatar3d/run_all.sh
# Needs Blender with MPFB and the asset packs, and the Poly Haven HDRIs (README.md).
set -euo pipefail
BLENDER=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
BUILD=${BUILD:-$HOME/autinerary-3d/build}
HDRI=${HDRI:-$HOME/autinerary-3d/downloads/polyhaven}
cd "$(dirname "$0")"
python3 -I gen_catalog.py
"$BLENDER" -b --python build.py -- --out "$BUILD"
"$BLENDER" -b --python textures.py -- --out "$BUILD"
"$BLENDER" -b --python thumbs.py -- --out "$BUILD"
"$BLENDER" -b --python environments.py -- "$HDRI" "$BUILD/env"
node optimize.mjs "$BUILD" ../../frontend/public/avatar3d
