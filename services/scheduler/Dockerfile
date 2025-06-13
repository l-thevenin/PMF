# Utiliser Node.js 18 Alpine
FROM node:18-alpine

# Installer les dépendances système nécessaires
RUN apk add --no-cache openssl curl

# Créer le répertoire de l'application
WORKDIR /app

# Copier les fichiers de configuration des dépendances depuis le contexte scheduler
COPY services/scheduler/package*.json ./
COPY services/scheduler/tsconfig.json ./

# Installer les dépendances
RUN npm install

# Copier le code source
COPY services/scheduler/src/ ./src/

# Compiler TypeScript
RUN npm run build

# Exposer le port (optionnel, le scheduler n'expose pas de port mais c'est pour la cohérence)
EXPOSE 3003

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && adduser -S scheduler -u 1001 -G nodejs
USER scheduler

# Commande de démarrage
CMD ["npm", "start"]
