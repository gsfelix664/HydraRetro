# 🎮 HydraRetro — Classic Console Hub

Catálogo Fullscreen leve e elegante de consoles retrô projetado para ser aberto a partir de um único atalho no **Hydra Launcher**.

## ✨ Funcionalidades

- **Catálogo em Tela Cheia:** UX fluida com abas por console (**PlayStation 1** e **Sega Mega Drive**), **Favoritos**, **Últimos Jogados**, filtro alfabético (`A-Z`) e busca instantânea.
- **Detecção Inteligente (`Hot-Plug` de ROMs):** Basta adicionar qualquer ROM em `D:\games\ROMS\PS1` ou `D:\games\ROMS\GENESIS` — o HydraRetro reconhece automaticamente na abertura ou em tempo real (`fs.watch`).
- **Artes Online & Fallback Local (CoinOPS):** Busca capas em alta definição nas CDNs do Hydra LaunchBox e Libretro Thumbnails, com fallback automático para capas, logos e vídeos de gameplay locais do CoinOPS Next 2.
- **Emuladores Pré-Configurados:**
  - **PlayStation 1:** DuckStation (`-batch -fullscreen`) com suporte a múltiplos discos (ex.: *Resident Evil 2*).
  - **Sega Mega Drive:** RetroArch + Core **Genesis Plus GX** (`-f -L`).
- **Sistema de Horas Jogadas & Conquistas Retrô:** Rastreamento em tempo real do tempo de jogo (a cada 5 segundos), histórico de sessões e conquistas desbloqueáveis por jogo + integração com RetroAchievements.

## 📁 Estrutura em Produção

- **Código-Fonte:** `C:\PROJETOS\HydraRetro`
- **Software em Produção:** `D:\games\HydraRetro` (`HydraRetro.exe`, `server.js`, `ui/`, `emulators/`, `data/`)
- **Pasta de ROMs:** `D:\games\ROMS\PS1` e `D:\games\ROMS\GENESIS`

## 🛠️ Compilação e Deploy

Execute o script `build.bat` para compilar o `HydraRetro.exe` e publicar os arquivos em `D:\games\HydraRetro`:

```bat
build.bat
```
