@echo off
title Sistema Ponto
cd /d "%~dp0"

echo Iniciando o servidor local...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado neste computador.
  echo Instale o Node.js e tente novamente.
  pause
  exit /b 1
)

start "Servidor Sistema Ponto" cmd /k "cd /d ""%~dp0"" && node index.js"

timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"

echo Sistema iniciado.
echo Se o navegador nao abrir automaticamente, acesse:
echo http://localhost:3000
echo.
pause
