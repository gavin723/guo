#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
lean_path="$project_root/quant-engine/Lean"

command -v git >/dev/null 2>&1 || { echo "Git is required."; exit 1; }
command -v dotnet >/dev/null 2>&1 || { echo ".NET 10 SDK is required."; exit 1; }

git -C "$project_root" submodule sync --recursive
git -C "$project_root" submodule update --init --recursive quant-engine/Lean
dotnet build "$lean_path/QuantConnect.Lean.sln" --configuration Release

echo "LEAN downloaded and built."
echo "Algorithm: $project_root/quant-engine/AlphaRadarAlgorithm.py"
echo "Research/paper mode only; no live orders are submitted."
