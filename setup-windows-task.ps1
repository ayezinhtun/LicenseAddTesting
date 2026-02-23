# Windows Task Scheduler Setup for Daily License Reminders
# Run this PowerShell script as Administrator to create daily scheduled task

Write-Host "Setting up daily license expiry reminders..." -ForegroundColor Green

$taskName = "Daily License Expiry Reminders"
$description = "Sends daily expiry notifications for license management system"
$scriptPath = "C:\License-Management-v3-main\run-daily-reminders.bat"
$dailyTime = "09:00"  # 9:00 AM daily

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "Task '$taskName' already exists. Removing it first..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Create the scheduled task
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -Daily -At $dailyTime
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description $description -RunLevel Highest

Write-Host "✅ Task '$taskName' created successfully!" -ForegroundColor Green
Write-Host "📅 Schedule: Daily at $dailyTime" -ForegroundColor Cyan
Write-Host "📂 Script: $scriptPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "To test immediately, run:" -ForegroundColor Yellow
Write-Host "$scriptPath" -ForegroundColor White
Write-Host ""
Write-Host "To modify schedule, open Task Scheduler and find '$taskName'" -ForegroundColor Yellow
