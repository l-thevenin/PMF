#!/bin/bash

# Script de test simple pour l'application PMF

echo "🚀 Test de l'application PMF Trading Bot"
echo "========================================"

# Configuration
DIEGO_URL="http://localhost:3000"
MIGUEL_URL="http://localhost:3001"

# Fonction pour faire une pause
pause() {
    echo "Appuyez sur Entrée pour continuer..."
    read
}

# Test 1: Health checks
echo ""
echo "📊 Test 1: Vérification de l'état des services"
echo "----------------------------------------------"

echo "Test Diego..."
curl -s "$DIEGO_URL/health" | jq '.' || echo "❌ Diego non accessible"

echo ""
echo "Test Miguel..."
curl -s "$MIGUEL_URL/health" | jq '.' || echo "❌ Miguel non accessible"

pause

# Test 2: Endpoints de test
echo ""
echo "🔧 Test 2: Endpoints de test"
echo "----------------------------"

echo "Test Diego /test..."
curl -s "$DIEGO_URL/test" | jq '.' || echo "❌ Endpoint test Diego échoué"

echo ""
echo "Test Miguel /test..."
curl -s "$MIGUEL_URL/test" | jq '.' || echo "❌ Endpoint test Miguel échoué"

pause

# Test 3: Analyse de marché
echo ""
echo "📈 Test 3: Analyse de marché"
echo "----------------------------"

echo "Lancement de l'analyse BTCUSDT..."
ANALYSIS_RESULT=$(curl -s -X POST "$DIEGO_URL/analyze" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTCUSDT", "timeframe": "1h"}')

echo "Résultat de l'analyse:"
echo "$ANALYSIS_RESULT" | jq '.' || echo "❌ Analyse échouée"

# Extraire l'ID de la stratégie si possible
STRATEGY_ID=$(echo "$ANALYSIS_RESULT" | jq -r '.id' 2>/dev/null)

if [ "$STRATEGY_ID" != "null" ] && [ "$STRATEGY_ID" != "" ]; then
    echo "✅ Stratégie créée avec l'ID: $STRATEGY_ID"
    
    pause
    
    # Test 4: Vérification que Miguel a reçu la stratégie
    echo ""
    echo "🎯 Test 4: Attente de l'exécution automatique..."
    echo "-----------------------------------------------"
    echo "La stratégie devrait être automatiquement envoyée à Miguel."
    echo "Vérifiez les logs de Miguel pour voir si l'exécution a eu lieu."
    
else
    echo "❌ Impossible d'extraire l'ID de la stratégie"
fi

pause

# Test 5: Test manuel d'exécution de stratégie
echo ""
echo "🚀 Test 5: Test manuel d'exécution (optionnel)"
echo "----------------------------------------------"

if [ "$STRATEGY_ID" != "null" ] && [ "$STRATEGY_ID" != "" ]; then
    echo "Exécution manuelle de la stratégie $STRATEGY_ID..."
    curl -s -X POST "$MIGUEL_URL/execute-strategy" \
      -H "Content-Type: application/json" \
      -d "{\"strategyId\": \"$STRATEGY_ID\"}" | jq '.' || echo "❌ Exécution manuelle échouée"
else
    echo "Pas de stratégie à exécuter (utilisez l'ID d'une stratégie existante si nécessaire)"
fi

echo ""
echo "🎉 Tests terminés!"
echo "=================="
echo ""
echo "💡 Conseils:"
echo "- Vérifiez les logs avec: docker-compose logs -f"
echo "- Pour arrêter: docker-compose down"
echo "- Pour redémarrer: docker-compose up --build"
