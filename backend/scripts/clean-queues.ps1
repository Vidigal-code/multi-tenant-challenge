# Script to clean RabbitMQ queues that have PRECONDITION_FAILED issues
# Use this if workers fail to start due to queue configuration conflicts

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RabbitMQ Queue Cleanup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if rabbitmqctl is available or if Docker is running
$rabbitmqctl = Get-Command rabbitmqctl -ErrorAction SilentlyContinue
$docker = Get-Command docker -ErrorAction SilentlyContinue

# Try to find RabbitMQ container name
$rabbitmqContainer = $null
if ($docker) {
    try {
        $containers = docker ps --format "{{.Names}}" | Where-Object { $_ -like "*rabbit*" }
        if ($containers) {
            $rabbitmqContainer = $containers[0]
            Write-Host "Found RabbitMQ container: $rabbitmqContainer" -ForegroundColor Green
        }
    } catch {
        # Docker might not be running or accessible
    }
}

if (-not $rabbitmqctl -and -not $rabbitmqContainer) {
    Write-Host "ERROR: rabbitmqctl not found in PATH and RabbitMQ container not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please use RabbitMQ Management UI instead:" -ForegroundColor Yellow
    Write-Host "1. Open http://localhost:15672 in your browser" -ForegroundColor Yellow
    Write-Host "2. Login with guest/guest" -ForegroundColor Yellow
    Write-Host "3. Go to Queues tab" -ForegroundColor Yellow
    Write-Host "4. Delete the following queues if they exist:" -ForegroundColor Yellow
    Write-Host "   - events" -ForegroundColor Yellow
    Write-Host "   - events.invites" -ForegroundColor Yellow
    Write-Host "   - events.members" -ForegroundColor Yellow
    Write-Host "   - notifications.realtimes" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "This script will delete the following queues:" -ForegroundColor Yellow
Write-Host "  - events" -ForegroundColor Yellow
Write-Host "  - events.invites" -ForegroundColor Yellow
Write-Host "  - events.members" -ForegroundColor Yellow
Write-Host "  - notifications.realtimes" -ForegroundColor Yellow
Write-Host ""

$confirmation = Read-Host "Are you sure you want to continue? (yes/no)"
if ($confirmation -ne "yes") {
    Write-Host "Operation cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Stopping all workers and clearing queues..." -ForegroundColor Cyan
Write-Host ""

$queues = @("events", "events.invites", "events.members", "notifications.realtimes")

foreach ($queue in $queues) {
    Write-Host "Deleting queue: $queue" -ForegroundColor Yellow
    try {
        if ($rabbitmqctl) {
            # Use rabbitmqctl directly
            $result = rabbitmqctl delete_queue $queue 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  [OK] Queue $queue deleted" -ForegroundColor Green
            } else {
                Write-Host "  [INFO] Queue $queue might not exist or is in use" -ForegroundColor Yellow
            }
        } elseif ($rabbitmqContainer) {
            # Use Docker exec to run rabbitmqctl
            $result = docker exec $rabbitmqContainer rabbitmqctl delete_queue $queue 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  [OK] Queue $queue deleted" -ForegroundColor Green
            } else {
                Write-Host "  [INFO] Queue $queue might not exist or is in use" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "  [INFO] Queue $queue might not exist or is in use" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Queue cleanup completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now start the workers again with:" -ForegroundColor Yellow
Write-Host ""

