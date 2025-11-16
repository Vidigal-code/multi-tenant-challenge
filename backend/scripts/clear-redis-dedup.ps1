# Script to clear Redis deduplication keys
# Use this when messages are being incorrectly marked as duplicates

Write-Host "Clearing Redis deduplication keys..." -ForegroundColor Yellow

$dockerRedis = docker ps --filter "name=redis" --format "{{.Names}}" | Select-Object -First 1

if ($dockerRedis) {
    Write-Host "Found Redis container: $dockerRedis" -ForegroundColor Green
    
    # Get all dedup keys
    $keys = docker exec $dockerRedis redis-cli KEYS "evt:*"
    
    if ($keys -and $keys.Count -gt 0) {
        Write-Host "Found $($keys.Count) deduplication keys to clear" -ForegroundColor Yellow
        
        # Delete keys one by one (more reliable than xargs on Windows)
        foreach ($key in $keys) {
            if ($key) {
                docker exec $dockerRedis redis-cli DEL $key | Out-Null
            }
        }
        
        Write-Host "Cleared $($keys.Count) deduplication keys" -ForegroundColor Green
    } else {
        Write-Host "No deduplication keys found" -ForegroundColor Yellow
    }
    
    # Also clear msg:* keys (message-based dedup)
    $msgKeys = docker exec $dockerRedis redis-cli KEYS "msg:*"
    
    if ($msgKeys -and $msgKeys.Count -gt 0) {
        Write-Host "Found $($msgKeys.Count) message deduplication keys to clear" -ForegroundColor Yellow
        
        foreach ($key in $msgKeys) {
            if ($key) {
                docker exec $dockerRedis redis-cli DEL $key | Out-Null
            }
        }
        
        Write-Host "Cleared $($msgKeys.Count) message deduplication keys" -ForegroundColor Green
    }
    
} else {
    Write-Host "Redis container not found. Please check if Redis is running." -ForegroundColor Red
    Write-Host "If Redis is running locally, use: redis-cli KEYS 'evt:*' | xargs redis-cli DEL" -ForegroundColor Yellow
    exit 1
}

Write-Host "Done!" -ForegroundColor Green

