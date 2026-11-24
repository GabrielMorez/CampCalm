# CampCalm - Inicializacao do ambiente local (Windows/PowerShell)
# Execute a partir de qualquer diretorio:
#   powershell -ExecutionPolicy Bypass -File .\backend\scripts\iniciar-dev.ps1
# Nao remove volumes, nao recria bancos, nao apaga dados.

$ErrorActionPreference = 'Stop'

function Show-Step([string]$message) {
    Write-Host "`n==> $message" -ForegroundColor Cyan
}

function Assert-ExitCode([string]$operation) {
    if ($LASTEXITCODE -ne 0) {
        throw "$operation falhou (codigo de saida $LASTEXITCODE)."
    }
}

function Import-LocalEnv([string]$filePath) {
    foreach ($line in Get-Content -LiteralPath $filePath -Encoding UTF8) {
        if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            continue
        }
        # O regex e reexecutado com -match para preencher $Matches de modo explicito.
        $null = $line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$'
        $key = $Matches[1]
        $value = $Matches[2].Trim()
        if ($value.Length -ge 2) {
            if (($value[0] -eq '"' -and $value[$value.Length - 1] -eq '"') -or
                ($value[0] -eq "'" -and $value[$value.Length - 1] -eq "'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
}

function Test-CampCalmHealth([string]$baseUrl) {
    try {
        $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get -TimeoutSec 2
        return ($health.service -eq 'campcalm-backend' -and $health.status -eq 'ok')
    }
    catch {
        return $false
    }
}

function Test-CampCalmReady([string]$baseUrl) {
    try {
        $ready = Invoke-RestMethod -Uri "$baseUrl/ready" -Method Get -TimeoutSec 2
        return ($ready.status -eq 'ready')
    }
    catch {
        return $false
    }
}

try {
    if (-not $PSScriptRoot) {
        throw 'Execute este arquivo salvo em backend\scripts\iniciar-dev.ps1.'
    }

    $projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
    $backendDir = Join-Path $projectRoot 'backend'
    $frontendDir = Join-Path $projectRoot 'frontend'
    $envFile = Join-Path $projectRoot '.env'
    $composeFile = Join-Path $projectRoot 'docker-compose.yml'

    if (-not (Test-Path -LiteralPath $composeFile)) {
        throw "docker-compose.yml nao encontrado em: $projectRoot"
    }
    if (-not (Test-Path -LiteralPath $envFile)) {
        throw "Arquivo .env nao encontrado em $projectRoot. Copie .env.example para .env e configure a senha e JWT_SECRET."
    }
    if (-not (Test-Path -LiteralPath (Join-Path $backendDir 'src\server.ts'))) {
        throw 'backend\src\server.ts nao encontrado. Confirme a estrutura atual da API.'
    }

    Import-LocalEnv $envFile

    if ([string]::IsNullOrWhiteSpace($env:DATABASE_PASSWORD) -or
        $env:DATABASE_PASSWORD -match 'SUBSTITUA|CHANGE_ME|YOUR_PASSWORD') {
        throw 'Configure DATABASE_PASSWORD no arquivo .env da raiz antes de iniciar.'
    }
    if ([string]::IsNullOrWhiteSpace($env:JWT_SECRET) -or $env:JWT_SECRET.Length -lt 32) {
        throw 'Configure JWT_SECRET com pelo menos 32 caracteres no arquivo .env da raiz.'
    }

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker nao encontrado. Instale/abra o Docker Desktop.'
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw 'Node.js nao encontrado. Instale o Node.js 24 ou superior.'
    }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw 'npm nao encontrado no PATH.'
    }

    $nodeVersion = (& node --version).Trim()
    Assert-ExitCode 'node --version'
    if ($nodeVersion -notmatch '^v(\d+)\.') {
        throw "Versao do Node.js nao reconhecida: $nodeVersion"
    }
    if ([int]$Matches[1] -lt 24) {
        throw "Node.js 24+ e necessario. Versao atual: $nodeVersion"
    }

    $apiPort = if ([string]::IsNullOrWhiteSpace($env:PORT)) { 3000 } else { [int]$env:PORT }
    if ($apiPort -lt 1 -or $apiPort -gt 65535) {
        throw "PORT invalida no .env: $apiPort"
    }
    $apiBaseUrl = "http://localhost:$apiPort"

    Show-Step 'Verificando Docker Desktop'
    & docker info --format '{{.ServerVersion}}' 1>$null
    Assert-ExitCode 'Conexao com o Docker Desktop'
    & docker compose version
    Assert-ExitCode 'Docker Compose'

    Push-Location $projectRoot
    try {
        Show-Step 'Subindo PostgreSQL/PostGIS (sem apagar o volume)'
        & docker compose up -d db
        Assert-ExitCode 'docker compose up -d db'

        Show-Step 'Aplicando somente migrations pendentes'
        & docker compose --profile tools run --rm migrate
        Assert-ExitCode 'docker compose --profile tools run --rm migrate'
    }
    finally {
        Pop-Location
    }

    if (-not (Test-Path -LiteralPath (Join-Path $backendDir 'node_modules'))) {
        Show-Step 'Instalando dependencias do backend'
        Push-Location $backendDir
        try {
            if (Test-Path -LiteralPath (Join-Path $backendDir 'package-lock.json')) {
                & npm ci
            }
            else {
                & npm install
            }
            Assert-ExitCode 'Instalacao npm do backend'
        }
        finally {
            Pop-Location
        }
    }

    # O frontend pode ser iniciado depois, em outro terminal.
    # Somente cria seu .env quando ainda nao existe.
    if (Test-Path -LiteralPath $frontendDir) {
        $frontendEnv = Join-Path $frontendDir '.env'
        if (-not (Test-Path -LiteralPath $frontendEnv)) {
            Set-Content -LiteralPath $frontendEnv -Value "VITE_API_URL=$apiBaseUrl" -Encoding ASCII
            Write-Host "Frontend .env criado com VITE_API_URL=$apiBaseUrl" -ForegroundColor DarkGreen
        }
        else {
            Write-Host 'Frontend .env existente foi preservado.' -ForegroundColor DarkGray
        }
    }

    if (Test-CampCalmHealth $apiBaseUrl) {
        Show-Step 'API CampCalm ja esta em execucao; nao sera iniciada uma segunda instancia'
    }
    else {
        Show-Step 'Iniciando API em outra janela PowerShell'
        $runApiScript = Join-Path $PSScriptRoot 'executar-api.ps1'
        if (-not (Test-Path -LiteralPath $runApiScript)) {
            throw "Script auxiliar nao encontrado: $runApiScript"
        }

        $shellExe = if ($PSVersionTable.PSEdition -eq 'Core') { 'pwsh.exe' } else { 'powershell.exe' }
        $arguments = "-NoExit -NoProfile -ExecutionPolicy Bypass -File `"$runApiScript`""
        Start-Process -FilePath $shellExe -ArgumentList $arguments | Out-Null
    }

    Show-Step 'Verificando API e banco'
    $apiReady = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if ((Test-CampCalmHealth $apiBaseUrl) -and (Test-CampCalmReady $apiBaseUrl)) {
            $apiReady = $true
            break
        }
        Start-Sleep -Milliseconds 750
    }

    if (-not $apiReady) {
        throw "A API nao ficou pronta em $apiBaseUrl. Confira a janela da API, a porta e o arquivo .env."
    }

    Write-Host "`nCampCalm BACKEND PRONTO!" -ForegroundColor Green
    Write-Host "  API:       $apiBaseUrl"
    Write-Host "  Health:    $apiBaseUrl/health"
    Write-Host "  Database:  $apiBaseUrl/ready"
    Write-Host "  PostgreSQL: localhost:$($env:DATABASE_PORT)"

    if (Test-Path -LiteralPath (Join-Path $frontendDir 'package.json')) {
        Write-Host "`nPara iniciar o frontend, abra OUTRO terminal:" -ForegroundColor Cyan
        Write-Host "  cd `"$frontendDir`""
        Write-Host '  npm install   # apenas na primeira vez'
        Write-Host '  npm run dev'
        Write-Host '  Abra: http://localhost:5173'
    }
    else {
        Write-Warning 'Pasta frontend nao localizada. Extraia o frontend na raiz do projeto.'
    }
    Write-Host "`nObservacao: para parar o banco, use 'docker compose stop db' na raiz. Nao use 'down -v'." -ForegroundColor Yellow
}
catch {
    Write-Host "`nFALHA AO INICIAR CAMPCALM: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
