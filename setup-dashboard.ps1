# PowerShell script for Windows setup
Write-Host "🚀 Setting up PMF Dashboard..." -ForegroundColor Green

# Navigate to dashboard frontend directory
Set-Location "services\dashboard\frontend"

Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Yellow
npm install

Write-Host "🎨 Initializing Tailwind CSS..." -ForegroundColor Yellow
npx tailwindcss init -p

Write-Host "✅ Dashboard setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Dashboard will be available at:" -ForegroundColor Cyan
Write-Host "   http://localhost:3002" -ForegroundColor White
Write-Host ""
Write-Host "🔧 To start development:" -ForegroundColor Cyan
Write-Host "   cd services\dashboard\frontend && npm start" -ForegroundColor White
