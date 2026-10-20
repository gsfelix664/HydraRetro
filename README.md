# 🎮 HydraRetro — Classic Console Hub

Catálogo Fullscreen leve e elegante de consoles retrô projetado para ser aberto a partir de um único atalho no **Hydra Launcher**.

## ✨ Funcionalidades

- **Catálogo em Tela Cheia:** UX fluida com abas por console (**PlayStation 1** e **Sega Mega Drive**), **Favoritos**, **Últimos Jogados**, filtro alfabético (`A-Z`) e busca instantânea.
- **Detecção Inteligente (`Hot-Plug` de ROMs):** Basta adicionar qualquer ROM em `ROMS\PS1` ou `ROMS\GENESIS` (e BIOS em `BIOS\`) dentro do HydraRetro — reconhecido automaticamente na abertura ou em tempo real (`fs.watch`).
- **Artes Online & Fallback Local (CoinOPS):** Busca capas em alta definição nas CDNs do Hydra LaunchBox e Libretro Thumbnails, com fallback automático para capas, logos e vídeos de gameplay locais do CoinOPS Next 2.
- **Emuladores Pré-Configurados Integrados:**
  - **PlayStation 1:** DuckStation (`-batch -fullscreen`) com suporte a múltiplos discos e mapeamento nativo para controle Xbox.
  - **Sega Mega Drive:** RetroArch + Core **Genesis Plus GX** (`-f -L`) com tela cheia e controle Xbox via XInput pré-configurado.
- **Sistema de Horas Jogadas & Conquistas Retrô:** Rastreamento em tempo real do tempo de jogo (a cada 5 segundos), histórico de sessões e conquistas desbloqueáveis por jogo + integração com RetroAchievements.

## 📁 Estrutura de Diretórios

- **Código-Fonte:** `C:\PROJETOS\HydraRetro`
- **Software em Produção:** `C:\games\HydraRetro`
  - `HydraRetro.exe` & `FocusHelper.exe`
  - `server.js` & `ui/`
  - `emulators/` (DuckStation + RetroArch pré-configurados para tela cheia e controle de Xbox)
  - `ROMS/PS1` e `ROMS/GENESIS` (Pastas para o usuário colocar as ROMs)
  - `BIOS/` (Pasta para o usuário colocar os arquivos de BIOS)
  - `data/` (Metadados e banco de dados local)

## 🛠️ Compilação e Deploy

Execute o script `build.bat` para compilar os executáveis e espelhar tudo em `C:\games\HydraRetro`:

```bat
build.bat
```
