# Script de test PowerShell pour l'application PMF

Write-Host "🚀 Test de l'application PMF Trading Bot" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# Configuration
$DIEGO_URL = "http://localhost:3000"
$MIGUEL_URL = "http://localhost:3001"

# Fonction pour faire une pause
function Pause {
    Write-Host "Appuyez sur Entrée pour continuer..." -ForegroundColor Yellow
    Read-Host
}

# Test 1: Health checks
Write-Host ""
Write-Host "📊 Test 1: Vérification de l'état des services" -ForegroundColor Cyan
Write-Host "----------------------------------------------" -ForegroundColor Cyan

Write-Host "Test Diego..."
try {
    $response = Invoke-RestMethod -Uri "$DIEGO_URL/health" -Method Get
    Write-Host "✅ Diego: $($response | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "❌ Diego non accessible: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Test Miguel..."
try {
    $response = Invoke-RestMethod -Uri "$MIGUEL_URL/health" -Method Get
    Write-Host "✅ Miguel: $($response | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "❌ Miguel non accessible: $($_.Exception.Message)" -ForegroundColor Red
}

Pause

# Test 2: Endpoints de test
Write-Host ""
Write-Host "🔧 Test 2: Endpoints de test" -ForegroundColor Cyan
Write-Host "----------------------------" -ForegroundColor Cyan

Write-Host "Test Diego /test..."
try {
    $response = Invoke-RestMethod -Uri "$DIEGO_URL/test" -Method Get
    Write-Host "✅ Diego test: $($response | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "❌ Endpoint test Diego échoué: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Test Miguel /test..."
try {
    $response = Invoke-RestMethod -Uri "$MIGUEL_URL/test" -Method Get
    Write-Host "✅ Miguel test: $($response | ConvertTo-Json)" -ForegroundColor Green
} catch {
    Write-Host "❌ Endpoint test Miguel échoué: $($_.Exception.Message)" -ForegroundColor Red
}

Pause

# Test 3: Analyse de marché
Write-Host ""
Write-Host "📈 Test 3: Analyse de marché" -ForegroundColor Cyan
Write-Host "----------------------------" -ForegroundColor Cyan

Write-Host "Lancement de l'analyse BTCUSDT..."
try {
    $body = @{
        symbol = "BTCUSDT"
        timeframe = "1h"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$DIEGO_URL/analyze" -Method Post -Body $body -ContentType "application/json"
    Write-Host "✅ Analyse réussie:" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 3)
    
    $strategyId = $response.id
    Write-Host "✅ Stratégie créée avec l'ID: $strategyId" -ForegroundColor Green
    
    Pause
    
    # Test 4: Information sur l'exécution automatique
    Write-Host ""
    Write-Host "🎯 Test 4: Exécution automatique" -ForegroundColor Cyan
    Write-Host "--------------------------------" -ForegroundColor Cyan
    Write-Host "La stratégie devrait être automatiquement envoyée à Miguel." -ForegroundColor Yellow
    Write-Host "Vérifiez les logs de Miguel pour voir si l'exécution a eu lieu." -ForegroundColor Yellow
    
    Pause
    
    # Test 5: Test manuel d'exécution
    Write-Host ""
    Write-Host "🚀 Test 5: Test manuel d'exécution" -ForegroundColor Cyan
    Write-Host "-----------------------------------" -ForegroundColor Cyan
    
    if ($strategyId) {
        Write-Host "Exécution manuelle de la stratégie $strategyId..."
        try {
            $execBody = @{
                strategyId = $strategyId
            } | ConvertTo-Json
            
            $execResponse = Invoke-RestMethod -Uri "$MIGUEL_URL/execute-strategy" -Method Post -Body $execBody -ContentType "application/json"
            Write-Host "✅ Exécution manuelle réussie:" -ForegroundColor Green
            Write-Host ($execResponse | ConvertTo-Json -Depth 3)
        } catch {
            Write-Host "❌ Exécution manuelle échouée: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
} catch {
    Write-Host "❌ Analyse échouée: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 Tests terminés!" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Conseils:" -ForegroundColor Yellow
Write-Host "- Vérifiez les logs avec: docker-compose logs -f" -ForegroundColor White
Write-Host "- Pour arrêter: docker-compose down" -ForegroundColor White
Write-Host "- Pour redémarrer: docker-compose up --build" -ForegroundColor White

Pause
