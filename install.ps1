<#
.SYNOPSIS
    安装 / 升级 / 配置 zentao skill 到用户级 skill 目录。

.DESCRIPTION
    从 GitHub Release 拉取自包含安装包，解压到 $env:USERPROFILE\.agents\skills\zentao，
    替换 SKILL.md 里的路径占位符，写入配置，并自检能否真正连上禅道。
    装好后**任意项目目录**都能用，不依赖项目内文件、不需要注册 MCP server。

.EXAMPLE
    # 最常用：一条命令装好（会交互式询问禅道配置）
    irm https://raw.githubusercontent.com/jdfcc/zentao-mcp/main/install.ps1 | iex

.EXAMPLE
    # 重新配置凭据（升级/换账号时用；其它设置保留）
    & ([scriptblock]::Create((irm https://raw.githubusercontent.com/jdfcc/zentao-mcp/main/install.ps1))) -Configure

.EXAMPLE
    # 全非交互（CI / 批量装机）
    $env:ZENTAO_URL='https://zentao.example.com'
    $env:ZENTAO_USERNAME='me'; $env:ZENTAO_PASSWORD='***'
    irm https://raw.githubusercontent.com/jdfcc/zentao-mcp/main/install.ps1 | iex

.NOTES
    注意：本脚本**不使用 exit**，全部以 throw 结束——因为它常以 `irm | iex` 方式在用户当前
    shell 里执行，exit 会把用户自己的终端一起关掉。
#>
[CmdletBinding()]
param(
    [string]$ZentaoUrl,
    [string]$Username,
    [string]$Password,
    [string]$DefaultProject,
    [string]$ApiMode,
    [string]$Version = 'latest',
    [string]$Repo = 'jdfcc/zentao-mcp',
    [string]$InstallDir,
    [string]$LocalZip,
    [switch]$Configure,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# PowerShell 5.1 默认可能仍是 TLS 1.0，从 GitHub 下载会直接失败
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

function Write-Step  { param($m) Write-Host "  $m" -ForegroundColor Cyan }
function Write-Ok    { param($m) Write-Host "  [OK] $m" -ForegroundColor Green }
function Write-Warn2 { param($m) Write-Host "  [!] $m" -ForegroundColor Yellow }
function Write-Head  { param($m) Write-Host "`n$m" -ForegroundColor White }

# 写 .env 时给「含特殊字符的值」加引号。不加会踩两个坑：
#   1) 值里有 # → dotenv 视为行内注释，密码被从 # 处截断（含 # 的密码极常见）
#   2) 值首尾有空格 → 被 trim 掉
function Format-EnvValue {
    param([string]$Value)
    if ([string]::IsNullOrEmpty($Value)) { return '' }
    if ($Value -match '[#''"\s]') {
        $v = $Value.Replace('\', '\\').Replace('"', '\"')
        return '"' + $v + '"'
    }
    return $Value
}

# 用拼接而非插值 here-string：密码里若含 $ 会被 PowerShell 当变量展开。
# 注意不要写成数组字面量里的 `'K=' + (f $x),` —— PowerShell 中逗号优先级高于 +，
# 那会被解析成 `'K=' + ((f $x),)`，把键和值拆成两个数组元素、写进 .env 变成两行。
function New-EnvContent {
    param([string]$Url, [string]$User, [string]$Pass, [string]$Proj, [string]$Mode)
    $lines = [System.Collections.Generic.List[string]]::new()
    $lines.Add('# Zentao Configuration')
    $lines.Add('ZENTAO_URL=' + (Format-EnvValue $Url))
    $lines.Add('ZENTAO_USERNAME=' + (Format-EnvValue $User))
    $lines.Add('ZENTAO_PASSWORD=' + (Format-EnvValue $Pass))
    $lines.Add('ZENTAO_DEFAULT_PROJECT=' + (Format-EnvValue $Proj))
    $lines.Add('ZENTAO_API_MODE=' + (Format-EnvValue $Mode))
    $lines.Add('')
    $lines.Add('# Optional Configuration')
    $lines.Add('TTL_SECONDS=300')
    $lines.Add('LOG_LEVEL=error')
    return ($lines -join "`n")
}

# ─────────────────────────── 解析安装目录 ───────────────────────────
if (-not $InstallDir) {
    $home_ = if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME }
    if (-not $home_) { throw "无法确定用户主目录（USERPROFILE / HOME 均为空）。" }
    $InstallDir = Join-Path $home_ '.agents\skills\zentao'
}

Write-Head "zentao skill 安装程序"
Write-Step "安装目录: $InstallDir"
Write-Step "来源仓库: $Repo"

# ─────────────────────────── 环境检查 ───────────────────────────
Write-Head "[1/6] 环境检查"
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    throw "未找到 node。请先安装 Node.js 18+：https://nodejs.org/"
}
$nodeVersion = (& node --version).TrimStart('v')
$nodeMajor = [int]($nodeVersion -split '\.')[0]
if ($nodeMajor -lt 18) { throw "Node.js 版本过低（当前 $nodeVersion，需要 18+）。" }
Write-Ok "node v$nodeVersion"

# ─────────────────────── 配置项收集（参数 > 环境变量 > 交互）───────────────────────
if (-not $ZentaoUrl)       { $ZentaoUrl       = $env:ZENTAO_URL }
if (-not $Username)        { $Username        = $env:ZENTAO_USERNAME }
if (-not $Password)        { $Password        = $env:ZENTAO_PASSWORD }
if (-not $DefaultProject)  { $DefaultProject  = $env:ZENTAO_DEFAULT_PROJECT }
if (-not $ApiMode)         { $ApiMode         = $env:ZENTAO_API_MODE }

$envFile = Join-Path $InstallDir '.env'
$isInstalled = Test-Path (Join-Path $InstallDir 'mcp-cli.mjs')

if ($Configure -and -not $isInstalled) {
    throw "尚未安装（$InstallDir 下没有 mcp-cli.mjs），无法只做配置。请先执行不带 -Configure 的安装。"
}

# -Configure 模式：跳过下载，只走配置向导
if ($Configure) {
    Write-Head "[2/6] 跳过下载（-Configure 模式，保留现有程序文件）"
} else {

    # ─────────────────────── 下载安装包 ───────────────────────
    Write-Head "[2/6] 获取安装包"
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("zentao-skill-" + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp -Force | Out-Null
    $zipPath = Join-Path $tmp 'payload.zip'

    if ($LocalZip) {
        if (-not (Test-Path $LocalZip)) { throw "找不到 -LocalZip 指定的文件: $LocalZip" }
        Copy-Item $LocalZip $zipPath -Force
        Write-Ok "使用本地安装包: $LocalZip"
        $sourceTag = "local:$LocalZip"
    } else {
        if ($Version -eq 'latest') {
            $assetUrl = "https://github.com/$Repo/releases/latest/download/zentao-skill.zip"
        } else {
            $assetUrl = "https://github.com/$Repo/releases/download/$Version/zentao-skill.zip"
        }
        Write-Step "下载: $assetUrl"
        try {
            Invoke-WebRequest -Uri $assetUrl -OutFile $zipPath -UseBasicParsing
        } catch {
            throw @"
下载安装包失败：$assetUrl

可能原因：
  1) 该仓库还没有发布 Release（或尚未上传 zentao-skill.zip 产物）
  2) 版本号不存在（-Version 当前为 '$Version'）
  3) 网络 / 代理问题

可先查看有哪些 Release： https://github.com/$Repo/releases
"@
        }
        Write-Ok ("已下载 {0:N0} KB" -f ((Get-Item $zipPath).Length / 1KB))
        $sourceTag = "github:$Repo@$Version"
    }

    $sha256 = (Get-FileHash $zipPath -Algorithm SHA256).Hash.ToLower()

    # ─────────────────────── 解压到暂存区 ───────────────────────
    Write-Head "[3/6] 解压"
    $stage = Join-Path $tmp 'stage'
    Expand-Archive -Path $zipPath -DestinationPath $stage -Force
    if (-not (Test-Path (Join-Path $stage 'mcp-cli.mjs'))) {
        throw "安装包内容异常：解压后找不到 mcp-cli.mjs。请确认产物是自包含 zip（含 dist/ 与 node_modules/）。"
    }
    Write-Ok "解压完成"

    # ─────────────────────── 安装（保留既有 .env）───────────────────────
    Write-Head "[4/6] 安装文件"
    $backupEnv = $null
    if (Test-Path $envFile) {
        $backupEnv = Get-Content $envFile -Raw
        Write-Step "检测到已有配置，将保留 .env"
    }
    if ($isInstalled -and -not $Force) {
        Write-Step "检测到已安装，执行覆盖升级（配置不受影响）"
    }

    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    # 清掉旧程序文件，避免升级后残留已删除的模块；.env 稍后回填
    Get-ChildItem $InstallDir -Force -Exclude '.env' | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Copy-Item (Join-Path $stage '*') $InstallDir -Recurse -Force

    if ($backupEnv) {
        Set-Content -Path $envFile -Value $backupEnv -Encoding utf8NoBOM -NoNewline
        Write-Ok "已回填原有 .env"
    }

    # SKILL.md 路径占位符 → 真实绝对路径
    $skillFile = Join-Path $InstallDir 'SKILL.md'
    if (Test-Path $skillFile) {
        $c = Get-Content $skillFile -Raw
        $c = $c.Replace('{{ZENTAO_SKILL_DIR}}', $InstallDir)
        Set-Content -Path $skillFile -Value $c -Encoding utf8NoBOM -NoNewline
        Write-Ok "SKILL.md 路径已解析为: $InstallDir"
    } else {
        throw "安装包缺少 SKILL.md。"
    }

    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

# ─────────────────────── 配置向导 ───────────────────────
Write-Head "[5/6] 禅道连接配置"

# -Configure 必须强制走配置流程：它的典型用途正是「.env 已存在但凭据过期了」，
# 若仍以「.env 是否存在」判断，重跑配置会静默什么都不做。
$needConfig = [bool]$Configure -or (-not (Test-Path $envFile))
$wroteConfig = $false

# 读既有配置作为向导默认值，重配时不用重新敲一遍
$existing = @{}
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([A-Z_]+)\s*=\s*(.*)$') { $existing[$Matches[1]] = $Matches[2].Trim() }
    }
}

