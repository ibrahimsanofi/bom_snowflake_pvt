# test.ps1 - Launches the Node.js server and http-server to properly serve fact_bom.html

Write-Host "🎬 Initialization..."

# === 1. Retrieve the UPN (username) ===
try {
    $USERNAME = whoami /upn
    Write-Host "👤 Username (UPN) detected: $USERNAME"
} catch {
    Write-Host "❌ Unable to retrieve UPN via whoami /upn."
    exit 1
}

# === 2. Defining environment variables ===
$env:ACCOUNT   = "SANOFI-EMEA_IA"
$env:USER      = $USERNAME
$env:ROLE      = "ONEMNS_PROD_ANALYTICS_PROC"
$env:WAREHOUSE = "ONEMNS_PROD_WH_ANALYTICS"
$env:DATABASE  = "ONEMNS_PROD"
$env:SCHEMA    = "DMT_BOM"

# === 3. Checking HTML file ===
$htmlPath = Resolve-Path ../fact_bom.html -ErrorAction SilentlyContinue
if (-not $htmlPath) {
    Write-Host "❌ The file 'fact_bom.html' was not found in the 'container/' folder."
    exit 1
}
Write-Host "✅ HTML file found: $htmlPath"

# === 4. Launching Node.js server on port 3000 ===
Write-Host "🚀 Launching Node.js server (port 3000)..."
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "snowflakeServer.js 3000"

# === 5. Launching HTTP server (http-server) on port 8081 ===
Write-Host "🌐 Launching http-server to serve static files (port 8081)..."
Start-Process -NoNewWindow -FilePath "cmd" -ArgumentList "/c npx http-server -p 8081" -WorkingDirectory "../"

# Pause to let servers start
Start-Sleep -Seconds 2

# === 6. Automatically opening the HTML page in the browser ===
Write-Host "🌍 Opening the page in the browser..."
Start-Process "http://localhost:8081/sso.html"

# === 7. End ===
Write-Host "✅ Servers started and HTML page opened successfully."
Write-Host "🛑 To stop the servers, use 'Stop-Process' or manually close the Node/npx processes."
