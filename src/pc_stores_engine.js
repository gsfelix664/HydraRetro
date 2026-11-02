/**
 * HydraRetro — Unified PC Games (.EXE), Steam & Epic Games Engine
 * High-performance, zero-external-dependencies native subsystem
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync, execFileSync } = require('child_process');

/* ========================================================================= */
/* 1. HEURÍSTICA DE EXECUTÁVEIS DE PC (Transplantado de Hydra Launcher)      */
/* ========================================================================= */

const REDIST_DIRECTORIES = new Set([
  '_commonredist',
  'commonredist',
  'redist',
  'redists',
  '_redist',
  'directx',
  'dotnet',
  'dotnetfx',
  'vcredist',
  'prereq',
  'prerequisites',
  'support',
  'installers',
  'installer',
  'crashreporter',
  'openal',
  'physx',
  'steamworks shared'
]);

const REDIST_FILE_PATTERN =
  /^(vcredist|vc_redist|dotnetfx|dxsetup|dxwebsetup|directx|oalinst|xnafx|physx|ue[345]prereqsetup|ue3redist)/i;

const SHARED_INSTALLER_PATTERN =
  /^(uplayinstaller|pbsvc|pbsetup|setup_battleye|beservice|social-club-setup|easyanticheat|dauservicesetup|unins\d+|uninstall|setup)/i;

const SHARED_RUNTIME_FILES = new Set([
  'unitycrashhandler32.exe',
  'unitycrashhandler64.exe',
  'crashreportclient.exe',
  'crashpad_handler.exe',
  'unrealcefsubprocess.exe',
  'epicwebhelper.exe',
  'start_protected_game.exe',
  'unins000.exe',
  'unins001.exe',
  'uninstall.exe',
  'setup.exe',
  'dxsetup.exe',
  'vcredist_x64.exe',
  'vcredist_x86.exe',
  'vc_redist.x64.exe',
  'vc_redist.x86.exe',
  'easyanticheat_setup.exe',
  'beservice.exe',
  'javaw.exe',
  'java.exe',
  'dotnet.exe'
]);

/**
 * Verifica se um arquivo ou caminho é um executável de suporte, redistribuível ou instalador.
 * @param {string} filePath Caminho do arquivo a ser verificado.
 * @returns {boolean} True se deve ser ignorado.
 */
function isIgnoredExecutable(filePath) {
  if (!filePath || typeof filePath !== 'string') return true;
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  if (!normalized.endsWith('.exe')) return true;

  const segments = normalized.split('/').filter(Boolean);
  const filename = segments.pop() || '';

  if (SHARED_RUNTIME_FILES.has(filename)) return true;
  if (REDIST_FILE_PATTERN.test(filename)) return true;
  if (SHARED_INSTALLER_PATTERN.test(filename)) return true;
  if (/^unins\d*\.exe$/i.test(filename)) return true;

  for (const segment of segments) {
    if (REDIST_DIRECTORIES.has(segment)) return true;
  }

  return false;
}

/**
 * Limpa títulos de jogos de PC removendo tags de release, repacks, versões e extensões.
 * @param {string} rawName Nome cru do jogo, pasta ou arquivo.
 * @returns {string} Nome limpo do jogo.
 */
