#!/bin/bash

echo "🚀 Setting up PMF Dashboard..."

# Navigate to dashboard frontend directory
cd services/dashboard/frontend

echo "📦 Installing frontend dependencies..."
npm install

echo "🎨 Initializing Tailwind CSS..."
npx tailwindcss init -p

echo "✅ Dashboard setup complete!"
echo ""
echo "📊 Dashboard will be available at:"
echo "   http://localhost:3002"
echo ""
echo "🔧 To start development:"
echo "   cd services/dashboard/frontend && npm start"
