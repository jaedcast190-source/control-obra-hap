@echo off
REM Doble clic aqui para arrancar la plataforma en Windows
cd /d "%~dp0"
echo Iniciando Plataforma de Control de Obra HAP...
echo.
py app.py
if errorlevel 1 (
  echo.
  echo Intentando con "python"...
  python app.py
)
pause
