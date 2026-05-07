$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$cloudRoot = Join-Path $repoRoot "cloudfunctions"
$sharedRoot = Join-Path $repoRoot "scripts/cloudfunction-shared-template"

if (-not (Test-Path $sharedRoot)) {
  throw "Shared directory not found: $sharedRoot"
}

$functionDirs = Get-ChildItem -Path $cloudRoot -Directory

$patchedFiles = 0
$syncedDirs = 0

foreach ($dir in $functionDirs) {
  $targetShared = Join-Path $dir.FullName "_shared"
  New-Item -ItemType Directory -Path $targetShared -Force | Out-Null

  Copy-Item -Path (Join-Path $sharedRoot "*") -Destination $targetShared -Recurse -Force
  $syncedDirs++

  $jsFiles = Get-ChildItem -Path $dir.FullName -Filter "*.js" -File -Recurse
  foreach ($file in $jsFiles) {
    $content = Get-Content -Path $file.FullName -Raw
    $updated = $content -replace "\.\./_shared/", "./_shared/"
    if ($updated -ne $content) {
      Set-Content -Path $file.FullName -Value $updated -Encoding UTF8
      $patchedFiles++
    }
  }
}

Write-Host "Synced _shared to $syncedDirs cloud functions."
Write-Host "Patched $patchedFiles JS files."
