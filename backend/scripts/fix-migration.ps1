# Script para resolver migração falhada no Prisma
# Execute: docker compose exec api npx prisma migrate resolve --rolled-back 20251114000000_add_notification_preferences

Write-Host "Resolvendo migração falhada..." -ForegroundColor Yellow

# Resolver a migração falhada
docker compose exec -T api npx prisma migrate resolve --rolled-back 20251114000000_add_notification_preferences

if ($LASTEXITCODE -eq 0) {
    Write-Host "Migração resolvida com sucesso!" -ForegroundColor Green
    Write-Host "Aplicando migrações restantes..." -ForegroundColor Yellow
    docker compose exec -T api npx prisma migrate deploy
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Migrações aplicadas com sucesso!" -ForegroundColor Green
        Write-Host "Gerando Prisma Client..." -ForegroundColor Yellow
        docker compose exec -T api npx prisma generate
        Write-Host "Pronto! Execute 'docker compose exec api npm run seed' para popular o banco." -ForegroundColor Green
    } else {
        Write-Host "Erro ao aplicar migrações. Tente resetar o banco de dados:" -ForegroundColor Red
        Write-Host "docker compose exec api npx prisma migrate reset" -ForegroundColor Yellow
    }
} else {
    Write-Host "Erro ao resolver migração. Tentando resetar o banco de dados..." -ForegroundColor Red
    Write-Host "Execute manualmente:" -ForegroundColor Yellow
    Write-Host "docker compose exec api npx prisma migrate reset" -ForegroundColor Yellow
}

