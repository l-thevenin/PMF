#!/bin/bash

echo "🚀 Starting PMF Trading Bot with Dashboard..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  Creating .env file from example..."
    cp .env.example .env
    echo "✅ Please edit .env with your Binance API keys"
fi

# Start all services with Docker Compose
echo "🐳 Starting all services with Docker..."
docker-compose up --build

echo "📊 Services available at:"
echo "   - Diego API: http://localhost:3000"
echo "   - Miguel API: http://localhost:3001"
echo "   - Dashboard: http://localhost:3002"
echo "   - Database: localhost:5432"
