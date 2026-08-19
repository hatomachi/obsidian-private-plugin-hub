<#
.SYNOPSIS
    Private Plugin Hub - 1-Click Publishing Script for Custom Obsidian Plugins
.DESCRIPTION
    Builds the current plugin, transfers manifest.json, main.js, styles.css to remote EC2/server via SCP,
    and automatically updates the central registry.json.
#>

param (
    [string]$ServerUser = "ubuntu",
    [string]$ServerHost = "your-ec2-domain-or-ip.com",
    [string]$RemoteHubDir = "/var/www/hub",
    [string]$SSHKeyPath = ""
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Private Plugin Hub - Auto Publisher" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Check if manifest.json exists
if (-not (Test-Path "./manifest.json")) {
    Write-Error "manifest.json not found in current directory! Please run this from your plugin root."
    exit 1
}

# 2. Read manifest information
$manifest = Get-Content -Raw -Path "./manifest.json" | ConvertFrom-Json
$pluginId = $manifest.id
$version = $manifest.version
$pluginName = $manifest.name

Write-Host "[1/4] Target Plugin: $pluginName ($pluginId) v$version" -ForegroundColor Yellow

# 3. Build project
Write-Host "[2/4] Building plugin (npm run build)..." -ForegroundColor Yellow
npm run build

# 4. Prepare files to transfer
$filesToTransfer = @("manifest.json", "main.js")
if (Test-Path "./styles.css") {
    $filesToTransfer += "styles.css"
}

$remotePluginDir = "$RemoteHubDir/plugins/$pluginId"

# SSH Command Prefix
$sshCmd = "ssh"
$scpCmd = "scp"
if ($SSHKeyPath -ne "") {
    $sshCmd = "ssh -i $SSHKeyPath"
    $scpCmd = "scp -i $SSHKeyPath"
}

Write-Host "[3/4] Uploading files to remote server ($ServerHost)..." -ForegroundColor Yellow

# Ensure remote directory exists
Invoke-Expression "$sshCmd ${ServerUser}@${ServerHost} 'mkdir -p $remotePluginDir'"

# SCP files
foreach ($file in $filesToTransfer) {
    Write-Host "      Uploading $file..." -ForegroundColor Gray
    Invoke-Expression "$scpCmd $file ${ServerUser}@${ServerHost}:${remotePluginDir}/"
}

# 5. Trigger Remote Registry Update
Write-Host "[4/4] Updating central registry.json..." -ForegroundColor Yellow
$updateScript = "$RemoteHubDir/update_registry.py"
Invoke-Expression "$sshCmd ${ServerUser}@${ServerHost} 'python3 $updateScript --hub-dir $RemoteHubDir'"

Write-Host ""
Write-Host "SUCCESS! $pluginName v$version has been published to Private Hub!" -ForegroundColor Green
Write-Host "Users can now see the Update/Install button in Obsidian." -ForegroundColor Green
