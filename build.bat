@echo off
echo ===================================================
echo   Compilando e Publicando HydraRetro...
echo ===================================================

if not exist "C:\games\HydraRetro" mkdir "C:\games\HydraRetro"
if not exist "C:\games\HydraRetro\ui" mkdir "C:\games\HydraRetro\ui"
if not exist "C:\games\HydraRetro\data" mkdir "C:\games\HydraRetro\data"
if not exist "C:\games\HydraRetro\ROMS\PS1" mkdir "C:\games\HydraRetro\ROMS\PS1"
if not exist "C:\games\HydraRetro\ROMS\GENESIS" mkdir "C:\games\HydraRetro\ROMS\GENESIS"
if not exist "C:\games\HydraRetro\BIOS" mkdir "C:\games\HydraRetro\BIOS"
if not exist "C:\games\HydraRetro\emulators" mkdir "C:\games\HydraRetro\emulators"

copy /Y "C:\PROJETOS\HydraRetro\src\server.js" "C:\games\HydraRetro\server.js"
copy /Y "C:\PROJETOS\HydraRetro\src\ui\*" "C:\games\HydraRetro\ui\"
copy /Y "C:\PROJETOS\HydraRetro\data\ps1_hydra_metadata.json" "C:\games\HydraRetro\data\ps1_hydra_metadata.json"
copy /Y "C:\PROJETOS\HydraRetro\data\games_metadata.json" "C:\games\HydraRetro\data\games_metadata.json"

robocopy "C:\PROJETOS\HydraRetro\emulators" "C:\games\HydraRetro\emulators" /E /NFL /NDL /NJH /NJS /nc /ns /np

"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /out:"C:\games\HydraRetro\FocusHelper.exe" "C:\PROJETOS\HydraRetro\src\FocusHelper.cs"
copy /Y "C:\games\HydraRetro\FocusHelper.exe" "C:\PROJETOS\HydraRetro\FocusHelper.exe"

"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /out:"C:\games\HydraRetro\HydraRetro.exe" "C:\PROJETOS\HydraRetro\src\Launcher.cs"
copy /Y "C:\games\HydraRetro\HydraRetro.exe" "C:\PROJETOS\HydraRetro\HydraRetro.exe"

echo Concluido com sucesso! Executavel gerado em C:\games\HydraRetro\HydraRetro.exe
