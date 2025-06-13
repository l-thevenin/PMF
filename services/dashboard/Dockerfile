# Multi-stage build for Dashboard
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY services/dashboard/frontend/package*.json ./
COPY services/dashboard/frontend/tailwind.config.js ./
COPY services/dashboard/frontend/postcss.config.js ./
COPY services/dashboard/frontend/tsconfig.json ./

# Install frontend dependencies
RUN npm install

# Copy frontend source
COPY services/dashboard/frontend/public ./public
COPY services/dashboard/frontend/src ./src

# Build frontend
RUN npm run build

# Backend stage
FROM node:18-alpine AS backend

# Install OpenSSL and other necessary libraries for Prisma
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy backend package files
COPY services/dashboard/package*.json ./
COPY services/dashboard/tsconfig.json ./

# Copy prisma directory before npm install (needed for postinstall script)
COPY services/dashboard/prisma ./prisma

# Install backend dependencies
RUN npm install

# Copy backend source
COPY services/dashboard/src ./src

# Build backend
RUN npm run build

# Copy built frontend from frontend-builder stage
COPY --from=frontend-builder /app/frontend/build ./frontend/build

EXPOSE 3002

CMD ["npm", "start"]
