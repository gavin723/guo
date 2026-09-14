$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$leanPath = Join-Path $PSScriptRoot "Lean"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git 未安装。请先安装 Git for Windows。"
}

Push-Location $projectRoot
try {
    git submodule sync --recursive
    git submodule update --init --recursive quant-engine/Lean
    if ($LASTEXITCODE -ne 0) { throw "LEAN 下载失败。" }
}
finally {
    Pop-Location
}

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw "需要 .NET 10 SDK。安装后重新运行本脚本。"
}

dotnet build (Join-Path $leanPath "QuantConnect.Lean.sln") --configuration Release
if ($LASTEXITCODE -ne 0) { throw "LEAN 编译失败。" }

Write-Host "LEAN 已下载并编译完成。"
Write-Host "Alpha Radar 算法：$PSScriptRoot\AlphaRadarAlgorithm.py"
Write-Host "当前保持研究/模拟模式，不会提交实盘订单。"
