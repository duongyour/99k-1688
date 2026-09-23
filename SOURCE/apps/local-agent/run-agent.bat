@echo off
title 1688 Local Windows Browser Agent
echo ========================================================
echo Starting 1688 Local Browser Agent for Windows...
echo Binding to loopback: 127.0.0.1:16881
echo ========================================================
set CLOUD_APP_URL=http://localhost:3000
set PAIRING_TOKEN=dev-pairing-token-1688
npx tsx agent.ts
pause
