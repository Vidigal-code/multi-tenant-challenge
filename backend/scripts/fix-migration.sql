-- Script SQL para remover a migração falhada do banco de dados
-- Execute: docker compose exec -T db psql -U postgres -d multitenant -f /path/to/fix-migration.sql
-- Ou copie e cole este SQL no psql

-- Remove o registro da migração falhada
DELETE FROM "_prisma_migrations" 
WHERE "migration_name" = '20251114000000_add_notification_preferences';

-- Verifica se foi removido
SELECT "migration_name", "finished_at", "rolled_back_at" 
FROM "_prisma_migrations" 
ORDER BY "started_at" DESC 
LIMIT 5;

