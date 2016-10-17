@echo off

if not exist index.js (
  echo "usage: run.bat (from the steward/steward directory)" 1>&2
  exit /b 1
)

echo info: running on
systeminfo | findstr /B /C:"OS Name" /C:"OS Version"
echo.
echo info: using node
node --version

node index.js