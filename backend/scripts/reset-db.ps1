# Script para resetar completamente o banco de dados (APAGA TODOS OS DADOS!)
# Use apenas em desenvolvimento

Write-Host "ATENÇÃO: Este script vai APAGAR TODOS OS DADOS do banco de dados!" -ForegroundColor Red
$confirmation = Read-Host "Digite 'SIM' para continuar"

if ($confirmation -ne "SIM") {
    Write-Host "Operação cancelada." -ForegroundColor Yellow
    exit
}

Write-Host "Resetando banco de dados..." -ForegroundColor Yellow
docker compose exec -T api npx prisma migrate reset --force

if ($LASTEXITCODE -eq 0) {
    Write-Host "Banco de dados resetado com sucesso!" -ForegroundColor Green
    Write-Host "Gerando Prisma Client..." -ForegroundColor Yellow
    docker compose exec -T api npx prisma generate
    Write-Host "Populando banco de dados..." -ForegroundColor Yellow
    docker compose exec -T api npm run seed
    Write-Host "Pronto!" -ForegroundColor Green
} else {
    Write-Host "Erro ao resetar banco de dados." -ForegroundColor Red
}

