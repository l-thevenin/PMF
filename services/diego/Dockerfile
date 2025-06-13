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

# Copier les fichiers du service diego
COPY services/diego/package*.json ./services/diego/
COPY services/diego/tsconfig.json ./services/diego/
COPY services/diego/src/ ./services/diego/src/
COPY services/diego/prisma/ ./services/diego/prisma/

# Installer les dépendances et générer les types Prisma
RUN npm install
RUN cd services/diego && npx prisma generate

# Construire d'abord le module shared
RUN cd shared && npm run build

# Construire le service diego
RUN cd services/diego && npm run build

WORKDIR /app/services/diego

EXPOSE 3000

CMD ["npm", "start"]
