# Utiliser Node.js 18 Alpine
FROM node:18-alpine

# Installer les dépendances système nécessaires
RUN apk add --no-cache openssl curl

# Créer le répertoire de l'application
WORKDIR /app

# Copier les fichiers de configuration des dépendances depuis le contexte pedro
COPY services/pedro/package*.json ./
COPY services/pedro/tsconfig.json ./

# Installer les dépendances
RUN npm install

# Copier le code source
COPY services/pedro/src/ ./src/

# Compiler TypeScript
RUN npm run build

# Exposer le port (optionnel, le scheduler n'expose pas de port mais c'est pour la cohérence)
EXPOSE 3003

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && adduser -S pedro -u 1001 -G nodejs
USER pedro

# Commande de démarrage
CMD ["npm", "start"]
