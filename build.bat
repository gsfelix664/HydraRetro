@echo off
setlocal
set TARGET_DIR=D:\games\HydraRetro
if not "%~1"=="" set TARGET_DIR=%~1

echo ===================================================
echo   Compilando e Publicando HydraRetro em %TARGET_DIR%...
echo ===================================================

if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
if not exist "%TARGET_DIR%\ui" mkdir "%TARGET_DIR%\ui"
if not exist "%TARGET_DIR%\data" mkdir "%TARGET_DIR%\data"
if not exist "%TARGET_DIR%\ROMS\PS1" mkdir "%TARGET_DIR%\ROMS\PS1"
if not exist "%TARGET_DIR%\ROMS\GENESIS" mkdir "%TARGET_DIR%\ROMS\GENESIS"
if not exist "%TARGET_DIR%\ROMS\SNES" mkdir "%TARGET_DIR%\ROMS\SNES"
if not exist "%TARGET_DIR%\ROMS\MAME" mkdir "%TARGET_DIR%\ROMS\MAME"
if not exist "%TARGET_DIR%\ROMS\PS2" mkdir "%TARGET_DIR%\ROMS\PS2"
if not exist "%TARGET_DIR%\ROMS\WII" mkdir "%TARGET_DIR%\ROMS\WII"
if not exist "%TARGET_DIR%\ROMS\GC" mkdir "%TARGET_DIR%\ROMS\GC"
if not exist "%TARGET_DIR%\ROMS\PSP" mkdir "%TARGET_DIR%\ROMS\PSP"
if not exist "%TARGET_DIR%\ROMS\PS3" mkdir "%TARGET_DIR%\ROMS\PS3"
if not exist "%TARGET_DIR%\ROMS\N64" mkdir "%TARGET_DIR%\ROMS\N64"
if not exist "%TARGET_DIR%\ROMS\GBA" mkdir "%TARGET_DIR%\ROMS\GBA"
if not exist "%TARGET_DIR%\ROMS\GBC" mkdir "%TARGET_DIR%\ROMS\GBC"
if not exist "%TARGET_DIR%\ROMS\GB" mkdir "%TARGET_DIR%\ROMS\GB"
if not exist "%TARGET_DIR%\BIOS" mkdir "%TARGET_DIR%\BIOS"
if not exist "%TARGET_DIR%\emulators" mkdir "%TARGET_DIR%\emulators"

copy /Y "C:\PROJETOS\HydraRetro\src\server.js" "%TARGET_DIR%\server.js"
copy /Y "C:\PROJETOS\HydraRetro\src\ui\*" "%TARGET_DIR%\ui\"
copy /Y "C:\PROJETOS\HydraRetro\data\ps1_hydra_metadata.json" "%TARGET_DIR%\data\ps1_hydra_metadata.json"
copy /Y "C:\PROJETOS\HydraRetro\data\games_metadata.json" "%TARGET_DIR%\data\games_metadata.json"


robocopy "C:\PROJETOS\HydraRetro\emulators" "%TARGET_DIR%\emulators" /E /NFL /NDL /NJH /NJS /nc /ns /np

"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /out:"%TARGET_DIR%\FocusHelper.exe" "C:\PROJETOS\HydraRetro\src\FocusHelper.cs"
copy /Y "%TARGET_DIR%\FocusHelper.exe" "C:\PROJETOS\HydraRetro\FocusHelper.exe"

"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /out:"%TARGET_DIR%\HydraRetro.exe" "C:\PROJETOS\HydraRetro\src\Launcher.cs"
copy /Y "%TARGET_DIR%\HydraRetro.exe" "C:\PROJETOS\HydraRetro\HydraRetro.exe"

echo Concluido com sucesso! Executavel gerado em %TARGET_DIR%\HydraRetro.exe
