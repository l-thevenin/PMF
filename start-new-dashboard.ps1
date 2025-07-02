#!/usr/bin/env pwsh

Write-Host "🚀 Démarrage du nouveau Dashboard PMF avec Workflow Automatique" -ForegroundColor Green

Write-Host ""
Write-Host "📈 Nouveautés du Dashboard:" -ForegroundColor Yellow
Write-Host "✨ Workflow Status - Surveillance de Pedro, Diego et Miguel en temps réel" -ForegroundColor White
Write-Host "🕐 Live Trades Monitor - Visualisation des trades en surveillance automatique" -ForegroundColor White  
Write-Host "📊 Trading Metrics - Métriques pertinentes : profit total, raisons de vente, top symboles" -ForegroundColor White
Write-Host "💰 Calcul de profit simplifié : prix de vente - prix d'achat" -ForegroundColor White
Write-Host "❌ Suppression des graphiques peu pertinents (profit journalier/nombre de trades)" -ForegroundColor White

Write-Host ""
Write-Host "🔧 Configuration:" -ForegroundColor Yellow
Write-Host "- Pedro : Analyse toutes les 60s" -ForegroundColor White
Write-Host "- Diego : Analyse de marché et génération de stratégies" -ForegroundColor White
Write-Host "- Miguel : Trading automatique avec surveillance" -ForegroundColor White
Write-Host "- Vente auto : Stop Loss | Take Profit | Time Limit (60s)" -ForegroundColor White

Write-Host ""
Write-Host "🏗️ Construction et démarrage..." -ForegroundColor Green

# Démarrer Docker Compose
docker-compose up --build -d

Write-Host ""
Write-Host "✅ Système démarré !" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Accès au Dashboard:" -ForegroundColor Cyan
Write-Host "   http://localhost:3002" -ForegroundColor White
Write-Host ""
Write-Host "📊 Autres interfaces:" -ForegroundColor Yellow
Write-Host "   pgAdmin: http://localhost:8080" -ForegroundColor White
Write-Host "   (admin@pmf.com / admin123)" -ForegroundColor Gray

Write-Host ""
Write-Host "📜 Surveillance des logs:" -ForegroundColor Yellow
Write-Host "   docker-compose logs -f pedro diego miguel" -ForegroundColor White

Write-Host ""
Write-Host "⏹️ Pour arrêter: docker-compose down" -ForegroundColor Red