function cleanPcGameTitle(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';

  // Remove símbolos de marca registrada e extensões comuns
  let title = rawName.replace(/[®™©]/g, '').replace(/\.(exe|lnk|bat|iso|zip|rar|7z)$/i, '');

  // Remove grupos entre colchetes [FitGirl Repack], [DODI], etc.
  title = title.replace(/\[[^\]]*\]/g, ' ');

  // Remove grupos entre parênteses com tags de release ou versão
  title = title.replace(/\([^)]*(repack|fitgirl|dodi|gog|v\d|multi|build|version|edition|update|dlc)[^)]*\)/gi, ' ');

  // Remove números de versão como v1.0.4, v2023.1.2, _v1.0.2824_
  title = title.replace(/(?:^|[._\s-])v\d+(?:[._\d]+)*(?:[a-z](?![a-z]))?/gi, ' ');

  // Remove tags conhecidas de scene e repackers com prefixos ou sufixos
  const tagsPattern = /[-_]?(repack|fitgirl|dodi|gog|codex|elamigos|empress|crap|flt|skidrow|plaza|goldberg|steamless|cpy|razor1911|prophet|reloaded|tinyiso|tenoke|rune|kaos|steamrip)\b/gi;
  title = title.replace(tagsPattern, ' ');

  // Remove sufixos de binários e arquitetura (ex: -Win64-Shipping, Win64, x64, x86)
  title = title.replace(/[-_]?(win64|win32|x64|x86)?[-_]shipping\b/gi, ' ');
  title = title.replace(/\b(win64|win32|x64|x86)\b/gi, ' ');

  // Substitui pontos e underscores por espaços
  title = title.replace(/[._]/g, ' ');

  // Remove hífens isolados no final ou cercados de espaços
  title = title.replace(/\s*-\s*$/g, '');

  // Normaliza espaços duplicados e faz trim
  title = title.replace(/\s+/g, ' ').trim();

  return title || rawName.trim();
}

/**
 * Varre recursivamente até 3 níveis dentro de folderPath e identifica o executável principal (.EXE).
 * @param {string} folderPath Diretório do jogo.
 * @returns {string|null} Caminho completo do melhor executável encontrado ou null.
 */
function findBestExecutableInFolder(folderPath) {
  if (!folderPath || !fs.existsSync(folderPath)) return null;

  const candidates = [];
  const folderBasename = path.basename(folderPath).toLowerCase();
  const cleanFolder = cleanPcGameTitle(folderBasename).toLowerCase().replace(/[^a-z0-9]/g, '');

  function scanDir(currentDir, currentDepth) {
    if (currentDepth > 3) return;

    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (_) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        const dirLower = entry.name.toLowerCase();
        if (!REDIST_DIRECTORIES.has(dirLower) && !dirLower.startsWith('$')) {
          scanDir(fullPath, currentDepth + 1);
        }
      } else if (entry.isFile()) {
        if (entry.name.toLowerCase().endsWith('.exe') && !isIgnoredExecutable(fullPath)) {
          try {
            const stat = fs.statSync(fullPath);
            candidates.push({
              fullPath,
              depth: currentDepth,
              name: entry.name,
              sizeBytes: stat.size
            });
          } catch (_) {}
        }
      }
    }
  }

  scanDir(folderPath, 0);

  if (candidates.length === 0) return null;

  // Ranqueamento dos executáveis candidatos
  for (const c of candidates) {
    const parsed = path.parse(c.name);
    const nameNoExt = parsed.name.toLowerCase();
    const cleanCandidateName = cleanPcGameTitle(nameNoExt).toLowerCase().replace(/[^a-z0-9]/g, '');

    let score = 0;

    // 1. Match de nome com a pasta
    if (nameNoExt === folderBasename || cleanCandidateName === cleanFolder) {
      score += 20000;
    } else if (cleanFolder && cleanCandidateName && (cleanFolder.includes(cleanCandidateName) || cleanCandidateName.includes(cleanFolder))) {
      score += 8000;
    }

    // 2. Localização: raiz ou Binaries/Win64 (Unreal Engine)
    if (c.depth === 0) {
      score += 3000;
    }

    const normPath = c.fullPath.replace(/\\/g, '/').toLowerCase();
    if (normPath.includes('/binaries/win64/')) {
      score += 6000;
    } else if (normPath.includes('/binaries/win32/')) {
      score += 3000;
    }

    // 3. Marcadores de jogo de produção
    if (/shipping/i.test(nameNoExt)) score += 2500;
    if (/win64/i.test(nameNoExt)) score += 1500;

    // 4. Penalidade para stubs de launcher quando a pasta não for de launcher
    if (/launcher|loader|bootstrap/i.test(nameNoExt) && !cleanFolder.includes('launcher')) {
      score -= 2000;
    }

    // 5. Peso do tamanho do arquivo (binários reais são maiores)
    const sizeMB = c.sizeBytes / (1024 * 1024);
    score += Math.min(sizeMB * 25, 10000);

    // 6. Penalidade por profundidade excessiva
    score -= c.depth * 1000;

    c.score = score;
  }

  candidates.sort((a, b) => b.score - a.score || b.sizeBytes - a.sizeBytes || a.depth - b.depth);

  return candidates[0].fullPath;
}

