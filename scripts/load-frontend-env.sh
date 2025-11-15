#!/bin/sh
# Script para carregar variáveis do arquivo .env do frontend
# Uso: source scripts/load-frontend-env.sh

if [ -f "frontend/.env" ]; then
    export $(grep -v '^#' frontend/.env | grep NEXT_PUBLIC_DEFAULT_COMPANY_LOGO | xargs)
fi

