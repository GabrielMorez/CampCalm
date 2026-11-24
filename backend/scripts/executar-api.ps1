# Script auxiliar aberto em nova janela por iniciar-dev.ps1.
$ErrorActionPreference = 'Stop'

try {
    $backendDir = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
    Set-Location -LiteralPath $backendDir
    Write-Host 'CampCalm API | npm run dev' -ForegroundColor Cyan
    Write-Host 'Feche esta janela ou pressione Ctrl+C para interromper a API.' -ForegroundColor DarkGray
    & npm run dev
    if ($LASTEXITCODE -ne 0) {
        Write-Host "API encerrou com codigo $LASTEXITCODE" -ForegroundColor Red
    }
}
catch {
    Write-Host "Erro ao iniciar API: $($_.Exception.Message)" -ForegroundColor Red
}
