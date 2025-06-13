# Script de test local pour éviter les problèmes Docker

Write-Host "🧪 Tests locaux de l'application PMF" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green

# Configuration
$DIEGO_URL = "http://localhost:3000"
$MIGUEL_URL = "http://localhost:3001"

function Test-Service {
    param(
        [string]$ServiceName,
        [string]$Url,
        [string]$Endpoint = "/health"
    )
    
    try {
        $response = Invoke-RestMethod -Uri "$Url$Endpoint" -Method Get -TimeoutSec 10
        Write-Host "✅ $ServiceName ($Endpoint): OK" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "❌ $ServiceName ($Endpoint): $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

function Wait-ForServices {
    Write-Host "⏳ Attente que les services soient prêts..." -ForegroundColor Yellow
    
    $maxRetries = 30
    $retryCount = 0
    
    do {
        $diegoOk = Test-Service "Diego" $DIEGO_URL
        $miguelOk = Test-Service "Miguel" $MIGUEL_URL
        
        if ($diegoOk -and $miguelOk) {
            Write-Host "✅ Tous les services sont prêts!" -ForegroundColor Green
            return $true
        }
        
        $retryCount++
        Write-Host "⏳ Tentative $retryCount/$maxRetries - Attente de 5 secondes..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    } while ($retryCount -lt $maxRetries)
    
    Write-Host "❌ Timeout: Les services ne sont pas prêts après $maxRetries tentatives" -ForegroundColor Red
    return $false
}

# Vérifier si Docker Compose est en cours d'exécution
Write-Host "🔍 Vérification des services..." -ForegroundColor Cyan

if (-not (Wait-ForServices)) {
    Write-Host ""
    Write-Host "💡 Les services ne sont pas accessibles. Assurez-vous que Docker Compose est en cours d'exécution :" -ForegroundColor Yellow
    Write-Host "   docker-compose up --build" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Tests des endpoints
Write-Host ""
Write-Host "🧪 Tests des endpoints..." -ForegroundColor Cyan
Write-Host "------------------------" -ForegroundColor Cyan

Test-Service "Diego" $DIEGO_URL "/test"
Test-Service "Miguel" $MIGUEL_URL "/test"

# Test d'analyse
Write-Host ""
Write-Host "📈 Test d'analyse de marché..." -ForegroundColor Cyan
Write-Host "------------------------------" -ForegroundColor Cyan

try {
    $body = @{
        symbol = "BTCUSDT"
        timeframe = "1h"
    } | ConvertTo-Json

    Write-Host "Envoi de la requête d'analyse..."
    $response = Invoke-RestMethod -Uri "$DIEGO_URL/analyze" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 30
    
    Write-Host "✅ Analyse réussie!" -ForegroundColor Green
    Write-Host "📊 Résultat:" -ForegroundColor Cyan
    Write-Host ($response | ConvertTo-Json -Depth 3)
    
    if ($response.id) {
        Write-Host ""
        Write-Host "🎯 Stratégie créée avec l'ID: $($response.id)" -ForegroundColor Green
        Write-Host "   (Miguel devrait automatiquement recevoir cette stratégie)" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ Test d'analyse échoué: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "💡 Vérifiez les logs avec: docker-compose logs diego" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 Tests terminés!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Pour voir les logs en temps réel:" -ForegroundColor Yellow
Write-Host "   docker-compose logs -f" -ForegroundColor White
Write-Host ""
Write-Host "💡 Pour arrêter l'application:" -ForegroundColor Yellow
Write-Host "   docker-compose down" -ForegroundColor White
