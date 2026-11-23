# Räknar upp versionsnumret och laddar upp appen till GitHub Pages.
# Starta med publicera.bat
Set-Location $PSScriptRoot
$file = Join-Path $PSScriptRoot "version.js"
$text = [System.IO.File]::ReadAllText($file)
if ($text -notmatch 'APP_VERSION\s*=\s*(\d+)') {
  Write-Host "Hittade inget versionsnummer i version.js" -ForegroundColor Red
  exit 1
}
$new = [int]$Matches[1] + 1
$text = $text -replace 'APP_VERSION\s*=\s*\d+', "APP_VERSION = $new"
[System.IO.File]::WriteAllText($file, $text, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Ny version: v$new" -ForegroundColor Green

git add -A
git commit -q -m "Version $new"
git push -q
if ($LASTEXITCODE -eq 0) {
  Write-Host "Klart! v$new är uppladdad. Den syns på enheterna om 1-2 minuter." -ForegroundColor Green
} else {
  Write-Host "Uppladdningen misslyckades - se felet ovan." -ForegroundColor Red
}
