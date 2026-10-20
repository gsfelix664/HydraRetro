# 🎮 HydraRetro — Diretrizes, Especificações e Contexto do Projeto

Este documento reúne todas as diretrizes técnicas, arquiteturais e operacionais do **HydraRetro** para garantir consistência e alinhamento em todas as sessões de desenvolvimento.

---

## 📌 1. Visão Geral do Projeto

O **HydraRetro** é um catálogo fullscreen leve, ágil e visualmente rico, projetado para consolidar consoles retrô (foco inicial: **PlayStation 1** e **Sega Mega Drive**) e ser iniciado a partir de um único atalho na biblioteca do **Hydra Launcher**.

### Principais Pilares:
- **Zero Configuração para o Usuário Final:** Os emuladores já vêm embutidos e configurados para tela cheia e controle de Xbox (XInput).
- **Plug-and-Play de ROMs e BIOS:** Basta ao usuário colocar suas ROMs em `ROMS\PS1` ou `ROMS\GENESIS` e a BIOS em `BIOS\` que o sistema detecta tudo automaticamente ao abrir (ou em tempo real via hot-plug).
- **Experiência Console:** Transição suave entre catálogo e jogo com minimização e restauração automática da interface.

---

## 📁 2. Estrutura de Diretórios e Ambientes

### Ambiente de Desenvolvimento (Repositório Git):
`C:\PROJETOS\HydraRetro\`

### Ambiente de Produção Local:
`C:\games\HydraRetro\`

### Estrutura Padrão:
```text
HydraRetro/
├── BIOS/                            # Pasta para BIOS (ex: SCPH1001.BIN) [Ignorada no Git, exceto .gitkeep]
│   └── .gitkeep
├── ROMS/                            # Pasta para ROMs dos consoles [Ignorada no Git, exceto .gitkeep]
│   ├── PS1/                         # .chd, .cue/.bin, .pbp, .iso
│   │   └── .gitkeep
│   └── GENESIS/                     # .zip, .md, .gen, .bin, .7z
│       └── .gitkeep
├── emulators/                       # Emuladores pré-configurados [Commitados no Git]
│   ├── duckstation/                 # DuckStation x64 Release
│   │   ├── duckstation-qt-x64-ReleaseLTCG.exe
│   │   ├── portable.txt             # Ativa modo portátil
│   │   ├── settings.ini             # Fullscreen + Mapeamento Xbox Controller + Caminho da BIOS
│   │   └── bios/
│   │       └── .gitkeep
│   └── retroarch/                   # RetroArch x64
│       ├── retroarch.exe
│       ├── retroarch.cfg            # Fullscreen + XInput Controller + Caminho da BIOS
│       ├── autoconfig/              # Perfis de controle
│       ├── cores/
│       │   └── genesis_plus_gx_libretro.dll  # Core Mega Drive
│       └── system/
│           └── .gitkeep
├── data/
│   ├── database.json                # Banco de dados local da biblioteca escaneada [Ignorado no Git]
│   └── ps1_hydra_metadata.json      # Metadados e IDs para capas do Hydra LaunchBox
├── src/
│   ├── server.js                    # Backend HTTP local (Node.js) escutando na porta 38475
│   ├── Launcher.cs                  # Executável de entrada (gerencia Node e Edge WebView)
│   ├── FocusHelper.cs               # Utilitário Win32 para troca de foco e minimização
│   └── ui/                          # Frontend SPA do catálogo
│       ├── index.html
│       ├── styles.css
│       └── app.js
├── build.bat                        # Script de compilação e deploy para C:\games\HydraRetro
├── .gitignore                       # Regras de exclusão do repositório
└── gemini.md                        # Este documento de referência
```

---

## 🕹️ 3. Emuladores e Configurações Padrão

### PlayStation 1 — DuckStation
- **Executável:** `emulators/duckstation/duckstation-qt-x64-ReleaseLTCG.exe`
- **Modo Portátil:** Arquivo `portable.txt` presente na raiz do DuckStation.
- **Linha de Comando:** `-batch -fullscreen -- "{ROM}"`
- **Diretório de BIOS:** Configurado em `settings.ini` como `../../BIOS` (com fallback no próprio DuckStation para BIOS HLE).
- **Controle de Xbox (Pad1):** Mapeamento via SDL-0 / XInput nativo (`settings.ini`):
  - Botão A = Cross (X)
  - Botão B = Circle (Círculo)
  - Botão X = Square (Quadrado)
  - Botão Y = Triangle (Triângulo)
  - LB / RB = L1 / R1
  - Gatilhos LT / RT = L2 / R2
  - D-Pad e Analógicos configurados
  - Teclado padrão mapeado como fallback.
- **Tratamento de Arquivos Multi-pista:** Se um jogo possuir `.cue` e `.bin` com o mesmo nome, o scanner executa e exibe apenas o `.cue`, evitando duplicações no catálogo.

### Sega Mega Drive — RetroArch (Core Genesis Plus GX)
- **Executável:** `emulators/retroarch/retroarch.exe`
- **Core:** `emulators/retroarch/cores/genesis_plus_gx_libretro.dll`
- **Linha de Comando:** `-f -L "{CORE}" "{ROM}"`
- **Configuração:** `retroarch.cfg`:
  - `video_fullscreen = "true"`
  - `input_joypad_driver = "xinput"`
  - `input_autodetect_enable = "true"`
  - Botões mapeados diretamente para controle Xbox via XInput e teclado como fallback.

---

## ⚙️ 4. Arquitetura de Software

1. **Launcher C# (`HydraRetro.exe`):**
   - Inicia o processo Node em segundo plano (`server.js`) caso a porta `38475` não esteja aberta.
   - Abre o Microsoft Edge em modo app/kiosk (`--app=http://127.0.0.1:38475 --start-fullscreen --user-data-dir="data\webview_profile"`).
   - Ao fechar a janela do HydraRetro, encerra o processo Node.js limpo.

