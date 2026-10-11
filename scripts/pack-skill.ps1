<#
.SYNOPSIS
    构建 zentao skill 的自包含安装包（zentao-skill.zip），用于 GitHub Release 附件。

.DESCRIPTION
    产物是一个「解压即用」的 zip，用户端无需 npm install、无需构建：
        SKILL.md          路径占位符保留，由 install.ps1 在装机时替换为绝对路径
        mcp-cli.mjs       MCP stdio 客户端
        dist/             已编译的 MCP server
        node_modules/     仅生产依赖
        .env.example
        LICENSE

.EXAMPLE
    npm run build; pwsh -File scripts/pack-skill.ps1
    # -> dist-release/zentao-skill.zip
#>
[CmdletBinding()]
param(
    [string]$OutputPath = 'dist-release/zentao-skill.zip',
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
    function Say  { param($m) Write-Host "  $m" -ForegroundColor Cyan }
    function Done { param($m) Write-Host "  [OK] $m" -ForegroundColor Green }

    Write-Host "`n打包 zentao skill" -ForegroundColor White

    # ── 1. 前置检查 ──
    if (-not (Test-Path 'dist/index.js')) {
        throw "缺少 dist/index.js。请先执行 npm run build。"
    }
    foreach ($f in @('mcp-cli.mjs', 'skill/SKILL.md', 'package.json', 'package-lock.json')) {
        if (-not (Test-Path $f)) { throw "缺少必需文件: $f" }
    }
    Say "前置检查通过"

    # ── 2. 暂存 ──
    $stage = Join-Path ([IO.Path]::GetTempPath()) ("zentao-pack-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stage -Force | Out-Null
    Say "暂存目录: $stage"

    Copy-Item 'skill/SKILL.md' $stage
    Copy-Item 'mcp-cli.mjs'    $stage
    Copy-Item 'dist'           $stage -Recurse
    foreach ($opt in @('.env.example', 'LICENSE')) {
        if (Test-Path $opt) { Copy-Item $opt $stage }
    }

    # 校验占位符确实还在（若被误替换成开发机路径，装到别人机器上就废了）
    $skillText = Get-Content (Join-Path $stage 'SKILL.md') -Raw
    if ($skillText -notmatch '\{\{ZENTAO_SKILL_DIR\}\}') {
        throw "SKILL.md 里找不到 {{ZENTAO_SKILL_DIR}} 占位符——可能被误写成了硬编码路径，装机后会指向错误目录。"
    }
    if ($skillText -match '[A-Za-z]:\\[^\s"]*zentao-mcp') {
        throw "SKILL.md 里残留开发机绝对路径，请改为 {{ZENTAO_SKILL_DIR}} 占位符。"
    }
    Done "SKILL.md 占位符校验通过"

    # ── 3. 只装生产依赖到暂存区（不动仓库自己的 node_modules）──
    if (-not $SkipInstall) {
        Copy-Item 'package.json'      $stage
        Copy-Item 'package-lock.json' $stage
        Say "安装生产依赖 (npm ci --omit=dev)..."
        Push-Location $stage
        try {
            & npm ci --omit=dev --no-audit --no-fund 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "npm ci 失败" }
        } finally { Pop-Location }
        if (-not (Test-Path (Join-Path $stage 'node_modules'))) {
            throw "生产依赖安装后没有生成 node_modules"
        }
        # package*.json 不需要发给用户
        Remove-Item (Join-Path $stage 'package.json'), (Join-Path $stage 'package-lock.json') -Force
        Done "生产依赖就绪"
    } else {
        Say "跳过依赖安装（-SkipInstall）"
    }

    # ── 4. 压缩 ──
    $outFull = Join-Path $repoRoot $OutputPath
    $outDir  = Split-Path -Parent $outFull
    if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
    if (Test-Path $outFull) { Remove-Item $outFull -Force }

    Say "压缩中（含 node_modules，稍慢）..."
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $outFull -CompressionLevel Optimal -Force

    $sizeMB = (Get-Item $outFull).Length / 1MB
    $sha    = (Get-FileHash $outFull -Algorithm SHA256).Hash.ToLower()
    Done ("产物: {0}  ({1:N1} MB)" -f $outFull, $sizeMB)
    Say "SHA256: $sha"

    # 供 CI 生成 release notes / 校验用
    "$sha" | Set-Content -Path "$outFull.sha256" -Encoding utf8NoBOM

    Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host ""
} finally {
    Pop-Location
}
