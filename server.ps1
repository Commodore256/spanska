# Enkel lokal webbserver för att testa appen på Windows (inga installationer behövs).
# Starta med starta.bat. Stäng fönstret (eller Ctrl+C) för att stoppa.
$port = 8080
$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Appen körs på http://localhost:$port/  (stäng fönstret för att stoppa)"
Start-Process "http://localhost:$port/"

$types = @{
  ".html" = "text/html; charset=utf-8"; ".css" = "text/css; charset=utf-8";
  ".js" = "text/javascript; charset=utf-8"; ".json" = "application/manifest+json; charset=utf-8";
  ".png" = "image/png"; ".svg" = "image/svg+xml"; ".ico" = "image/x-icon"
}
$rootFull = [System.IO.Path]::GetFullPath($root)

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
  if ($path -eq "/") { $path = "/index.html" }
  $file = [System.IO.Path]::GetFullPath((Join-Path $root $path.TrimStart("/")))
  $resp = $ctx.Response
  if ($file.StartsWith($rootFull) -and (Test-Path $file -PathType Leaf)) {
    $ext = [System.IO.Path]::GetExtension($file).ToLower()
    $resp.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { "application/octet-stream" }
    $resp.Headers.Add("Cache-Control", "no-cache")
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $resp.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $resp.StatusCode = 404
  }
  $resp.Close()
}
