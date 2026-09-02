#!/bin/bash
# Doble clic o ejecuta ./iniciar_mac_linux.sh para arrancar en Mac/Linux
cd "$(dirname "$0")"
echo "Iniciando Plataforma de Control de Obra HAP..."
python3 app.py