/* ========================================================================= */
/* 2. SCRAPER AUTOMÁTICO DA STEAM STORE API (Grátis, Sem Chave)              */
/* ========================================================================= */

/**
 * Realiza requisição GET HTTPS e retorna o objeto JSON ou null.
 * @param {string} url URL completa.
 * @returns {Promise<any|null>}
 */
function httpGetJson(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'HydraRetro/1.0 (+https://github.com/hydraretro)',
        'Accept': 'application/json'
      },
      timeout: 8000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGetJson(res.headers.location).then(resolve);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (_) {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Busca um jogo na API da Steam Store pelo nome.
 * @param {string} title Título do jogo.
 * @returns {Promise<{ steamAppId: string, title: string, coverUrl: string, coverCandidates: string[], heroUrl: string, logoUrl: string }|null>}
 */
async function searchSteamStoreGame(title) {
  if (!title) return null;
  const clean = cleanPcGameTitle(title);
  const queryTerm = clean || title;

  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(queryTerm)}&l=brazilian&cc=BR`;
  const json = await httpGetJson(url);

  if (!json || !Array.isArray(json.items) || json.items.length === 0) {
    return null;
  }

  const item = json.items[0];
  const appId = String(item.id);

  return {
    steamAppId: appId,
    title: item.name,
    coverUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900_2x.jpg`,
    coverCandidates: [
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900_2x.jpg`,
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`,
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`
    ],
    heroUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_hero.jpg`,
    logoUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/logo.png`
  };
}

/**
 * Obtém os detalhes enriquecidos de um jogo da Steam Store (sinopse, desenvolvedor, distribuidor, ano, gêneros).
 * @param {string|number} appId ID do aplicativo Steam.
 * @returns {Promise<{ description: string, developer: string, publisher: string, releaseYear: number|null, genres: string[] }|null>}
 */
async function fetchSteamAppDetails(appId) {
  if (!appId) return null;
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&l=brazilian`;
  const json = await httpGetJson(url);

  if (!json || !json[String(appId)] || !json[String(appId)].success || !json[String(appId)].data) {
    return null;
  }

  const d = json[String(appId)].data;
  const yearMatch = d.release_date?.date ? String(d.release_date.date).match(/\b(19\d\d|20\d\d)\b/) : null;

  return {
    description: d.short_description ? d.short_description.replace(/<[^>]+>/g, '').trim() : '',
    developer: (Array.isArray(d.developers) && d.developers[0]) || '',
    publisher: (Array.isArray(d.publishers) && d.publishers[0]) || '',
    releaseYear: yearMatch ? parseInt(yearMatch[1], 10) : null,
    genres: Array.isArray(d.genres) ? d.genres.map(g => g.description) : []
  };
}

/* ========================================================================= */
/* 3. PARSER NATIVO VDF / ACF (Valve KeyValues)                              */
/* ========================================================================= */

function tokenizeVdf(content) {
  const tokens = [];
  let index = 0;

  while (index < content.length) {
    const char = content[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    if (char === '{' || char === '}') {
      tokens.push(char);
      index++;
      continue;
    }
    // Comentários //
    if (char === '/' && content[index + 1] === '/') {
      while (index < content.length && content[index] !== '\n' && content[index] !== '\r') {
        index++;
      }
      continue;
    }
    // Strings delimitadas por aspas
    if (char === '"') {
      index++;
      let val = '';
      let closed = false;
      while (index < content.length) {
        const c = content[index];
        index++;
        if (c === '"') {
          closed = true;
          break;
        }
        if (c === '\\' && index < content.length) {
          val += content[index];
          index++;
        } else {
          val += c;
        }
      }
      if (closed) tokens.push(val);
      continue;
    }
    // Tokens sem aspas
    let unquoted = '';
    while (index < content.length && !/\s/.test(content[index]) && content[index] !== '{' && content[index] !== '}') {
      unquoted += content[index];
      index++;
    }
    if (unquoted) tokens.push(unquoted);
  }

  return tokens;
}

function parseVdfTokens(tokens, start = 0, nested = false) {
  const result = {};
  let index = start;

  while (index < tokens.length) {
    if (tokens[index] === '}') {
      return nested ? { value: result, next: index + 1 } : null;
    }
    const key = tokens[index];
    if (key === '{') return null;
    index++;
    if (index >= tokens.length) return null;

    if (tokens[index] === '{') {
      const child = parseVdfTokens(tokens, index + 1, true);
      if (!child) return null;
      result[key] = child.value;
      index = child.next;
    } else {
      result[key] = tokens[index];
      index++;
    }
  }

  return nested ? null : { value: result, next: index };
}

/**
 * Converte texto VDF/ACF em objeto JavaScript.
 * @param {string} content Conteúdo VDF.
 * @returns {any|null}
 */
function parseVdf(content) {
  if (!content || typeof content !== 'string') return null;
  const tokens = tokenizeVdf(content);
  if (!tokens || tokens.length === 0) return null;
  const parsed = parseVdfTokens(tokens, 0, false);
  return parsed ? parsed.value : null;
}

/* ========================================================================= */
/* 4. INTEGRAÇÃO COMPLETA STEAM (Local VDF + Conta Online)                   */
/* ========================================================================= */

/**
 * Localiza o caminho de instalação da Steam no Windows.
 * @returns {string|null}
 */
function getSteamInstallPath() {
  const candidates = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    'D:\\Steam'
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  // Consulta ao registro do Windows (HKCU)
  try {
    const stdout = execSync('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const match = stdout.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    if (match && match[1]) {
      const regPath = match[1].trim().replace(/\//g, '\\');
      if (fs.existsSync(regPath)) return regPath;
    }
  } catch (_) {}

  // Consulta alternativa ao registro (HKLM WOW64)
  try {
    const stdout = execSync('reg query "HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam" /v InstallPath', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const match = stdout.match(/InstallPath\s+REG_SZ\s+(.+)/i);
    if (match && match[1]) {
      const regPath = match[1].trim().replace(/\//g, '\\');
      if (fs.existsSync(regPath)) return regPath;
    }
  } catch (_) {}

  return null;
}

/**
 * Detecta contas Steam registradas localmente a partir de loginusers.vdf.
 * @param {string} [steamPath] Caminho de instalação da Steam.
 * @returns {Array<{ steamId64: string, accountName: string, personaName: string, mostRecent: boolean }>}
 */
function detectSteamUsers(steamPath) {
  const rootPath = steamPath || getSteamInstallPath();
  if (!rootPath) return [];

  const loginUsersPath = path.join(rootPath, 'config', 'loginusers.vdf');
  if (!fs.existsSync(loginUsersPath)) return [];

  try {
    const content = fs.readFileSync(loginUsersPath, 'utf8');
    const parsed = parseVdf(content);
    if (!parsed) return [];

    const usersObj = parsed.users || parsed.Users || parsed;
    const result = [];

    for (const [steamId64, details] of Object.entries(usersObj)) {
      if (typeof details !== 'object' || !details) continue;
      const accountName = details.AccountName || details.accountname || '';
      const personaName = details.PersonaName || details.personaname || '';
      const mostRecent = details.MostRecent === '1' || details.mostrecent === '1';

      result.push({
        steamId64: String(steamId64),
        accountName,
        personaName,
        mostRecent
      });
    }

    result.sort((a, b) => (b.mostRecent ? 1 : 0) - (a.mostRecent ? 1 : 0));
    return result;
  } catch (_) {
    return [];
  }
}

/**
 * Escaneia bibliotecas Steam locais e retorna os jogos instalados com paths de .EXE e arte.
 * @param {string} [steamPath] Caminho de instalação da Steam.
 * @returns {Array<{ appId: string, title: string, installDir: string, exePath: string|null, sizeBytes: number, launchUrl: string, coverUrl: string, heroUrl: string, logoUrl: string }>}
 */
function scanSteamInstalledGames(steamPath) {
  const rootPath = steamPath || getSteamInstallPath();
  if (!rootPath) return [];

  const libraryPaths = new Set();
  libraryPaths.add(rootPath);

  const libFoldersFile = path.join(rootPath, 'steamapps', 'libraryfolders.vdf');
  if (fs.existsSync(libFoldersFile)) {
    try {
      const content = fs.readFileSync(libFoldersFile, 'utf8');
      const parsed = parseVdf(content);
      const folders = parsed?.libraryfolders || parsed?.LibraryFolders || parsed || {};
      for (const item of Object.values(folders)) {
        if (typeof item === 'object' && item && item.path) {
          const norm = path.normalize(item.path);
          if (fs.existsSync(norm)) libraryPaths.add(norm);
        }
      }
    } catch (_) {}
  }

  const games = [];
  const seenAppIds = new Set();

  for (const libPath of libraryPaths) {
    const steamappsDir = path.join(libPath, 'steamapps');
    if (!fs.existsSync(steamappsDir)) continue;

    let files;
    try {
      files = fs.readdirSync(steamappsDir);
    } catch (_) {
      continue;
    }

    for (const file of files) {
      if (!file.toLowerCase().startsWith('appmanifest_') || !file.toLowerCase().endsWith('.acf')) {
        continue;
      }

      try {
        const acfPath = path.join(steamappsDir, file);
        const content = fs.readFileSync(acfPath, 'utf8');
        const parsed = parseVdf(content);
        const app = parsed?.AppState || parsed?.appstate || parsed || {};

        const appId = String(app.appid || app.AppId || '');
        if (!appId || appId === '228980' || seenAppIds.has(appId)) continue; // 228980 = Steamworks Common Redistributables

        const title = app.name || app.Name || '';
        if (/proton|steam linux runtime/i.test(title)) continue;

        seenAppIds.add(appId);

        const installdir = app.installdir || app.InstallDir || '';
        const installDir = path.join(steamappsDir, 'common', installdir);
        const sizeBytes = Number(app.SizeOnDisk || app.sizeondisk || 0);

        let exePath = null;
        if (fs.existsSync(installDir)) {
          exePath = findBestExecutableInFolder(installDir);
        }

        games.push({
          appId,
          title,
          installDir,
          exePath,
          sizeBytes,
          launchUrl: `steam://rungameid/${appId}`,
          coverUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900_2x.jpg`,
          heroUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_hero.jpg`,
          logoUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/logo.png`
        });
      } catch (_) {}
    }
  }

  return games;
}

/**
 * Obtém os jogos associados a uma conta Steam via Steam Web API ou perfil público XML.
 * @param {string} steamId64 ID 64 bits da conta Steam.
 * @param {string} [steamWebApiKey] Chave da Steam Web API (opcional).
 * @returns {Promise<Array<{ appId: string, title: string, playTimeSeconds: number, coverUrl: string, heroUrl: string, logoUrl: string, launchUrl: string }>>}
 */
async function fetchSteamAccountOwnedGames(steamId64, steamWebApiKey) {
  if (!steamId64) return [];

  if (steamWebApiKey) {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${encodeURIComponent(steamWebApiKey)}&steamid=${encodeURIComponent(steamId64)}&include_appinfo=1&include_played_free_games=1&format=json`;
    const json = await httpGetJson(url);
    const rawGames = json?.response?.games;
    if (Array.isArray(rawGames)) {
      return rawGames.map((g) => {
        const appId = String(g.appid);
        return {
          appId,
          title: g.name || `Steam App ${appId}`,
          playTimeSeconds: (g.playtime_forever || 0) * 60,
          coverUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900_2x.jpg`,
          heroUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_hero.jpg`,
          logoUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/logo.png`,
          launchUrl: `steam://rungameid/${appId}`
        };
      });
    }
  }

  // Fallback: perfil público XML da comunidade Steam (grátis, sem necessidade de API Key)
  return new Promise((resolve) => {
    const url = `https://steamcommunity.com/profiles/${encodeURIComponent(steamId64)}/games?tab=all&xml=1`;
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 10000
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve([]);
      }
      let xml = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { xml += chunk; });
      res.on('end', () => {
        const games = [];
        const gameBlocks = xml.match(/<game>[\s\S]*?<\/game>/gi) || [];
        for (const block of gameBlocks) {
          const idMatch = block.match(/<appID>(\d+)<\/appID>/i);
          const nameMatch = block.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/i) || block.match(/<name>(.*?)<\/name>/i);
          const hoursMatch = block.match(/<hoursOnRecord>([\d.,]+)<\/hoursOnRecord>/i);

          if (idMatch && nameMatch) {
            const appId = idMatch[1];
            const title = nameMatch[1];
            const hours = hoursMatch ? parseFloat(hoursMatch[1].replace(',', '.')) : 0;

            games.push({
              appId,
              title,
              playTimeSeconds: Math.round(hours * 3600),
              coverUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900_2x.jpg`,
              heroUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_hero.jpg`,
              logoUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/logo.png`,
              launchUrl: `steam://rungameid/${appId}`
            });
          }
        }
        resolve(games);
      });
    }).on('error', () => resolve([])).on('timeout', function() {
      this.destroy();
      resolve([]);
    });
  });
}

/* ========================================================================= */
/* 5. INTEGRAÇÃO COMPLETA EPIC GAMES (Manifestos Locais + Legendary CLI)     */
/* ========================================================================= */

/**
 * Escaneia a pasta de manifestos do Epic Games Launcher (C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests).
 * @returns {Array<{ appName: string, title: string, installLocation: string, launchExecutable: string, exePath: string|null, installSize: number, catalogNamespace: string, catalogItemId: string, launchUrl: string }>}
 */
function scanEpicInstalledManifests() {
  const manifestDir = 'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests';
  if (!fs.existsSync(manifestDir)) return [];

  const games = [];
  let files;
  try {
    files = fs.readdirSync(manifestDir);
  } catch (_) {
    return [];
  }

  for (const file of files) {
    if (!file.toLowerCase().endsWith('.item')) continue;
    try {
      const itemPath = path.join(manifestDir, file);
      const raw = fs.readFileSync(itemPath, 'utf8');
      const item = JSON.parse(raw);

      if (item.bIsIncompleteInstall) continue;

      const appName = item.AppName || '';
      const title = item.DisplayName || appName;
      const installLocation = item.InstallLocation || '';
      const launchExecutable = item.LaunchExecutable || '';
      const installSize = Number(item.InstallSize || 0);
      const catalogNamespace = item.CatalogNamespace || '';
      const catalogItemId = item.CatalogItemId || '';

      let exePath = installLocation && launchExecutable ? path.join(installLocation, launchExecutable) : null;
      if (!exePath || !fs.existsSync(exePath)) {
        if (installLocation && fs.existsSync(installLocation)) {
          exePath = findBestExecutableInFolder(installLocation);
        }
      }

      games.push({
        appName,
        title,
        installLocation,
        launchExecutable,
        exePath,
        installSize,
        catalogNamespace,
        catalogItemId,
        launchUrl: `com.epicgames.launcher://apps/${appName}?action=launch&silent=true`
      });
    } catch (_) {}
  }

  return games;
}

/**
 * Resolve o caminho do executável do Legendary CLI.
 * @param {string} [appRoot] Raiz da aplicação HydraRetro.
 * @returns {string}
 */
function getLegendaryPath(appRoot) {
  const candidates = [
    path.join(appRoot || process.cwd(), 'emulators', 'legendary', 'legendary.exe'),
    'C:\\PROJETOS\\HydraLaucher\\legendary\\win32\\x64\\legendary.exe',
    path.join(process.cwd(), '..', 'HydraLaucher', 'legendary', 'win32', 'x64', 'legendary.exe'),
    path.join(appRoot || process.cwd(), 'legendary.exe')
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  return candidates[0];
}

/**
 * Retorna e garante a existência da pasta de configuração do Legendary/Epic.
 * @param {string} [dataDir] Pasta de dados da aplicação.
 * @returns {string}
 */
function getEpicConfigDir(dataDir) {
  const base = dataDir || path.join(process.cwd(), 'data');
  const configDir = path.join(base, 'epic_config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  return configDir;
}

/**
 * Retorna o status de conexão da conta Epic Games.
 * @param {string} [dataDir] Pasta de dados da aplicação.
 * @returns {{ loggedIn: boolean, displayName?: string, accountId?: string }}
 */
function getEpicAccountStatus(dataDir) {
  const configDir = getEpicConfigDir(dataDir);
  const userJsonPath = path.join(configDir, 'user.json');
  if (!fs.existsSync(userJsonPath)) {
    return { loggedIn: false };
  }

  try {
    const raw = fs.readFileSync(userJsonPath, 'utf8');
    const user = JSON.parse(raw);
    return {
      loggedIn: true,
      displayName: user.displayName || user.display_name || user.account_name || 'Epic User',
      accountId: user.account_id || user.accountId || ''
    };
  } catch (_) {
    return { loggedIn: false };
  }
}

/**
 * Autentica o Legendary com o código de login fornecido pelo usuário.
 * @param {string} appRoot Raiz do projeto.
 * @param {string} dataDir Pasta de dados do projeto.
 * @param {string} authCode Código de autorização copiado do navegador.
 * @returns {{ loggedIn: boolean, displayName?: string, accountId?: string }}
 */
function authenticateEpicWithCode(appRoot, dataDir, authCode) {
  const legendary = getLegendaryPath(appRoot);
  const configDir = getEpicConfigDir(dataDir);

  if (!fs.existsSync(legendary)) {
    throw new Error(`legendary.exe não encontrado em ${legendary}`);
  }

  const env = { ...process.env, LEGENDARY_CONFIG_PATH: configDir };
  execFileSync(legendary, ['auth', '--code', authCode.trim()], {
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  return getEpicAccountStatus(dataDir);
}

/**
 * Desconecta a conta Epic Games removendo as credenciais locais.
 * @param {string} [dataDir]
 * @returns {{ success: boolean, error?: string }}
 */
function logoutEpicAccount(dataDir) {
  const configDir = getEpicConfigDir(dataDir);
  const userJson = path.join(configDir, 'user.json');
  const tokenJson = path.join(configDir, 'token.json');

  try {
    if (fs.existsSync(userJson)) fs.unlinkSync(userJson);
    if (fs.existsSync(tokenJson)) fs.unlinkSync(tokenJson);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Sincroniza o catálogo completo da conta Epic Games via Legendary CLI.
 * @param {string} appRoot Raiz do projeto.
 * @param {string} dataDir Pasta de dados do projeto.
 * @returns {Array<{ appName: string, title: string, developer: string, description: string, coverUrl: string, heroUrl: string, logoUrl: string, releaseYear: number|null }>}
 */
function syncEpicLibraryWithLegendary(appRoot, dataDir) {
  const legendary = getLegendaryPath(appRoot);
  const configDir = getEpicConfigDir(dataDir);

  if (!fs.existsSync(legendary)) {
    return [];
  }

  const env = { ...process.env, LEGENDARY_CONFIG_PATH: configDir };
  let stdout;
  try {
    stdout = execFileSync(legendary, ['list', '--json'], {
      env,
      encoding: 'utf8',
      maxBuffer: 25 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (_) {
    return [];
  }

  let items;
  try {
    items = JSON.parse(stdout);
  } catch (_) {
    return [];
  }

  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const appName = item.app_name || '';
    const title = item.app_title || item.title || appName;
    const developer = item.metadata?.developer || 'Epic Games';
    const description = item.metadata?.description || '';

    const keyImages = Array.isArray(item.metadata?.keyImages) ? item.metadata.keyImages : [];

    // Capa: DieselGameBoxTall (vertical 600x800) -> Thumbnail -> DieselGameBox
    let coverUrl = '';
    const boxTall = keyImages.find(img => img.type === 'DieselGameBoxTall');
    const thumb = keyImages.find(img => img.type === 'Thumbnail');
    const box = keyImages.find(img => img.type === 'DieselGameBox');
    coverUrl = (boxTall && boxTall.url) || (thumb && thumb.url) || (box && box.url) || '';

    // Hero / Banner
    let heroUrl = '';
    const boxWide = keyImages.find(img => img.type === 'DieselGameBoxWide');
    heroUrl = (boxWide && boxWide.url) || (box && box.url) || '';

    // Logo
    let logoUrl = '';
    const boxLogo = keyImages.find(img => img.type === 'DieselGameBoxLogo');
    logoUrl = (boxLogo && boxLogo.url) || '';

    // Ano de lançamento
    const dateAdded = item.metadata?.releaseInfo?.[0]?.dateAdded;
    const yearMatch = dateAdded ? String(dateAdded).match(/\b(19\d\d|20\d\d)\b/) : null;
    const releaseYear = yearMatch ? parseInt(yearMatch[1], 10) : null;

    return {
      appName,
      title,
      developer,
      description,
      coverUrl,
      heroUrl,
      logoUrl,
      releaseYear
    };
  });
}

/* ========================================================================= */
/* 6. SELETORES NATIVOS DE ARQUIVO E PASTA DO WINDOWS                        */
/* ========================================================================= */

/**
 * Abre a caixa de diálogo nativa do Windows para seleção de executável (.EXE, .LNK, .BAT).
 * @returns {string|null} Caminho absoluto selecionado ou null se cancelado.
 */
function pickWindowsExeFile() {
  const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.OpenFileDialog
$f.Title = 'Selecionar Executavel do Jogo (.EXE)'
$f.Filter = 'Executaveis (*.exe;*.lnk;*.bat)|*.exe;*.lnk;*.bat|Todos os arquivos (*.*)|*.*'
if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::Out.Write($f.FileName)
}
`;
  try {
    const stdout = execFileSync('powershell.exe', ['-NoProfile', '-STA', '-Command', psScript], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const trimmed = stdout.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (_) {
    return null;
  }
}

/**
 * Abre a caixa de diálogo nativa do Windows para seleção de pasta contendo jogos de PC.
 * @returns {string|null} Caminho absoluto selecionado ou null se cancelado.
 */
function pickWindowsFolder() {
  const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = 'Selecione a pasta contendo seus Jogos de PC'
if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::Out.Write($f.SelectedPath)
}
`;
  try {
    const stdout = execFileSync('powershell.exe', ['-NoProfile', '-STA', '-Command', psScript], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const trimmed = stdout.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch (_) {
    return null;
  }
}

/* ========================================================================= */
/* EXPORTAÇÕES DO MÓDULO                                                     */
/* ========================================================================= */

module.exports = {
  // Heurística de Executáveis
  isIgnoredExecutable,
  findBestExecutableInFolder,
  cleanPcGameTitle,

  // Steam Store Scraper
  searchSteamStoreGame,
  fetchSteamAppDetails,

  // VDF Parser
  parseVdf,

  // Steam Local & Conta Online
  getSteamInstallPath,
  detectSteamUsers,
  scanSteamInstalledGames,
  fetchSteamAccountOwnedGames,

  // Epic Games & Legendary
  scanEpicInstalledManifests,
  getLegendaryPath,
  getEpicConfigDir,
  getEpicAccountStatus,
  authenticateEpicWithCode,
  logoutEpicAccount,
  syncEpicLibraryWithLegendary,

  // Seletores Nativos Windows
  pickWindowsExeFile,
  pickWindowsFolder
};
