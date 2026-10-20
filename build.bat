@echo off
echo ===================================================
echo   Compilando e Publicando HydraRetro...
echo ===================================================

if not exist "D:\games\HydraRetro" mkdir "D:\games\HydraRetro"
if not exist "D:\games\HydraRetro\ui" mkdir "D:\games\HydraRetro\ui"
if not exist "D:\games\HydraRetro\data" mkdir "D:\games\HydraRetro\data"

copy /Y "C:\PROJETOS\HydraRetro\src\server.js" "D:\games\HydraRetro\server.js"
copy /Y "C:\PROJETOS\HydraRetro\src\ui\*" "D:\games\HydraRetro\ui\"

"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /target:winexe /out:"D:\games\HydraRetro\HydraRetro.exe" "C:\PROJETOS\HydraRetro\src\Launcher.cs"
copy /Y "D:\games\HydraRetro\HydraRetro.exe" "C:\PROJETOS\HydraRetro\HydraRetro.exe"

echo Concluido com sucesso! Executavel gerado em D:\games\HydraRetro\HydraRetro.exe
