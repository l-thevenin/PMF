# PowerShell script for Windows
Write-Host "🚀 Starting PMF Trading Bot with Dashboard..." -ForegroundColor Green

# Check if .env exists
if (!(Test-Path ".env")) {
    Write-Host "⚠️  Creating .env file from example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✅ Please edit .env with your Binance API keys" -ForegroundColor Green
}

# Start all services with Docker Compose
Write-Host "🐳 Starting all services with Docker..." -ForegroundColor Cyan
docker-compose up --build

Write-Host "📊 Services available at:" -ForegroundColor Green
Write-Host "   - Diego API: http://localhost:3000" -ForegroundColor White
Write-Host "   - Miguel API: http://localhost:3001" -ForegroundColor White
Write-Host "   - Dashboard: http://localhost:3002" -ForegroundColor White
Write-Host "   - Database: localhost:5432" -ForegroundColor White
