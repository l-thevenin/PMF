# PMF Trading Bot - Workflow Automatique

## 🔄 Workflow Complet

### 1. Pedro (Scheduler)
- Demande une analyse à Diego toutes les 60 secondes (configurable via `CRON_PATTERN`)
- Passe la durée de holding configurée (`HOLDING_DURATION_MS`)

### 2. Diego (Analyste)
- Analyse les données de marché en temps réel depuis Binance
- Génère une stratégie avec stop loss et take profit
- **Si signal d'achat** : Notifie Miguel avec la stratégie et la durée de holding
- Reçoit le feedback détaillé de Miguel après chaque trade

### 3. Miguel (Trader)
- **À la réception d'un signal BUY** :
  1. Vérifie le portefeuille disponible
  2. Exécute l'achat sur **Binance testnet** (argent virtuel)
  3. Démarre la surveillance automatique des conditions de vente
  4. Envoie le feedback d'achat à Diego

- **Surveillance automatique de vente** (toutes les 5 secondes) :
  - ✅ **Stop Loss** : Vend si prix ≤ stop loss
  - ✅ **Take Profit** : Vend si prix ≥ take profit  
  - ✅ **Time Limit** : Vend après la durée de holding (par défaut 1 minute)

- **À la vente** :
  1. Exécute la vente sur Binance testnet
  2. Calcule le profit/perte
  3. Envoie le feedback complet à Diego (prix achat, prix vente, quantité, profit)

## ⚙️ Configuration

### Variables d'environnement (.env)
```bash
# Clés API Binance Testnet (RÉELLES - pour données de marché)
BINANCE_TEST_API_KEY=votre_clé_testnet
BINANCE_TEST_API_SECRET=votre_secret_testnet

# Configuration Pedro
HOLDING_DURATION_MS=60000  # 1 minute par défaut
CRON_PATTERN="0 * * * * *"  # Toutes les 60 secondes

# Symboles à trader (optionnel)
TRADING_SYMBOLS=BTCUSDT,ETHUSDT,ADAUSDT
TRADING_TIMEFRAMES=1m,5m,15m
```

### Sécurité
- ✅ **Mode testnet** : Utilise l'argent virtuel de Binance
- ✅ **Données réelles** : Analyses basées sur les vrais prix de marché
- ✅ **Aucun risque financier** : Tous les trades sont simulés

## 🚀 Démarrage

### Option 1: Script automatique
```powershell
.\test-workflow.ps1
```

### Option 2: Manuel
```bash
docker-compose up --build
```

## 📊 Surveillance

### Logs en temps réel
```bash
docker-compose logs -f pedro miguel diego
```

### Interfaces Web
- **Dashboard** : http://localhost:3002
- **pgAdmin** : http://localhost:8080 (admin@pmf.com / admin123)

## 🔍 Exemple de Logs

### Pedro → Diego
```
[PEDRO] Calling Diego analysis endpoint for BTCUSDT...
[DIEGO] Trend analysis for BTCUSDT: direction=UP, strength=0.75
[DIEGO] Strategy generated: action=BUY, confidence=0.82
```

### Diego → Miguel
```
[DIEGO] Notifying Miguel about strategy 123 for BTCUSDT
[MIGUEL] Executing BUY order: 0.001 BTCUSDT at market price
[MIGUEL] ✅ Buy order executed on Binance testnet
```

### Miguel → Surveillance automatique
```
[MIGUEL] 🕐 Starting automatic sell monitoring for trade 456
[MIGUEL] 📊 Price check: BTCUSDT at 43250.5 (+2.1% from buy price)
[MIGUEL] 🎯 Take profit triggered: 43500 >= 43400
[MIGUEL] ✅ Sell order executed, profit: $12.50
```

### Miguel → Diego (Feedback)
```
[DIEGO] 📊 Received feedback from Miguel:
- Symbol: BTCUSDT
- Buy Price: 42500
- Sell Price: 43500  
- Quantity: 0.001
- Profit: $12.50
- Reason: TAKE_PROFIT
```

## 📈 Métriques Trackées

- Nombre total de cycles d'analyse
- Taux de succès des analyses
- Profits/Pertes par trade
- Raisons de vente (stop loss, take profit, time limit)
- Performance par symbole et timeframe

## 🛑 Arrêt

```bash
docker-compose down
```

Tous les monitorings actifs sont automatiquement arrêtés proprement.
