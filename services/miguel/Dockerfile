FROM node:18-alpine

# Install OpenSSL
RUN apk add --no-cache openssl

WORKDIR /app

# Copier les fichiers de configuration du projet
COPY package*.json ./
COPY tsconfig.json ./

# Copier les fichiers du module shared
COPY shared/package*.json ./shared/
COPY shared/tsconfig.json ./shared/
COPY shared/src/ ./shared/src/

# Copier les fichiers du service miguel
COPY services/miguel/package*.json ./services/miguel/
COPY services/miguel/tsconfig.json ./services/miguel/
COPY services/miguel/src/ ./services/miguel/src/
COPY services/miguel/prisma/ ./services/miguel/prisma/

# Installer les dépendances et générer les types Prisma
RUN npm install
RUN cd services/miguel && npx prisma generate

# Construire d'abord le module shared
RUN cd shared && npm run build

# Construire le service miguel
RUN cd services/miguel && npm run build

WORKDIR /app/services/miguel

EXPOSE 3001

CMD ["npm", "start"]
