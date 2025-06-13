# PMF Scheduler Service

Le scheduler PMF est responsable de l'automatisation du scalping en déclenchant des analyses périodiques via le service Diego.

## Fonctionnalités

- **Exécution automatique** : Déclenche une analyse Diego toutes les 60 secondes
- **Gestion des erreurs** : Système de retry avec délais configurables
- **Monitoring** : Statistiques détaillées des exécutions
- **Configuration flexible** : Variables d'environnement pour personnaliser le comportement

## Configuration

### Variables d'environnement

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `DIEGO_URL` | URL du service Diego | `http://diego:3001` |
| `CRON_PATTERN` | Pattern cron pour la fréquence | `0 * * * * *` (60s) |
| `ENABLE_SCHEDULER` | Activer/désactiver le scheduler | `true` |
| `RETRY_ATTEMPTS` | Nombre de tentatives en cas d'échec | `3` |
| `RETRY_DELAY_MS` | Délai entre tentatives (ms) | `5000` |
| `RUN_ON_START` | Exécuter immédiatement au démarrage | `true` |

### Pattern Cron

Le pattern par défaut `0 * * * * *` signifie :
- Exécuter à la seconde 0 de chaque minute
- Soit toutes les 60 secondes

Autres exemples :
- `*/30 * * * * *` : Toutes les 30 secondes
- `0 */2 * * * *` : Toutes les 2 minutes
- `0 0 */1 * * *` : Toutes les heures

## Fonctionnement

1. **Démarrage** : Le scheduler attend que Diego et Miguel soient prêts
2. **Cycle d'exécution** :
   - Appel POST vers `/analyze` de Diego
   - Diego analyse le marché BTC/USDT sur timeframe 1m
   - Diego appelle automatiquement Miguel si nécessaire
   - Logging des résultats et statistiques
3. **Gestion d'erreurs** : Retry automatique en cas d'échec
4. **Monitoring** : Statistiques affichées toutes les 10 minutes

## API de Diego appelée

```http
POST http://diego:3001/analyze
Content-Type: application/json

{
  "symbol": "BTC/USDT",
  "timeframe": "1m",
  "triggerExecution": true
}
```

## Logs et Monitoring

Le scheduler produit des logs détaillés incluant :
- Timestamp de chaque exécution
- Résultats des analyses Diego
- Résultats des exécutions Miguel
- Statistiques de performance
- Gestion des erreurs avec stack traces

### Exemple de logs

```
[2024-01-20T10:00:00.000Z] [SCHEDULER] Starting scalping cycle #1
[2024-01-20T10:00:01.234Z] [SCHEDULER] Calling Diego analysis endpoint...
[2024-01-20T10:00:02.456Z] [SCHEDULER] Diego response: 200 { success: true, ... }
[2024-01-20T10:00:02.457Z] [SCHEDULER] Scalping cycle completed successfully
```

## Commandes de développement

```bash
# Installer les dépendances
npm install

# Développement avec rechargement auto
npm run dev

# Build
npm run build

# Production
npm start
```

## Intégration Docker

Le scheduler est intégré dans le docker-compose.yml principal et démarre automatiquement après Diego et Miguel.

```bash
# Démarrer tout le stack PMF avec scheduler
docker-compose up --build

# Voir les logs du scheduler uniquement
docker-compose logs -f scheduler

# Redémarrer juste le scheduler
docker-compose restart scheduler
```

## Architecture

```
Scheduler ──(60s)──> Diego ──(analysis)──> Miguel ──(execution)──> Database
    │                   │                      │                      │
    └─── Stats ─────────┴──── Logs ────────────┴──── Results ────────┘
```

## Sécurité

- Le scheduler n'expose aucun port
- Utilise un utilisateur non-root dans Docker
- Gestion propre des signaux système (SIGINT, SIGTERM)
- Gestion des exceptions non capturées
