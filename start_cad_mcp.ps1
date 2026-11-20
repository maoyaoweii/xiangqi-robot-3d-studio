$ErrorActionPreference = "Stop"
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = Join-Path $scriptRoot "cad_mcp_server.py"
Write-Host "启动本地 CAD MCP 桥接: http://127.0.0.1:8786/mcp" -ForegroundColor Cyan
python $server
