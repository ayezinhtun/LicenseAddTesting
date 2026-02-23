@echo off
echo Starting daily licence expiry reminders...
cd /d "C:\License-Management-v3-main"

REM Trigger the daily expiry reminders via API call
curl -X POST "https://kioqpivshgtpacwklcho.supabase.co/functions/v1/send-email-notification" ^
  -H "Content-Type: application/json" ^
  -d "{\"to\":\"ayezinhtun9@gmail.com\",\"subject\":\"Daily Licence Reminder Check\",\"html\":\"<h1>Daily reminders triggered at %date% %time%</h1><p>Your licence management system is checking for expiring licences today.</p>\"}"

echo Daily reminders sent at %date% %time%
pause
