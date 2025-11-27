# PowerShell script to start Next.js dev server with troubleshooting

Write-Host "Starting Next.js development server..." -ForegroundColor Cyan

# Check if .next folder exists and remove it
if (Test-Path ".next") {
    Write-Host "Cleaning .next cache..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force .next
    Write-Host "Cache cleaned!" -ForegroundColor Green
}

# Check if port 3000 is in use
$portInUse = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "WARNING: Port 3000 is already in use!" -ForegroundColor Red
    Write-Host "Please close the application using port 3000 or use a different port." -ForegroundColor Yellow
    Write-Host "You can specify a different port with: npm run dev -- -p 3001" -ForegroundColor Yellow
    exit 1
}

# Start the dev server
Write-Host "Starting dev server on http://localhost:3000" -ForegroundColor Green
npm run dev

