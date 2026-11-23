# Windows PowerShell 5.1 or newer. Run from any folder.
$ErrorActionPreference = 'Stop'
foreach ($command in 'uv', 'ffmpeg', 'ffprobe', 'node', 'npm.cmd', 'curl.exe') {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Missing $command. Follow the prerequisites in README.md, then reopen PowerShell."
    }
}
if ((node -p "process.versions.node.split('.')[0]") -ne '24') {
    throw 'Install Node.js 24.x as described in README.md, then reopen PowerShell.'
}
Push-Location (Join-Path $PSScriptRoot 'backend')
try {
    uv sync --locked --inexact --python 3.11
    if ($LASTEXITCODE) { throw 'Python dependency setup failed.' }
    $null = New-Item -ItemType Directory -Force -Path 'models','media/videos'
    $model = Join-Path (Get-Location) 'models/pose_landmarker_heavy.task'
    $hash = '64437AF838A65D18E5BA7A0D39B465540069BC8AAE8308DE3E318AAD31FCBC7B'
    if (!(Test-Path -LiteralPath $model) -or (Get-FileHash -LiteralPath $model).Hash -ne $hash) {
        $download = "$model.$([guid]::NewGuid()).tmp"
        try {
            curl.exe --fail --location --silent --show-error --retry 2 --connect-timeout 20 --max-time 180 --output $download 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task'
            if ($LASTEXITCODE) { throw 'Model download failed. Check your connection and rerun setup.' }
            if ((Get-FileHash -LiteralPath $download).Hash -ne $hash) { throw 'Model checksum mismatch. Rerun setup to download it again.' }
            Move-Item -Force -LiteralPath $download -Destination $model
        } finally {
            if (Test-Path -LiteralPath $download) { Remove-Item -LiteralPath $download }
        }
    }
    uv run --no-sync python manage.py migrate
    if ($LASTEXITCODE) { throw 'Database migration failed.' }
    Set-Location (Join-Path $PSScriptRoot 'frontend')
    npm.cmd ci
    if ($LASTEXITCODE) { throw 'Frontend dependency setup failed.' }
} finally {
    Pop-Location
}
Write-Host 'Setup complete. Follow Run a video or Open the web app in README.md.'
