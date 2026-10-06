param(
    [string]$Arguments = ''
)

$ErrorActionPreference = 'Stop'
$nodeEnvPath = Join-Path $PSScriptRoot '..\backend\.env'

if (-not (Test-Path -LiteralPath $nodeEnvPath)) {
    throw "Node environment file was not found: $nodeEnvPath"
}

Get-Content -LiteralPath $nodeEnvPath | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2]
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}

# The legacy Node URI omits the database path; Mongoose therefore uses `test`.
# Spring Data requires the database to be explicit.
$env:SPRING_DATA_MONGODB_DATABASE = 'test'

# Spring uses an explicit switch; Node's REDIS_URL alone does not enable it.
if (-not $env:REDIS_ENABLED) { $env:REDIS_ENABLED = 'true' }
if (-not $env:NODE_ENV) { $env:NODE_ENV = 'development' }

$gradleArguments = @('bootRun', '--no-daemon')
if (-not [string]::IsNullOrWhiteSpace($Arguments)) {
    $gradleArguments += "--args=$Arguments"
}
& (Join-Path $PSScriptRoot 'gradlew.bat') @gradleArguments
exit $LASTEXITCODE