2. **FocusHelper (`FocusHelper.exe`):**
   - Ao disparar o jogo: minimiza a janela fullscreen do catálogo para que o emulador assuma a tela sem sobreposição.
   - Ao encerrar o emulador: restaura e traz a janela do HydraRetro para o topo da área de trabalho automaticamente.

3. **Backend Node.js (`server.js`):**
   - Caminhos resolvidos dinamicamente relativos a `APP_ROOT` (funciona tanto em `C:\PROJETOS\HydraRetro` quanto em `C:\games\HydraRetro`).
   - Monitoramento automático de pastas com `fs.watch` (hot-plug de ROMs).
   - Metadados, capas, banners e logos obtidos automaticamente do Libretro CDN e fallback para LaunchBox/CoinOPS.
   - Rastreamento em tempo real de horas jogadas e conquistas locais (estilo Hydra/Steam).

---

## 🛡️ 5. Regras de Controle de Versão (Git)

- **Arquivos NUNCA commitados:**
  - Arquivos de ROMs (`ROMS/**/*` — `.zip`, `.cue`, `.bin`, `.chd`, `.iso`, etc.)
  - Arquivos de BIOS (`BIOS/**/*`, `emulators/**/bios/*`, `emulators/**/system/*`)
  - Banco de dados e perfis locais (`data/database.json`, `data/webview_profile/`)
  - Saves e savestates dos emuladores (`emulators/**/saves/`, `emulators/**/states/`, `emulators/**/memcards/`)
  - Arquivos de log (`*.log`)
- **Arquivos SEMPRE commitados:**
  - Binários dos emuladores (`DuckStation` e `RetroArch` + DLLs) — *nenhum arquivo excede o limite de 100 MB do GitHub*.
  - Configurações padrão (`settings.ini`, `retroarch.cfg`, `portable.txt`).
  - Marcadores de pasta `.gitkeep` em `ROMS/PS1/`, `ROMS/GENESIS/`, e `BIOS/`.
  - Código-fonte (`src/`), executáveis de launcher e scripts de build (`build.bat`).

---

## 🚀 6. Processo de Compilação e Deploy

Para gerar os executáveis e espelhar as alterações para a pasta de produção:

```cmd
C:\PROJETOS\HydraRetro\build.bat
```

O script:
1. Cria a árvore de diretórios em `C:\games\HydraRetro` se não existir.
2. Copia os arquivos de backend (`server.js`), frontend (`ui/`) e metadados (`data/`).
3. Espelha a pasta `emulators/` via robocopy.
4. Compila `FocusHelper.cs` e `Launcher.cs` usando o compilador C# do .NET Framework (`csc.exe`).
5. Entrega os executáveis prontos para uso em `C:\games\HydraRetro\HydraRetro.exe`.
