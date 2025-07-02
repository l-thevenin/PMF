#!/usr/bin/env pwsh

# Script pour tester le nouveau workflow PMF
Write-Host "🚀 Démarrage du test du workflow PMF..." -ForegroundColor Green

Write-Host "📋 Workflow testé:" -ForegroundColor Yellow
Write-Host "1. Pedro demande analyse à Diego (toutes les 60s)" -ForegroundColor White
Write-Host "2. Diego analyse le marché et notifie Miguel si signal d'achat" -ForegroundColor White
Write-Host "3. Miguel achète sur Binance testnet" -ForegroundColor White
Write-Host "4. Miguel surveille automatiquement les conditions de vente:" -ForegroundColor White
Write-Host "   - Stop loss atteint" -ForegroundColor White
Write-Host "   - Take profit atteint" -ForegroundColor White
Write-Host "   - Durée de holding dépassée (60s par défaut)" -ForegroundColor White
Write-Host "5. Miguel vend automatiquement et envoie feedback à Diego" -ForegroundColor White

Write-Host ""
Write-Host "🔧 Paramètres configurés:" -ForegroundColor Yellow
Write-Host "- HOLDING_DURATION_MS=60000 (1 minute)" -ForegroundColor White
Write-Host "- Mode Binance: TESTNET" -ForegroundColor White
Write-Host "- Surveillance prix: toutes les 5 secondes" -ForegroundColor White

Write-Host ""
Write-Host "🏗️ Construction et démarrage des services..." -ForegroundColor Green

# Construire et démarrer tous les services
docker-compose up --build -d

Write-Host ""
Write-Host "✅ Services démarrés ! Surveillez les logs avec:" -ForegroundColor Green
Write-Host "docker-compose logs -f pedro miguel diego" -ForegroundColor Cyan

Write-Host ""
Write-Host "📊 Vous pouvez également surveiller:" -ForegroundColor Yellow
Write-Host "- Dashboard: http://localhost:3002" -ForegroundColor White
Write-Host "- pgAdmin: http://localhost:8080 (admin@pmf.com / admin123)" -ForegroundColor White

Write-Host ""
Write-Host "⏹️ Pour arrêter: docker-compose down" -ForegroundColor Red
