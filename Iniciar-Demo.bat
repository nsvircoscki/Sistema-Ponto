@echo off
title Sistema Ponto - DEMO
cd /d "%~dp0"

rem Demonstracao: banco separado (demo\demo.db), recriado do zero a cada inicio
rem a partir de demo\base.db (so os funcionarios de teste cadastrados).
rem O banco real (sis-ponto.db) nao e usado.

if not exist "demo\base.db" (
  echo Arquivo demo\base.db nao encontrado.
  pause
  exit /b 1
)

copy /Y "demo\base.db" "demo\demo.db" >nul

set SIS_PONTO_DB=%~dp0demo\demo.db
set FONTE_PONTOS=arquivo
set PORT=3001
set OPERADOR_FOLHA=demo

echo Iniciando a DEMO em http://localhost:3001 ...
echo CSV para importar: %~dp0demo\pontos-2026-09.csv
echo.

start "Servidor Sistema Ponto - DEMO" cmd /k "cd /d ""%~dp0"" && node index.js"

timeout /t 2 /nobreak >nul
start "" "http://localhost:3001"
