# PMF - Crypto Trading Bot

Un système de trading automatisé avec trois microservices :
- **Diego** : Service d'analyse de marché et génération de stratégies
- **Miguel** : Service d'exécution de trades
- **Dashboard** : Interface web pour visualiser les performances et trades

## Architecture

```
┌─────────────┐    HTTP     ┌─────────────┐
│   Diego     │ ─────────→ │   Miguel    │
│ (Analysis)  │             │ (Execution) │
└─────────────┘             └─────────────┘
       │                           │
       └───────────┬─────────────┘
                   │
            ┌──────────────┐
            │ PostgreSQL   │
            │  Database    │
            └──────┬───────┘
                   │
            ┌──────────────┐
            │  Dashboard   │
            │ (Frontend)   │
            └──────────────┘
```

## Prérequis

- Docker et Docker Compose
- Node.js 18+ (pour le développement local)
- API Keys Binance (mode test)

## Configuration

1. Copiez le fichier `.env.example` vers `.env` :
```bash
cp .env.example .env
```

2. Modifiez les variables d'environnement dans `.env` :
```bash
# Ajoutez vos clés API Binance de test
BINANCE_TEST_API_KEY=your_test_api_key_here
BINANCE_TEST_API_SECRET=your_test_api_secret_here
```

## Démarrage rapide

### Avec Docker (Recommandé)

```bash
# Démarrer tous les services
docker-compose up --build

# Accéder aux services :
# - Diego (API) : http://localhost:3000
# - Miguel (API) : http://localhost:3001  
# - Dashboard (Web) : http://localhost:3002
```

## 📊 Dashboard Web

Le dashboard fournit une interface graphique moderne pour :
- **Vue d'ensemble** : Statistiques générales (stratégies, trades, taux de réussite, profits)
- **Graphiques de performance** : Évolution des profits et trades sur 7 jours
- **Liste des stratégies** : Stratégies récentes avec leurs performances
- **Tableau des trades** : Historique détaillé des trades avec statuts et profits
- **Actualisation en temps réel** : Mise à jour automatique toutes les 30 secondes

### Accès au Dashboard
- **URL** : http://localhost:3002
- **Fonctionnalités** :
  - ✅ Responsive design (mobile/desktop)
  - 📈 Graphiques interactifs avec Recharts
  - 🔄 Actualisation automatique
  - 🎨 Interface moderne avec Tailwind CSS
  - ⚡ API en lecture seule pour les performances

# Voir les logs
docker-compose logs -f

# Arrêter les services
docker-compose down
```

### Développement local

```bash
# Installer les dépendances
npm install

# Construire les packages
npm run build

# Démarrer la base de données
docker-compose up db -d

# Dans des terminaux séparés :
npm run start:diego
npm run start:miguel
```

## Utilisation

### Endpoints disponibles

#### Diego (Port 3000)
- `GET /health` - Check de santé
- `GET /test` - Test de fonctionnement
- `POST /analyze` - Analyser un marché et générer une stratégie
- `POST /feedback` - Recevoir des retours de Miguel

#### Miguel (Port 3001)
- `GET /health` - Check de santé
- `GET /test` - Test de fonctionnement
- `POST /execute-strategy` - Exécuter une stratégie

#### Dashboard (Port 3002)
- `GET /` - Interface web du dashboard
- `GET /api/overview` - Statistiques générales
- `GET /api/strategies` - Liste des stratégies récentes
- `GET /api/trades` - Liste des trades récents
- `GET /api/performance` - Données de performance
- `GET /api/trades-by-symbol` - Statistiques par symbole
- `GET /api/health` - Check de santé du dashboard

### Exemple d'utilisation

```bash
# Tester que les services fonctionnent
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/api/health

# Analyser le marché BTC/USDT
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol": "BTCUSDT", "timeframe": "1h"}'

# Voir les données du dashboard
curl http://localhost:3002/api/overview
curl http://localhost:3002/api/strategies
curl http://localhost:3002/api/trades
```

## 🛠️ Développement

### Configuration initiale du Dashboard

```bash
# Windows
.\setup-dashboard.ps1

# Linux/Mac
chmod +x setup-dashboard.sh
./setup-dashboard.sh
```
```

## Tests

```bash
# Tests unitaires
npm test

# Tests d'intégration
npm run test:integration

# Tests avec Docker
npm run test:docker
```

## Dépannage

### Problèmes courants

1. **Erreur de connexion à la base de données**
   ```bash
   # Vérifiez que PostgreSQL est en cours d'exécution
   docker-compose ps
   
   # Redémarrez la base de données
   docker-compose restart db
   ```

2. **Erreurs de build TypeScript**
   ```bash
   # Nettoyez et reconstruisez
   npm run clean
   npm run build
   ```

3. **Services inaccessibles**
   ```bash
   # Vérifiez les ports
   docker-compose ps
   
   # Vérifiez les logs
   docker-compose logs diego
   docker-compose logs miguel
   ```

### Logs utiles

```bash
# Voir tous les logs
docker-compose logs

# Suivre les logs en temps réel
docker-compose logs -f

# Logs d'un service spécifique
docker-compose logs diego
docker-compose logs miguel
```

## Structure du projet

```
├── services/
│   ├── diego/          # Service d'analyse
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── server.ts
│   │   │   ├── analysis.ts
│   │   │   └── communication.ts
│   │   └── prisma/
│   └── miguel/         # Service d'exécution
│       ├── src/
│       │   └── index.ts
│       └── prisma/
├── shared/             # Types et utilitaires partagés
├── tests/              # Tests d'intégration
└── docker-compose.yml  # Configuration Docker
```

## API Reference

### POST /analyze
Analyse un marché et génère une stratégie de trading.

**Request:**
```json
{
  "symbol": "BTCUSDT",
  "timeframe": "1h"
}
```

**Response:**
```json
{
  "id": "uuid",
  "symbol": "BTCUSDT",
  "timeframe": "1h",
  "parameters": {
    "action": "BUY",
    "price": 45000,
    "quantity": 0.001,
    "stopLoss": 44000,
    "takeProfit": 47000
  },
  "confidence": 0.75,
  "createdAt": "2025-06-13T..."
}
```

## Développement

### Ajout de nouvelles fonctionnalités

1. **Nouveaux indicateurs techniques** : Modifiez `services/diego/src/analysis.ts`
2. **Nouvelles stratégies** : Ajoutez des logiques dans `generateStrategy()`
3. **Types partagés** : Modifiez `shared/src/types.ts`

### Debugging

Les services supportent le debugging Node.js :
- Diego : Port 9229
- Miguel : Port 9230

```bash
# Connectez votre debugger à localhost:9229 ou localhost:9230
```

## Contributing

1. Fork le projet
2. Créez une branche pour votre fonctionnalité
3. Committez vos changements
4. Poussez vers la branche
5. Ouvrez une Pull Request

## License

ISC
