#!/usr/bin/env bash
# Regenerate the podcast intro/outro jingles (needs libfluidsynth + fluid-soundfont-gm).
set -euo pipefail
cd "$(dirname "$0")"
SF=/usr/share/sounds/sf2/FluidR3_GM.sf2
python3 compose.py . waltz
python3 render.py "$SF" intro.mid intro.wav 1.1 0 3.5    # no fade-in, 3.5s fade-out
python3 render.py "$SF" outro.mid outro.wav 1.1 2.0 2.0  # 2s fade-in, 2s fade-out
