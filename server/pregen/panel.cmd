@echo off
rem Starts the distant-land pre-build panel (panel.mjs) and opens it in the browser. Keep this window open while
rem the pre-build runs: it is what pauses it when someone joins. Closing it leaves the pre-build as it is.
title Distant land pre-build panel
cd /d "%~dp0"
node panel.mjs --open %*
echo.
echo The panel has stopped.
pause