if ($needConfig -and $ZentaoUrl -and $Username -and $Password) {
    # 全部由参数/环境变量提供 → 非交互写入
    $needConfig = $false
    $wroteConfig = $true
    if (-not $ApiMode) { $ApiMode = 'auto' }
    Set-Content -Path $envFile -Value (New-EnvContent $ZentaoUrl $Username $Password $DefaultProject $ApiMode) -Encoding utf8NoBOM
    Write-Ok "已按提供的参数写入配置（非交互）"
}

function Read-WithDefault {
    param([string]$Prompt, [string]$Default)
    if ($Default) {
        $v = Read-Host "  $Prompt [$Default]"
        if (-not $v) { return $Default }
        return $v
    }
    return (Read-Host "  $Prompt")
}

function Read-Secret {
    param([string]$Prompt, [string]$Default)
    $hint = if ($Default) { "（直接回车沿用原密码）" } else { "" }
    $sec = Read-Host "  $Prompt$hint" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { $v = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    if (-not $v -and $Default) { return $Default }
    return $v
}

if ($needConfig) {
    Write-Host ""
    if ($existing.Count -gt 0) {
        Write-Host "  重新配置：直接回车即沿用方括号里的现值。" -ForegroundColor White
    } else {
        Write-Host "  首次安装需要填写禅道连接信息。" -ForegroundColor White
        Write-Host "  （直接回车可沿用方括号里的默认值）" -ForegroundColor DarkGray
    }

    if (-not $ZentaoUrl) {
        $ZentaoUrl = Read-WithDefault "禅道地址 (如 https://zentao.example.com)" $existing['ZENTAO_URL']
        while (-not $ZentaoUrl) {
            Write-Warn2 "禅道地址不能为空"
            $ZentaoUrl = Read-Host "  禅道地址"
        }
    }
    $ZentaoUrl = $ZentaoUrl.TrimEnd('/')

    if (-not $Username) {
        $Username = Read-WithDefault "账号" $existing['ZENTAO_USERNAME']
        while (-not $Username) {
            Write-Warn2 "账号不能为空"
            $Username = Read-Host "  账号"
        }
    }

    if (-not $Password) {
        $Password = Read-Secret "密码" $existing['ZENTAO_PASSWORD']
        while (-not $Password) {
            Write-Warn2 "密码不能为空"
            $Password = Read-Secret "密码" $null
        }
    }

    if (-not $DefaultProject) {
        $DefaultProject = Read-WithDefault "默认项目 ID (可留空)" $existing['ZENTAO_DEFAULT_PROJECT']
    }
    if (-not $ApiMode) { $ApiMode = if ($existing['ZENTAO_API_MODE']) { $existing['ZENTAO_API_MODE'] } else { 'auto' } }

    Set-Content -Path $envFile -Value (New-EnvContent $ZentaoUrl $Username $Password $DefaultProject $ApiMode) -Encoding utf8NoBOM
    $wroteConfig = $true
    Write-Ok "配置已写入 $envFile"
    Write-Warn2 "该文件以明文保存密码，请勿提交到 git（安装目录在用户目录下，已隔离于任何仓库）"
}
if (-not $wroteConfig) { Write-Ok "沿用已有配置" }

# ─────────────────────── 来源元数据（照 .bsk-source 惯例）───────────────────────
if (-not $Configure) {
    $meta = [ordered]@{
        version     = 1
        source      = $sourceTag
        sha256      = $sha256
        installedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
    }
    Set-Content -Path (Join-Path $InstallDir '.zentao-source') -Value ($meta | ConvertTo-Json -Compress) -Encoding utf8NoBOM
}

# ─────────────────────── 自检 ───────────────────────
Write-Head "[6/6] 自检"
$cli = Join-Path $InstallDir 'mcp-cli.mjs'

# ── 第一层：协议层。能否把 MCP server 拉起来并列出工具。
#    注意 tools/list 走的是本地已注册的工具表，**完全不访问禅道、不验证凭据**，
#    所以它成功只能证明"装好了"，不能证明"连得上"。凭据必须单独验（见下）。
Write-Step "启动 MCP server 并拉取工具列表（首次约 3 秒）..."
$out = & node $cli list 2>&1 | Out-String
# 只认「有没有真的列出 zentao 工具」，不要用关键词匹配——工具描述里本身就可能出现"错误"等字样
if ($LASTEXITCODE -ne 0 -or $out -notmatch 'zentao_[a-z_]+') {
    Write-Host $out -ForegroundColor DarkGray
    throw @"
自检未通过：MCP server 未能返回工具列表。

常见原因：
  * node 版本过低
  * 安装包不完整（缺少 dist/ 或 node_modules/）

请重装：
  & ([scriptblock]::Create((irm https://raw.githubusercontent.com/$Repo/main/install.ps1))) -Force
"@
}
$toolCount = ([regex]::Matches($out, 'zentao_[a-z_]+') | ForEach-Object { $_.Value } | Sort-Object -Unique).Count
Write-Ok "MCP server 正常，已注册工具 $toolCount 个"

# ── 第二层：凭据层。真的打一次禅道接口，确认账号密码可用。
#
# 关键：dotenv 默认**不覆盖**已存在的进程环境变量（12-factor 约定，src/index.ts 里
# 也是 override:false）。所以机器上若残留 ZENTAO_* 环境变量，会盖掉刚写入的 .env，
# 导致「自检结果」和「用户实际使用时」不一致。这里先摘掉这些变量，确保验证的就是 .env。
$overrideKeys = @('ZENTAO_URL','ZENTAO_USERNAME','ZENTAO_PASSWORD','ZENTAO_DEFAULT_PROJECT','ZENTAO_API_MODE')
$conflicts = @($overrideKeys | Where-Object {
    [Environment]::GetEnvironmentVariable($_, 'Process') -or [Environment]::GetEnvironmentVariable($_, 'User')
})
if ($conflicts.Count -gt 0) {
    Write-Warn2 "检测到环境变量 $($conflicts -join ', ')"
    Write-Warn2 "它们优先级高于 .env、会覆盖安装配置；若日后认证异常，请先清除这些变量"
}

$savedEnv = @{}
foreach ($k in $overrideKeys) {
    $savedEnv[$k] = [Environment]::GetEnvironmentVariable($k, 'Process')
    if ($savedEnv[$k]) { Remove-Item "env:$k" -ErrorAction SilentlyContinue }
}

Write-Step "验证禅道凭据（实际调用一次接口）..."
$ok = $false
$lastOut = ''
try {
    foreach ($attempt in 1..2) {
        $lastOut = & node $cli call zentao_list_projects '{"limit":1}' --content-only 2>&1 | Out-String
        if ($lastOut -notmatch 'AUTH_ERROR|isError|Error:') { $ok = $true; break }
        # 禅道旧版登录偶发失败，重试一次避免误报
        if ($attempt -lt 2) { Start-Sleep -Seconds 2 }
    }
} finally {
    foreach ($k in $overrideKeys) {
        if ($savedEnv[$k]) { Set-Item -Path "env:$k" -Value $savedEnv[$k] }
    }
}

if (-not $ok) {
    Write-Host $lastOut -ForegroundColor DarkGray
    throw @"
自检未通过：MCP server 已就绪，但**无法通过禅道认证**。

常见原因：
  * 禅道地址 / 账号 / 密码不正确
  * 密码已过期或被修改
  * 网络不通（尤其内网地址需要 VPN）

请重跑配置向导后重试：
  & ([scriptblock]::Create((irm https://raw.githubusercontent.com/$Repo/main/install.ps1))) -Configure
"@
}
Write-Ok "禅道凭据验证通过（已验证 .env 中的配置确实可用）"

Write-Host ""
Write-Host "  安装完成！" -ForegroundColor Green
Write-Host ""
Write-Host "  skill 位置 : $InstallDir"
Write-Host "  配置文件   : $envFile"
Write-Host ""
Write-Host "  现在**任意项目目录**下，AI 工具启动时都会自动扫到这个 skill。" -ForegroundColor White
Write-Host "  手动验证：" -ForegroundColor DarkGray
Write-Host "    node `"$InstallDir\mcp-cli.mjs`" call zentao_list_my_tasks '{`"limit`":20}' --content-only" -ForegroundColor DarkGray
Write-Host ""
