#!/usr/bin/env pwsh
<#
.SYNOPSIS
    发一个版本：改版本号 -> 提交 -> 打 tag -> 推送，由 CI 自动发包。

.DESCRIPTION
    发版链路由 tag 驱动：push 一个 v*.*.* 的 tag 会触发 .github/workflows/release.yml，
    CI 负责跑测试、打包 skill、创建 GitHub Release、发布到 npm。

    最容易出错的地方是「tag 打在了落后的 commit 上」——这样发出去的还是旧代码，
    而且看起来一切正常。本脚本每次都先确认本地与远端同步，再从 HEAD 打 tag，
    把这件事变成机械保证。

.EXAMPLE
    pwsh ./scripts/release.ps1 1.3.1
    pwsh ./scripts/release.ps1 1.3.1 -DryRun     # 只检查，不做任何改动
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory, Position = 0)]
    [ValidatePattern('^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$')]
    [string]$Version,

    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

function Say  { param($m) Write-Host "  $m" -ForegroundColor Cyan }
function Ok   { param($m) Write-Host "  [OK] $m" -ForegroundColor Green }
function Die  { param($m) Write-Host "  [中止] $m" -ForegroundColor Red; exit 1 }

$tag = "v$Version"
Say "准备发布 $tag$(if ($DryRun) { '（DryRun，不会改动任何东西）' })"

# ── 1. 前置检查 ──
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main') { Die "当前在 $branch 分支，发版请在 main 上操作" }
Ok "分支: main"

$dirty = git status --porcelain
if ($dirty) { Die "工作区不干净，请先提交或 stash：`n$dirty" }
Ok "工作区干净"

git fetch origin --tags --quiet
$local  = (git rev-parse HEAD).Trim()
$remote = (git rev-parse origin/main).Trim()
if ($local -ne $remote) {
    $behind = (git rev-list --count "HEAD..origin/main").Trim()
    $ahead  = (git rev-list --count "origin/main..HEAD").Trim()
    Die "本地与 origin/main 不同步（领先 $ahead / 落后 $behind）。先 git pull / git push 再来。"
}
Ok "本地与 origin/main 同步 ($($local.Substring(0,7)))"

# 这个 tag 一旦推送就会触发发版，绝不能重复
if (git rev-parse -q --verify "refs/tags/$tag" > $null 2>&1) {
    Die "本地已存在 tag $tag。若要重发，先删：git tag -d $tag && git push origin :refs/tags/$tag"
}
if ((git ls-remote --tags origin $tag) -match $tag) {
    Die "远端已存在 tag $tag。npm 不允许覆盖已发布版本，请换一个版本号。"
}
Ok "tag $tag 未被占用"

# ── 2. 改版本号 ──
$pkgPath = Join-Path $PWD 'package.json'
$oldVersion = (Get-Content $pkgPath -Raw | ConvertFrom-Json).version
Say "版本号 $oldVersion -> $Version"

if ($DryRun) {
    Ok "DryRun 结束。实际执行时会依次："
    Say "  1. npm version $Version --no-git-tag-version"
    Say "  2. git commit -am 'chore: release $tag'"
    Say "  3. git tag $tag"
    Say "  4. git push origin main $tag   <- 触发 CI 发版"
    exit 0
}

& npm version $Version --no-git-tag-version --allow-same-version | Out-Null
if ($LASTEXITCODE -ne 0) { Die "npm version 失败" }
Ok "package.json 已更新"

# ── 3. 提交 + 打 tag + 推送 ──
git add package.json package-lock.json 2>$null
git commit -q -m "chore: release $tag"
Ok "已提交"

git tag $tag
Ok "已打 tag $tag（指向 $((git rev-parse HEAD).Substring(0,7))，即刚才提交的 HEAD）"

git push origin main $tag
if ($LASTEXITCODE -ne 0) { Die "推送失败，tag 已在本地，修好认证后手动推送：git push origin main $tag" }
Ok "已推送，CI 已开始发版"

Write-Host ""
Write-Host "  查看进度：" -ForegroundColor White
Write-Host "    https://github.com/jdfcc/zentao-mcp/actions" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  CI 会依次：跑测试 -> 打包 skill -> 创建 Release -> 发布 npm" -ForegroundColor White
Write-Host "  完成后验证：" -ForegroundColor White
Write-Host "    npm view @jdfcc/zentao-mcp --registry https://registry.npmjs.org/" -ForegroundColor DarkGray
Write-Host "    Invoke-WebRequest 'https://github.com/jdfcc/zentao-mcp/releases/latest/download/zentao-skill.zip' -Method Head" -ForegroundColor DarkGray
Write-Host ""
