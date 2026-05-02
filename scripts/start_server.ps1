$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$buildScript = Join-Path $root "scripts\build_data.py"
$buildDir = Join-Path $root "build"
$sources = @(
  (Join-Path $root "data\yacimientos_mineros.gpkg"),
  (Join-Path $root "data\yacimientos_mineros.qml"),
  (Join-Path $root "data\franja_metalogentica.gpkg"),
  (Join-Path $root "data\franja_metalogentica.qml")
)
$outputs = @(
  (Join-Path $buildDir "yacimientos_mineros.geojson"),
  (Join-Path $buildDir "franja_metalogentica.geojson"),
  (Join-Path $buildDir "styles.json"),
  (Join-Path $buildDir "metadata.json")
)

function Test-BuildIsCurrent {
  if (!(Test-Path $buildDir)) { return $false }
  foreach ($path in $outputs) {
    if (!(Test-Path $path)) { return $false }
  }

  $newestSource = ($sources | ForEach-Object { (Get-Item $_).LastWriteTimeUtc.Ticks } | Measure-Object -Maximum).Maximum
  $oldestOutput = ($outputs | ForEach-Object { (Get-Item $_).LastWriteTimeUtc.Ticks } | Measure-Object -Minimum).Minimum
  return $oldestOutput -ge $newestSource
}

function Update-BuildIfPossible {
  if (Test-BuildIsCurrent) { return }

  $python = $null
  try { $python = (Get-Command python -ErrorAction Stop).Source } catch {}
  if (-not $python) {
    try { $python = (Get-Command py -ErrorAction Stop).Source + " -3" } catch {}
  }

  if ($python) {
    Write-Host "Preparando datos del atlas..."
    if ($python -like "* -3") {
      & py -3 $buildScript --force
    } else {
      & python $buildScript --force
    }
    if ($LASTEXITCODE -ne 0) {
      throw "No se pudieron preparar los datos del atlas."
    }
    return
  }

  if (!(Test-Path $buildDir)) {
    throw "No existe la carpeta build y no se encontro Python para generarla."
  }

  Write-Warning "Los datos fuente cambiaron, pero no se encontro Python. Se abrira el atlas con el ultimo build disponible."
}

function Get-ContentType([string]$path) {
  switch ([IO.Path]::GetExtension($path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8"; break }
    ".css" { "text/css; charset=utf-8"; break }
    ".js" { "application/javascript; charset=utf-8"; break }
    ".json" { "application/json; charset=utf-8"; break }
    ".geojson" { "application/geo+json; charset=utf-8"; break }
    ".png" { "image/png"; break }
    ".svg" { "image/svg+xml"; break }
    default { "application/octet-stream"; break }
  }
}

function Get-FreePort {
  for ($port = 8765; $port -le 8815; $port++) {
    try {
      $client = New-Object System.Net.Sockets.TcpClient
      $iar = $client.BeginConnect("127.0.0.1", $port, $null, $null)
      $connected = $iar.AsyncWaitHandle.WaitOne(120)
      if ($connected -and $client.Connected) {
        $client.EndConnect($iar)
        $client.Close()
      } else {
        $client.Close()
        return $port
      }
    } catch {
      return $port
    }
  }
  throw "No se encontro un puerto libre entre 8765 y 8815."
}

Update-BuildIfPossible

$port = Get-FreePort
$prefix = "http://127.0.0.1:$port/"
$url = "${prefix}web/"

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host "Atlas listo."
Write-Host "URL: $url"
Write-Host "Cierra esta ventana para detener el servidor."

Start-Process $url | Out-Null

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $requestPath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($requestPath)) {
      $requestPath = "web/index.html"
    } elseif ($requestPath.EndsWith('/')) {
      $requestPath = $requestPath + "index.html"
    }

    $safePath = ($requestPath -replace '/', '\')
    $fullPath = [IO.Path]::GetFullPath((Join-Path $root $safePath))

    if (!$fullPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or !(Test-Path $fullPath -PathType Leaf)) {
      $context.Response.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes("404 - Archivo no encontrado")
      $context.Response.ContentType = "text/plain; charset=utf-8"
      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      $context.Response.Close()
      continue
    }

    $bytes = [IO.File]::ReadAllBytes($fullPath)
    $context.Response.StatusCode = 200
    $context.Response.ContentType = Get-ContentType $fullPath
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.AddHeader("Cache-Control", "no-store")
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.Close()
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
