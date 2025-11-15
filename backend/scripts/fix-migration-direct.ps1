# Script PowerShell para resolver migração falhada diretamente no banco
# Este script remove o registro da migração falhada da tabela _prisma_migrations

Write-Host "Removendo migração falhada do banco de dados..." -ForegroundColor Yellow

$sql = "DELETE FROM `"_prisma_migrations`" WHERE `"migration_name`" = '20251114000000_add_notification_preferences';"

docker compose exec -T db psql -U postgres -d multitenant -c $sql

if ($LASTEXITCODE -eq 0) {
    Write-Host "Migração falhada removida com sucesso!" -ForegroundColor Green
    Write-Host "Aplicando migrações restantes..." -ForegroundColor Yellow
    docker compose exec -T api npx prisma migrate deploy
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Migrações aplicadas com sucesso!" -ForegroundColor Green
        Write-Host "Gerando Prisma Client..." -ForegroundColor Yellow
        docker compose exec -T api npx prisma generate
        Write-Host "Pronto! Execute 'docker compose exec api npm run seed' para popular o banco." -ForegroundColor Green
    } else {
        Write-Host "Erro ao aplicar migrações." -ForegroundColor Red
    }
} else {
    Write-Host "Erro ao remover migração falhada." -ForegroundColor Red
    Write-Host "Tente resetar o banco de dados:" -ForegroundColor Yellow
    Write-Host "docker compose exec api npx prisma migrate reset --force" -ForegroundColor Yellow
}

