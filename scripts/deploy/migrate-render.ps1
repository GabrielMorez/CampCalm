# CampCalm: aplica apenas as migrations pendentes no PostgreSQL do Render.
# Executar na raiz do repositório:
#   powershell -ExecutionPolicy Bypass -File .\scripts\deploy\migrate-render.ps1
# Não realiza DROP, reset do banco nem rollback. Reutiliza database/scripts/migrate.sh.
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$migrationsPath = Join-Path $repoRoot 'database\migrations'
$scriptsPath = Join-Path $repoRoot 'database\scripts'

if (-not (Test-Path (Join-Path $scriptsPath 'migrate.sh'))) { throw 'database/scripts/migrate.sh não encontrado.' }
if (-not (Test-Path $migrationsPath)) { throw 'Pasta database/migrations não encontrada.' }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker Desktop não encontrado.' }

Write-Host 'Cole a EXTERNAL Database URL do Render (não a Internal URL).' -ForegroundColor Cyan
Write-Host 'O valor será solicitado sem exibição no terminal e não será salvo em arquivo.'
$secureUrl = Read-Host 'External Database URL' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUrl)
try {
    $urlText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

try {
    $uri = [uri]$urlText
    if ($uri.Scheme -notin @('postgres', 'postgresql')) { throw 'A URL precisa começar com postgres:// ou postgresql://.' }
    if ($uri.Host -notmatch '(^|\.)render\.com$') { throw 'Host não parece pertencer ao Render. Confira a URL EXTERNAL do banco.' }
    $parts = $uri.UserInfo.Split(':', 2)
    if ($parts.Count -ne 2) { throw 'A URL não contém usuário e senha.' }
    $user = [uri]::UnescapeDataString($parts[0])
    $password = [uri]::UnescapeDataString($parts[1])
    $dbName = [uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($user) -or [string]::IsNullOrWhiteSpace($dbName)) { throw 'Usuário ou nome do banco ausente na URL.' }
    $port = if ($uri.Port -gt 0) { [string]$uri.Port } else { '5432' }
} finally {
    $urlText = $null
    $secureUrl = $null
}

Write-Host "Destino das migrations: $($uri.Host) / $dbName" -ForegroundColor Yellow
$confirmation = Read-Host 'Digite APLICAR para confirmar o banco remoto'
if ($confirmation -cne 'APLICAR') { throw 'Operação cancelada.' }

$keys = @('PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGSSLMODE')
$original = @{}
foreach ($key in $keys) { $original[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
try {
    $env:PGHOST = $uri.Host
    $env:PGPORT = $port
    $env:PGDATABASE = $dbName
    $env:PGUSER = $user
    $env:PGPASSWORD = $password
    $env:PGSSLMODE = 'require'

    Write-Host 'Aplicando migrations pendentes com postgres:17-alpine...' -ForegroundColor Cyan
    & docker run --rm `
      --env PGHOST --env PGPORT --env PGDATABASE --env PGUSER --env PGPASSWORD --env PGSSLMODE `
      --mount "type=bind,source=$migrationsPath,target=/migrations,readonly" `
      --mount "type=bind,source=$scriptsPath,target=/scripts,readonly" `
      postgres:17-alpine /bin/sh /scripts/migrate.sh

    if ($LASTEXITCODE -ne 0) { throw "Migrations falharam (exit code $LASTEXITCODE)." }
    Write-Host 'Migrations aplicadas com sucesso.' -ForegroundColor Green
} finally {
    foreach ($key in $keys) {
      [Environment]::SetEnvironmentVariable($key, $original[$key], 'Process')
    }
    $password = $null
}
