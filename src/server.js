
const ARCADE_TITLES = {
  mslug: 'Metal Slug',
  mslug2: 'Metal Slug 2',
  mslugx: 'Metal Slug X',
  mslug3: 'Metal Slug 3',
  mslug4: 'Metal Slug 4',
  mslug5: 'Metal Slug 5',
  kof94: "The King of Fighters '94",
  kof95: "The King of Fighters '95",
  kof96: "The King of Fighters '96",
  kof97: "The King of Fighters '97",
  kof98: "The King of Fighters '98",
  kof99: "The King of Fighters '99",
  kof2000: "The King of Fighters 2000",
  kof2001: "The King of Fighters 2001",
  kof2002: "The King of Fighters 2002",
  sf2: 'Street Fighter II: The World Warrior',
  sf2ce: 'Street Fighter II: Champion Edition',
  sf2hf: 'Street Fighter II: Hyper Fighting',
  ssf2: 'Super Street Fighter II',
  ssf2t: 'Super Street Fighter II Turbo',
  sfa: 'Street Fighter Alpha',
  sfa2: 'Street Fighter Alpha 2',
  sfa3: 'Street Fighter Alpha 3',
  sfiii: 'Street Fighter III: New Generation',
  sfiii2: 'Street Fighter III: 2nd Impact',
  sfiii3: 'Street Fighter III: 3rd Strike',
  cadillacs: 'Cadillacs and Dinosaurs',
  dino: 'Cadillacs and Dinosaurs',
  punisher: 'The Punisher',
  captcomm: 'Captain Commando',
  ffight: 'Final Fight',
  ffightae: 'Final Fight 30th Anniversary',
  tmnt: 'Teenage Mutant Ninja Turtles',
  tmnt2: 'Teenage Mutant Ninja Turtles: Turtles in Time',
  simpsons: 'The Simpsons',
  xmen: 'X-Men',
  avsp: 'Alien vs. Predator',
  pacman: 'Pac-Man',
  mspacman: 'Ms. Pac-Man',
  galaxian: 'Galaxian',
  galaga: 'Galaga',
  donkeykong: 'Donkey Kong',
  dkong: 'Donkey Kong',
  mario: 'Mario Bros.',
  garou: 'Garou: Mark of the Wolves',
  samsho: 'Samurai Shodown',
  samsho2: 'Samurai Shodown II',
  samsho3: 'Samurai Shodown III',
  samsho4: 'Samurai Shodown IV',
  samsho5: 'Samurai Shodown V',
  fatfursp: 'Fatal Fury Special',
  rbffspec: 'Real Bout Fatal Fury Special',
  wakuwak7: 'Waku Waku 7',
  neobombe: 'Neo Bomberman',
  shocktro: 'Shock Troopers',
  shocktr2: 'Shock Troopers: 2nd Squad',
  blazstar: 'Blazing Star',
  pulstar: 'Pulstar',
  aerofgt: 'Aero Fighters',
  sonicwi: 'Aero Fighters',
  sonicwi2: 'Aero Fighters 2',
  sonicwi3: 'Aero Fighters 3',
  mvsc: 'Marvel vs. Capcom: Clash of Super Heroes',
  mshvsf: 'Marvel Super Heroes vs. Street Fighter',
  xmvsf: 'X-Men vs. Street Fighter',
  msh: 'Marvel Super Heroes',
  '1941': '1941: Counter Attack',
  '1942': '1942',
  '1943': '1943: The Battle of Midway',
  '1944': '1944: The Loop Master',
  '19xx': '19XX: The War Against Destiny'
};
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const pcEngine = require('./pc_stores_engine');
const achEngine = require('./achievements_engine');
const { HydraDownloadsEngine } = require('./hydra_downloads_engine');

const APP_ROOT = path.basename(__dirname).toLowerCase() === 'src'
  ? path.resolve(__dirname, '..')
  : __dirname;

const DATA_DIR = path.join(APP_ROOT, 'data');
const MEDIA_DIR = path.join(APP_ROOT, 'media');
const COVERS_DIR = path.join(MEDIA_DIR, 'covers');
const THUMBS_DIR = path.join(MEDIA_DIR, 'thumbs');
const UI_DIR = fs.existsSync(path.join(APP_ROOT, 'ui'))
  ? path.join(APP_ROOT, 'ui')
  : path.join(__dirname, 'ui');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const PS1_META_FILE = path.join(DATA_DIR, 'ps1_hydra_metadata.json');
const GAMES_META_FILE = path.join(DATA_DIR, 'games_metadata.json');
const RETRO_RATINGS_FILE = path.join(DATA_DIR, 'retro_ratings.json');
const USER_PROFILE_FILE = path.join(DATA_DIR, 'user_profile.json');

const HYDRA_API_URL = 'https://hydra-api-us-east-1.losbroxas.org';
const HYDRA_AUTH_URL = 'https://auth.hydra.losbroxas.org';
const HYDRA_USER_AGENT = 'Hydra Launcher v4.1.6';

const DEFAULT_USER_PROFILE = {
  id: null,
  username: null,
  displayName: null,
  email: null,
  bio: '',
  profileImageUrl: null,
  backgroundImageUrl: null,
  subscription: null,
  subscriptionDetails: null,
  karma: 0,
  hydraAuthToken: null,
  hydraRefreshToken: null,
  tokenExpirationTimestamp: 0,
  workwondersJwt: null,
  isLoggedInHydra: false,
  createdAt: null
};

function loadUserProfile() {
  try {
    if (fs.existsSync(USER_PROFILE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(USER_PROFILE_FILE, 'utf8'));
      if (!saved.isLoggedInHydra) {
        return Object.assign({}, DEFAULT_USER_PROFILE);
      }
      return Object.assign({}, DEFAULT_USER_PROFILE, saved);
    }
  } catch (e) {
    console.warn('[Profile] Erro ao ler user_profile.json:', e.message);
  }
  return Object.assign({}, DEFAULT_USER_PROFILE);
}

function saveUserProfile(profile) {
  try {
    fs.writeFileSync(USER_PROFILE_FILE, JSON.stringify(profile, null, 2), 'utf8');
  } catch (e) {
    console.error('[Profile] Erro ao salvar user_profile.json:', e.message);
  }
}

async function refreshHydraToken(profile) {
  if (!profile || !profile.hydraRefreshToken) return null;
  try {
    const res = await fetch(`${HYDRA_API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': HYDRA_USER_AGENT,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ refreshToken: profile.hydraRefreshToken })
    });
    if (res.ok) {
      const data = await res.json();
      const expiresIn = data.expiresIn || 3600;
      profile.hydraAuthToken = data.accessToken;
      profile.tokenExpirationTimestamp = Date.now() + (expiresIn * 1000) - (5 * 60 * 1000);
      saveUserProfile(profile);
      return data.accessToken;
    }
  } catch (err) {
    console.warn('[HydraRetro] Erro ao renovar token Hydra:', err.message);
  }
  return null;
}

async function getValidHydraToken(profile) {
  if (!profile || !profile.isLoggedInHydra || !profile.hydraAuthToken) return null;
  if (profile.tokenExpirationTimestamp && Date.now() >= profile.tokenExpirationTimestamp) {
    const refreshed = await refreshHydraToken(profile);
    if (refreshed) return refreshed;
  }
  return profile.hydraAuthToken;
}

async function fetchHydraUserData(token) {
  const res = await fetch(`${HYDRA_API_URL}/profile/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': HYDRA_USER_AGENT,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) {
    throw new Error(`Hydra API retornou status ${res.status}`);
  }
  return await res.json();
}

async function patchHydraProfile(token, patchData) {
  const res = await fetch(`${HYDRA_API_URL}/profile`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': HYDRA_USER_AGENT,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(patchData)
  });
  if (!res.ok) {
    throw new Error(`Hydra API /profile retornou status ${res.status}`);
  }
  return await res.json();
}

async function logoutHydraAccount(token) {
  try {
    await fetch(`${HYDRA_API_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token || ''}`,
        'User-Agent': HYDRA_USER_AGENT
      }
    });
  } catch (err) {
    console.warn('[HydraRetro] Aviso ao deslogar da API Hydra:', err.message);
  }
}
const ROMS_DIR = path.join(APP_ROOT, 'ROMS');
const BIOS_DIR = path.join(APP_ROOT, 'BIOS');
const BACKUPS_DIR = path.join(APP_ROOT, 'backups', 'saves');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BIOS_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });
fs.mkdirSync(COVERS_DIR, { recursive: true });
fs.mkdirSync(THUMBS_DIR, { recursive: true });
fs.mkdirSync(BACKUPS_DIR, { recursive: true });

const CONSOLE_LIST = ['SNES', 'GENESIS', 'PS1', 'PS2', 'MAME', 'N64', 'GBA', 'GBC', 'GB', 'PSP', 'WII', 'GC', 'PS3', 'SWITCH', 'PC'];
for (const cid of CONSOLE_LIST) {
  fs.mkdirSync(path.join(ROMS_DIR, cid), { recursive: true });
  fs.mkdirSync(path.join(COVERS_DIR, cid.toLowerCase()), { recursive: true });
  fs.mkdirSync(path.join(THUMBS_DIR, cid.toLowerCase()), { recursive: true });
}
for (const extraStore of ['steam', 'epic']) {
  fs.mkdirSync(path.join(COVERS_DIR, extraStore), { recursive: true });
  fs.mkdirSync(path.join(THUMBS_DIR, extraStore), { recursive: true });
}

const DEFAULT_CONFIG = {
  romsRoot: ROMS_DIR,
  biosRoot: BIOS_DIR,
  raUsername: '',
  raWebApiKey: '',
  raToken: '',
  raHardcore: false,
  steamGridDbApiKey: '',
  ssUsername: '',
  ssPassword: '',
  ssDevId: '',
  ssDevPassword: '',
  ssSoftName: 'HydraRetro',
  theGamesDbApiKey: '',
  steamWebApiKey: '',
  steamId64: '',
  includeUninstalledSteam: true,
  includeUninstalledEpic: true,
  pcGameFolders: [],
  removedGames: [],
  language: 'pt-BR',
  launchOnStartup: false,
  launchMinimized: false,
  minimizeToTray: true,
  downloadSettings: {
    downloadPath: path.join(APP_ROOT, 'Downloads'),
    maxDownloadSpeedKBps: 0,
    seedAfterDownload: true,
    extractByDefault: true,
    deleteAfterExtract: false,
    createDesktopShortcut: false
  },
  consoles: {
    PS1: {
      id: 'PS1',
      name: 'PlayStation 1',
      shortName: 'PS1',
      manufacturer: 'Sony',
      releaseYear: 1994,
      romFolder: path.join(ROMS_DIR, 'PS1'),
      emulatorPath: path.join(APP_ROOT, 'emulators', 'duckstation', 'duckstation-qt-x64-ReleaseLTCG.exe'),
      corePath: '',
      launchArgs: '-batch -fullscreen -- "{ROM}"',
      extensions: ['.chd', '.pbp', '.iso', '.bin', '.cue', '.img', '.mdf'],
      libretroThumbRepo: 'Sony - PlayStation'
    },
    GENESIS: {
      id: 'GENESIS',
      name: 'Sega Mega Drive',
      shortName: 'Mega Drive',
      manufacturer: 'Sega',
      releaseYear: 1988,
      romFolder: path.join(ROMS_DIR, 'GENESIS'),
      emulatorPath: path.join(APP_ROOT, 'emulators', 'retroarch', 'retroarch.exe'),
      corePath: path.join(APP_ROOT, 'emulators', 'retroarch', 'cores', 'genesis_plus_gx_libretro.dll'),
      launchArgs: '-f -L "{CORE}" "{ROM}"',
      extensions: ['.zip', '.md', '.gen', '.smd', '.bin', '.7z'],
      libretroThumbRepo: 'Sega - Mega Drive - Genesis'
    },
    SNES: {
      id: 'SNES',
      name: 'Super Nintendo',
      shortName: 'SNES',
      manufacturer: 'Nintendo',
      releaseYear: 1990,
      romFolder: path.join(ROMS_DIR, 'SNES'),
      emulatorPath: path.join(APP_ROOT, 'emulators', 'retroarch', 'retroarch.exe'),
      corePath: path.join(APP_ROOT, 'emulators', 'retroarch', 'cores', 'snes9x_libretro.dll'),
      launchArgs: '-f -L "{CORE}" "{ROM}"',
      extensions: ['.sfc', '.smc', '.zip', '.7z', '.fig', '.swc'],
      libretroThumbRepo: 'Nintendo - Super Nintendo Entertainment System'
    },
    MAME: {
      id: 'MAME',
      name: 'Arcade (MAME / FBNeo)',
      shortName: 'Arcade',
      manufacturer: 'Arcade',
      releaseYear: 1980,
      romFolder: path.join(ROMS_DIR, 'MAME'),
      emulatorPath: path.join(APP_ROOT, 'emulators', 'retroarch', 'retroarch.exe'),
      corePath: path.join(APP_ROOT, 'emulators', 'retroarch', 'cores', 'fbneo_libretro.dll'),
      launchArgs: '-f -L "{CORE}" "{ROM}"',
      extensions: ['.zip', '.7z'],
      libretroThumbRepo: 'FBNeo - Arcade Games'
    },
    PS2: {
      id: 'PS2',
      name: 'PlayStation 2',
      shortName: 'PS2',
      manufacturer: 'Sony',
      releaseYear: 2000,
      romFolder: path.join(ROMS_DIR, 'PS2'),
      emulatorPath: path.join(APP_ROOT, 'emulators', 'pcsx2', 'pcsx2-qt.exe'),
      corePath: '',
      launchArgs: '-batch -fullscreen -nogui -- "{ROM}"',
      extensions: ['.chd', '.iso', '.cso', '.bin', '.gz', '.mdf', '.nrg'],
      libretroThumbRepo: 'Sony - PlayStation 2'
    },
    WII: {
      id: 'WII',
      name: 'Nintendo Wii',
      shortName: 'Wii',
      manufacturer: 'Nintendo',
      releaseYear: 2006,
      romFolder: path.join(ROMS_DIR, 'WII'),
      emulatorPath: path.join(APP_ROOT, 'emulators', 'dolphin', 'Dolphin.exe'),
      corePath: '',
      launchArgs: '-b -e "{ROM}"',
      extensions: ['.rvz', '.wbfs', '.iso', '.ciso', '.gcm'],
      libretroThumbRepo: 'Nintendo - Wii'
    },
    GC: {
      id: 'GC',
      name: 'Nintendo GameCube',
      shortName: 'GameCube',
      manufacturer: 'Nintendo',
      releaseYear: 2001,
      romFolder: path.join(ROMS_DIR, 'GC'),
      emulatorPath: path.join(APP_ROOT, 'emulators', 'dolphin', 'Dolphin.exe'),
      corePath: '',
      launchArgs: '-b -e "{ROM}"',
      extensions: ['.rvz', '.gcm', '.iso', '.ciso', '.wbfs'],
      libretroThumbRepo: 'Nintendo - GameCube'
    },
    PSP: {
      id: 'PSP',
      name: 'PlayStation Portable',
      shortName: 'PSP',
      manufacturer: 'Sony',
      releaseYear: 2004,
      romFolder: path.join(ROMS_DIR, 'PSP'),
      emulatorPath: path.join(APP_ROOT, 'emulators', 'ppsspp', 'PPSSPPWindows64.exe'),
      corePath: '',
      launchArgs: '--fullscreen "{ROM}"',
      extensions: ['.iso', '.cso', '.chd', '.pbp'],
      libretroThumbRepo: 'Sony - PlayStation Portable'
    },
    PS3: {
      id: 'PS3',
      name: 'PlayStation 3',
      shortName: 'PS3',
      manufacturer: 'Sony',
      releaseYear: 2006,
      romFolder: path.join(ROMS_DIR, 'PS3'),
      emulatorPath: path.join(APP_ROOT, 'emulators', 'rpcs3', 'rpcs3.exe'),
      corePath: '',
      launchArgs: '--no-gui "{ROM}"',
      extensions: ['.iso', '.pkg', '.bin', '.self', '.eboot'],
      libretroThumbRepo: 'Sony - PlayStation 3'
    },
    N64: {
      id: 'N64',
      name: 'Nintendo 64',
      shortName: 'Nintendo 64',
      manufacturer: 'Nintendo',
      releaseYear: 1996,
      romFolder: path.join(ROMS_DIR, 'N64'),
      emulatorPath: path.join(APP_ROOT, 'emulators', 'retroarch', 'retroarch.exe'),
      corePath: path.join(APP_ROOT, 'emulators', 'retroarch', 'cores', 'mupen64plus_next_libretro.dll'),
      launchArgs: '-f -L "{CORE}" "{ROM}"',
      extensions: ['.z64', '.n64', '.v64', '.zip', '.7z'],
      libretroThumbRepo: 'Nintendo - Nintendo 64'
    },
    GBA: {
      id: 'GBA',
      name: 'Game Boy Advance',
      shortName: 'GBA',
      manufacturer: 'Nintendo',
      releaseYear: 2001,
      romFolder: path.join(ROMS_DIR, 'GBA'),
      emulatorPath: path.join(APP_ROOT, 'emulators', 'retroarch', 'retroarch.exe'),
      corePath: path.join(APP_ROOT, 'emulators', 'retroarch', 'cores', 'mgba_libretro.dll'),
      launchArgs: '-f -L "{CORE}" "{ROM}"',
      extensions: ['.gba', '.zip', '.7z'],
      libretroThumbRepo: 'Nintendo - Game Boy Advance'
    },
    GBC: {
      id: 'GBC',
      name: 'Game Boy Color',
      shortName: 'GBC',
      manufacturer: 'Nintendo',
      releaseYear: 1998,
      romFolder: path.join(ROMS_DIR, 'GBC'),
      emulatorPath: path.join(APP_ROOT, 'emulators', 'retroarch', 'retroarch.exe'),
      corePath: path.join(APP_ROOT, 'emulators', 'retroarch', 'cores', 'gambatte_libretro.dll'),
      launchArgs: '-f -L "{CORE}" "{ROM}"',
      extensions: ['.gbc', '.zip', '.7z'],
      libretroThumbRepo: 'Nintendo - Game Boy Color'
    },
    GB: {
      id: 'GB',
      name: 'Game Boy',
      shortName: 'Game Boy',
      manufacturer: 'Nintendo',
      releaseYear: 1989,
      romFolder: path.join(ROMS_DIR, 'GB'),
      emulatorPath: path.join(APP_ROOT, 'emulators', 'retroarch', 'retroarch.exe'),
      corePath: path.join(APP_ROOT, 'emulators', 'retroarch', 'cores', 'gambatte_libretro.dll'),
      launchArgs: '-f -L "{CORE}" "{ROM}"',
      extensions: ['.gb', '.zip', '.7z'],
      libretroThumbRepo: 'Nintendo - Game Boy'
    },
    SWITCH: {
      id: 'SWITCH',
      name: 'Nintendo Switch',
      shortName: 'Switch',
      manufacturer: 'Nintendo',
      releaseYear: 2017,
      romFolder: path.join(ROMS_DIR, 'SWITCH'),
      emulatorPath: path.join(APP_ROOT, 'emulators', 'ryujinx', 'Ryujinx.exe'),
      corePath: '',
      launchArgs: '--fullscreen "{ROM}"',
      extensions: ['.nsp', '.xci'],
      libretroThumbRepo: 'Nintendo - Nintendo Switch'
    },
    PC: {
      id: 'PC',
      name: 'Jogos de PC (.EXE)',
      shortName: 'PC',
      manufacturer: 'Microsoft Windows',
      releaseYear: 2024,
      romFolder: path.join(ROMS_DIR, 'PC'),
      emulatorPath: 'explorer.exe',
      corePath: '',
      launchArgs: '"{ROM}"',
      extensions: ['.exe', '.lnk', '.bat', '.cmd', '.url'],
      libretroThumbRepo: ''
    },
    STEAM: {
      id: 'STEAM',
      name: 'Steam',
      shortName: 'Steam',
      manufacturer: 'Valve',
      releaseYear: 2003,
      romFolder: '',
      emulatorPath: 'explorer.exe',
      corePath: '',
      launchArgs: '"{ROM}"',
      extensions: [],
      libretroThumbRepo: ''
    },
    EPIC: {
      id: 'EPIC',
      name: 'Epic Games',
      shortName: 'Epic',
      manufacturer: 'Epic Games',
      releaseYear: 2018,
      romFolder: '',
      emulatorPath: path.join(APP_ROOT, 'emulators', 'legendary', 'legendary.exe'),
      corePath: '',
      launchArgs: 'launch "{ROM}"',
      extensions: [],
      libretroThumbRepo: ''
    }
  }
};

function loadDb() {
  let db = {
    config: DEFAULT_CONFIG,
    games: {},
    sessions: []
  };
  if (fs.existsSync(DB_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      db = {
        ...db,
        ...saved,
        config: {
          ...DEFAULT_CONFIG,
          ...(saved.config || {}),
          consoles: {
            ...DEFAULT_CONFIG.consoles,
            ...((saved.config && saved.config.consoles) || {})
          }
        }
      };
    } catch (e) {
      console.error('Error loading DB:', e);
    }
  }

  // Auto-migrate old / non-existent paths to new local structure inside HydraRetro
  if (db.config && db.config.consoles) {
    for (const [cid, c] of Object.entries(db.config.consoles)) {
      const def = DEFAULT_CONFIG.consoles[cid];
      if (!def) continue;
      if (def.romFolder && (!c.romFolder || !fs.existsSync(c.romFolder))) {
        c.romFolder = def.romFolder;
      }
      if (def.emulatorPath && def.emulatorPath !== 'explorer.exe' && (!c.emulatorPath || !fs.existsSync(c.emulatorPath))) {
        c.emulatorPath = def.emulatorPath;
      }
      if (def.corePath && (!c.corePath || !fs.existsSync(c.corePath))) {
        c.corePath = def.corePath;
      }
    }
    for (const k of ['PC', 'STEAM', 'EPIC']) {
      if (!db.config.consoles[k]) {
        db.config.consoles[k] = { ...DEFAULT_CONFIG.consoles[k] };
      }
    }
    if (!Array.isArray(db.config.pcGameFolders)) {
      db.config.pcGameFolders = [];
    }
  }

  return db;
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

let db = loadDb();
const downloadsEngine = new HydraDownloadsEngine({
  rootDir: APP_ROOT,
  dataDir: DATA_DIR,
  getDb: () => db,
  saveDb: () => saveDb(db),
  onDownloadCompleted: async (dlItem, targetPath) => {
    try {
      scanLibrary();
    } catch {}
  }
});
let ps1HydraMeta = {};
if (fs.existsSync(PS1_META_FILE)) {
  try {
    ps1HydraMeta = JSON.parse(fs.readFileSync(PS1_META_FILE, 'utf8'));
  } catch {}
}

let gamesMeta = {};
if (fs.existsSync(GAMES_META_FILE)) {
  try {
    gamesMeta = JSON.parse(fs.readFileSync(GAMES_META_FILE, 'utf8'));
  } catch {}
}

function fetchJson(url, opt) {
  return new Promise((resolve) => {
    const req = https.get(url, opt, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

async function fetchSteamGridDb(cleanTitleStr, apiKey) {
  if (!apiKey || !cleanTitleStr) return null;
  const opt = {
    headers: { 'Authorization': `Bearer ${apiKey}`, 'User-Agent': 'HydraRetro/1.0' }
  };
  try {
    const searchUrl = `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(cleanTitleStr)}`;
    const searchRes = await fetchJson(searchUrl, opt);
    if (!searchRes || !searchRes.success || !searchRes.data || searchRes.data.length === 0) {
      return null;
    }
    const match = searchRes.data[0];
    const gameId = match.id;

    const gridRes = await fetchJson(`https://www.steamgriddb.com/api/v2/grids/game/${gameId}?dimensions=600x900&types=static`, opt);
    const heroRes = await fetchJson(`https://www.steamgriddb.com/api/v2/heroes/game/${gameId}?types=static`, opt);
    const logoRes = await fetchJson(`https://www.steamgriddb.com/api/v2/logos/game/${gameId}?types=static`, opt);

    return {
      steamGridId: gameId,
      matchedTitle: match.name,
      coverUrl: gridRes?.data?.[0]?.url || null,
      heroUrl: heroRes?.data?.[0]?.url || null,
      logoUrl: logoRes?.data?.[0]?.url || null
    };
  } catch (e) {
    console.error('SteamGridDB error:', e);
    return null;
  }
}

function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'HydraRetro/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Status HTTP ${res.statusCode}`));
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(destPath));
      });
      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
    req.on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
    req.setTimeout(15000, () => {
      req.destroy();
      fs.unlink(destPath, () => {});
      reject(new Error('Timeout ao baixar imagem'));
    });
  });
}

async function fetchSteamGridDbGrids(cleanTitleStr, apiKey) {
  if (!apiKey || !cleanTitleStr) return [];
  const opt = {
    headers: { 'Authorization': `Bearer ${apiKey}`, 'User-Agent': 'HydraRetro/1.0' }
  };
  try {
    const searchUrl = `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(cleanTitleStr)}`;
    const searchRes = await fetchJson(searchUrl, opt);
    if (!searchRes || !searchRes.success || !searchRes.data || searchRes.data.length === 0) {
      return [];
    }
    const gameId = searchRes.data[0].id;
    const gridRes = await fetchJson(`https://www.steamgriddb.com/api/v2/grids/game/${gameId}?dimensions=600x900&types=static`, opt);
    if (gridRes && gridRes.success && Array.isArray(gridRes.data)) {
      return gridRes.data.slice(0, 15).map((item, index) => ({
        id: `sgdb_${item.id || index}`,
        type: 'steamgriddb',
        label: `SteamGridDB HD #${index + 1}${item.author?.name ? ' (por ' + item.author.name + ')' : ''}`,
        thumbUrl: item.thumb || item.url,
        url: item.url
      }));
    }
  } catch (e) {
    console.error('SteamGridDB Grids error:', e.message);
  }
  return [];
}

let activeSession = null;
let shutdownTimer = null;

function cleanTitle(rawName) {
  let cleaned = rawName
    .replace(/_/g, ' ')
    .replace(/\s*\((Disc|Disco)\s*\d+\).*$/i, '')
    .replace(/\s*\[Arcade Disc\]/i, '')
    .replace(/\s*\(Evolution Disc\)/i, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\s*\((USA|Europe|Japan|World|Brazil|Asia|Korea|Unl|Rev\s*[A-Z0-9]+|Alt\s*[0-9]*|Beta|Proto|Virtual Console|Sega Channel|Switch Online|Arcade Mode|Simulation Mode|Translated[^)]*|U|E|J|W|UE|JU|B|BR|F|G|I|S|PD|M\d+|En[^)]*|V\d+(\.\d+)?|\!)[^)]*\)/gi, '')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || rawName;
}

const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function getZipMetadata(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(512);
    const bytesRead = fs.readSync(fd, buf, 0, 512, 0);
    fs.closeSync(fd);
    if (bytesRead < 30 || buf.readUInt32LE(0) !== 0x04034b50) return null;
    const crc32 = buf.readUInt32LE(14).toString(16).toUpperCase().padStart(8, '0');
    const nameLen = buf.readUInt16LE(26);
    let firstEntry = null;
    if (nameLen > 0 && (30 + nameLen) <= bytesRead) {
      const fileName = buf.toString('utf8', 30, 30 + nameLen);
      firstEntry = path.basename(fileName, path.extname(fileName));
    }
    return { crc32, firstEntry };
  } catch {
    return null;
  }
}

function computeRomCrc32(filePath, maxBytes = 16 * 1024 * 1024) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.zip') {
      const meta = getZipMetadata(filePath);
      return meta ? meta.crc32 : null;
    }
    const stat = fs.statSync(filePath);
    if (stat.size > maxBytes) return null;
    const buf = fs.readFileSync(filePath);
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
    }
    return ((crc ^ (-1)) >>> 0).toString(16).toUpperCase().padStart(8, '0');
  } catch {
    return null;
  }
}

function libretroUrl(repo, type, baseName) {
  const sanitized = baseName.replace(/[&*/:`<>?\\|"]/g, '_');
  return `https://thumbnails.libretro.com/${encodeURIComponent(repo)}/${type}/${encodeURIComponent(sanitized)}.png`;
}

function getZipFirstEntry(filePath) {
  const meta = getZipMetadata(filePath);
  return meta ? meta.firstEntry : null;
}

function getArtworkCandidates(primaryBase, innerBase, cleanTitleStr) {
  const candidates = new Set();

  // 1. Exact No-Intro / Redump ROM filename and inner archive filename FIRST
  // This guarantees 1st-try 200 OK matches on Libretro CDN for No-Intro sets (GBA, SNES, Genesis, etc.)
  if (primaryBase) candidates.add(primaryBase);
  if (innerBase) candidates.add(innerBase);

  // 2. Normalized short region tags in filename: (U) -> (USA), (E) -> (Europe)
  if (primaryBase) {
    const normBase = primaryBase
      .replace(/_/g, ' ')
      .replace(/\s*\[[^\]]*\]/g, '')
      .replace(/\(U\)/gi, '(USA)')
      .replace(/\(E\)/gi, '(Europe)')
      .replace(/\(J\)/gi, '(Japan)')
      .replace(/\(W\)/gi, '(World)')
      .replace(/\(UE\)/gi, '(USA, Europe)')
      .replace(/\(JU\)/gi, '(Japan, USA)')
      .trim();
    if (normBase) {
      candidates.add(normBase);
      if (normBase.endsWith('(Europe)')) {
        candidates.add(`${normBase} (En,Fr,De)`);
        candidates.add(`${normBase} (En,Fr,De,Es)`);
      } else if (normBase.endsWith('(USA, Europe)')) {
        candidates.add(`${normBase} (En,Fr,De)`);
      }
    }
  }

  // 3. Common region suffix patterns on Libretro Thumbnails as fallbacks
  const regions = [
    '(USA)',
    '(World)',
    '(USA, Europe)',
    '(Europe)',
    '(Europe) (En,Fr,De)',
    '(USA, Europe) (En,Fr,De)',
    '',
    '(Japan, USA)',
    '(World) (Rev A)',
    '(World) (Rev 1)',
    '(USA, Europe) (Rev A)',
    '(USA) (Rev 1)',
    '(USA) (Rev A)',
    '(Europe) (Rev A)',
    '(Japan, Europe)',
    '(Japan)',
    '(Brazil)'
  ];

  if (cleanTitleStr) {
    const titleVariants = [cleanTitleStr];
    // No-Intro convention moves leading "The " before subtitle or to the end: "The Addams Family" -> "Addams Family, The"
    if (/^the\s+/i.test(cleanTitleStr)) {
      const withoutThe = cleanTitleStr.replace(/^the\s+/i, '');
      if (withoutThe.includes(' - ')) {
        const parts = withoutThe.split(' - ');
        titleVariants.push(`${parts[0]}, The - ${parts.slice(1).join(' - ')}`);
      } else if (withoutThe.includes(': ')) {
        const parts = withoutThe.split(': ');
        titleVariants.push(`${parts[0]}, The - ${parts.slice(1).join(': ')}`);
      } else {
        titleVariants.push(`${withoutThe}, The`);
      }
    }

    for (const tv of titleVariants) {
      for (const r of regions) {
        candidates.add(r ? `${tv} ${r}` : tv);
      }
    }
  }

  return Array.from(candidates);
}

function findLocalArtwork(romFolder, baseName, cleanTitleStr, consoleId, dirListingCache = null) {
  const exts = ['.png', '.jpg', '.jpeg', '.webp'];
  const dirs = [];
  const rootCovers = path.join(APP_ROOT, 'covers');

  if (consoleId) {
    const cSub = consoleId.toLowerCase();
    dirs.push(
      path.join(COVERS_DIR, cSub),
      path.join(rootCovers, cSub)
    );
  }
  dirs.push(COVERS_DIR, rootCovers);

  if (romFolder && fs.existsSync(romFolder)) {
    dirs.push(
      path.join(romFolder, 'covers'),
      path.join(romFolder, 'Named_Boxarts'),
      path.join(romFolder, 'art'),
      romFolder
    );
  }

  const normBase = (baseName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const normClean = (cleanTitleStr || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;

    // Direct name candidates
    const candidates = [
      baseName,
      cleanTitleStr,
      cleanTitle(baseName),
      (baseName || '').replace(/\s+/g, '_'),
      (cleanTitleStr || '').replace(/\s+/g, '_')
    ];
    for (const c of candidates) {
      if (!c) continue;
      for (const ext of exts) {
        const full = path.join(dir, c + ext);
        if (fs.existsSync(full)) {
          return formatLocalCoverUrl(full);
        }
      }
    }

    // Normalized match against files in directory (using cache if available)
    try {
      let files;
      if (dirListingCache && dirListingCache.has(dir)) {
        files = dirListingCache.get(dir);
      } else {
        files = fs.readdirSync(dir);
        if (dirListingCache) dirListingCache.set(dir, files);
      }
      for (const f of files) {
        const ext = path.extname(f).toLowerCase();
        if (!exts.includes(ext)) continue;
        const fBase = path.basename(f, ext);
        const fNorm = fBase.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (fNorm === normBase || fNorm === normClean || (normClean.length >= 4 && fNorm === normClean)) {
          return formatLocalCoverUrl(path.join(dir, f));
        }
      }
    } catch {}
  }
  return null;
}

const SCREENSCRAPER_SYSTEMS = {
  PS1: 57,
  GENESIS: 1,
  SNES: 4,
  MAME: 75,
  PS2: 58,
  WII: 16,
  GC: 13,
  PSP: 61,
  PS3: 59,
  N64: 14,
  GBA: 12,
  GBC: 10,
  GB: 9,
  SWITCH: 225
};

const THEGAMESDB_PLATFORMS = {
  PS1: 6,
  PS2: 11,
  PS3: 12,
  PSP: 13,
  GENESIS: 18,
  SNES: 7,
  N64: 3,
  GBA: 5,
  GBC: 41,
  GB: 4,
  GC: 2,
  WII: 9,
  MAME: 23,
  SWITCH: 4971
};

function formatLocalCoverUrl(fullPath) {
  if (fullPath.startsWith(MEDIA_DIR)) {
    const rel = path.relative(MEDIA_DIR, fullPath).replace(/\\/g, '/');
    return `/media/${rel}`;
  }
  const rootCovers = path.join(APP_ROOT, 'covers');
  if (fullPath.startsWith(rootCovers)) {
    const rel = path.relative(rootCovers, fullPath).replace(/\\/g, '/');
    return `/covers/${rel}`;
  }
  return `/local-file?path=${encodeURIComponent(fullPath)}`;
}

function isLocalCover(coverUrl) {
  if (!coverUrl || typeof coverUrl !== 'string') return false;
  try {
    if (coverUrl.startsWith('/media/covers/')) {
      const rel = coverUrl.slice('/media/covers/'.length);
      const full = path.join(COVERS_DIR, decodeURIComponent(rel));
      return fs.existsSync(full);
    }
    if (coverUrl.startsWith('/covers/')) {
      const rel = coverUrl.slice('/covers/'.length);
      const rootCovers = path.join(APP_ROOT, 'covers');
      const full = path.join(rootCovers, decodeURIComponent(rel));
      return fs.existsSync(full);
    }
    if (coverUrl.startsWith('/local-file?path=')) {
      const filePath = decodeURIComponent(coverUrl.slice('/local-file?path='.length));
      return fs.existsSync(filePath);
    }
  } catch {}
  return false;
}

async function fetchWithTimeout(url, timeoutMs = 8000, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function getScreenScraperAuthParams(cfg = db.config) {
  const devId = (cfg.ssDevId || '').trim();
  const devPass = (cfg.ssDevPassword || '').trim();
  const user = (cfg.ssUsername || '').trim();
  const pass = (cfg.ssPassword || '').trim();
  const soft = cfg.ssSoftName || 'HydraRetro';

  if (!devId || !devPass) return null;

  return `devid=${encodeURIComponent(devId)}&devpassword=${encodeURIComponent(devPass)}&softname=${encodeURIComponent(soft)}` +
    (user ? `&ssid=${encodeURIComponent(user)}` : '') +
    (pass ? `&sspassword=${encodeURIComponent(pass)}` : '');
}

async function testScreenScraperAuth(config) {
  const authParams = getScreenScraperAuthParams(config);
  if (!authParams) {
    return { ok: false, error: 'Dev ID e Dev Password são necessários para acessar a API do ScreenScraper' };
  }

  const url = `https://api.screenscraper.fr/api2/ssuserInfos.php?${authParams}&output=json`;

  try {
    const res = await fetchWithTimeout(url, 8000);
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = null; }
    if (data && data.ssuser) {
      return {
        ok: true,
        user: data.ssuser.id || config.ssUsername || 'ScreenScraper Member',
        level: data.ssuser.niveau || 'Standard',
        maxRequestsPerDay: data.ssuser.maxrequestsperday,
        requestsToday: data.ssuser.requeststoday,
        threads: data.ssuser.maxthreads || 1
      };
    }
    return { ok: false, error: text.slice(0, 150) || 'Falha ao validar credenciais ScreenScraper' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function getRomFileType(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) return 'dossier';
  } catch {}
  const ext = path.extname(filePath || '').toLowerCase();
  const isoExts = ['.iso', '.chd', '.cso', '.cue', '.bin', '.pbp', '.wbfs', '.rvz', '.gcm', '.m3u'];
  return isoExts.includes(ext) ? 'iso' : 'rom';
}

function getRomFileSize(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}

async function fetchScreenScraperGame(game, queryTitle = null) {
  const authParams = getScreenScraperAuthParams();
  if (!authParams) return null;

  const sysId = SCREENSCRAPER_SYSTEMS[game.consoleId];
  if (!sysId) return null;

  const searchStr = (queryTitle || cleanTitle(game.title)).trim();

  // 1. If explicit search query provided, search by title first
  if (queryTitle && searchStr) {
    try {
      const searchUrl = `https://api.screenscraper.fr/api2/jeuRecherche.php?${authParams}&output=json&systemeid=${sysId}&recherche=${encodeURIComponent(searchStr)}`;
      const r = await fetchWithTimeout(searchUrl, 8000);
      if (r.ok) {
        const data = await r.json();
        if (data?.response?.jeux?.length > 0) {
          return data.response.jeux[0];
        }
      }
    } catch {}
  }

  // 2. Try jeuInfos.php by ROM filename, file size, romtype and CRC
  try {
    const primary = (game.discs && game.discs[0]) ? game.discs[0] : { path: game.romPath, fileName: game.fileName || path.basename(game.romPath) };
    const cleanFileName = path.basename(primary.fileName || primary.path);
    const romType = getRomFileType(primary.path);
    const romSize = getRomFileSize(primary.path) || game.sizeBytes || 0;

    let infoUrl = `https://api.screenscraper.fr/api2/jeuInfos.php?${authParams}&output=json&systemeid=${sysId}&romnom=${encodeURIComponent(cleanFileName)}&romtype=${romType}`;
    if (romSize > 0) {
      infoUrl += `&romtaille=${romSize}`;
    }
    if (game.crc32) {
      infoUrl += `&crc=${encodeURIComponent(game.crc32.toUpperCase())}`;
    }
    if (game.serial) {
      infoUrl += `&serialnum=${encodeURIComponent(game.serial)}`;
    }
    const r = await fetchWithTimeout(infoUrl, 8000);
    if (r.ok) {
      const data = await r.json();
      if (data?.response?.jeu) {
        return data.response.jeu;
      }
    }
  } catch {}

  // 3. Fallback to jeuRecherche.php by cleanTitle
  if (searchStr) {
    try {
      const searchUrl = `https://api.screenscraper.fr/api2/jeuRecherche.php?${authParams}&output=json&systemeid=${sysId}&recherche=${encodeURIComponent(searchStr)}`;
      const r2 = await fetchWithTimeout(searchUrl, 8000);
      if (r2.ok) {
        const data2 = await r2.json();
        if (data2?.response?.jeux?.length > 0) {
          return data2.response.jeux[0];
        }
      }
    } catch {}
  }

  return null;
}

async function fetchScreenScraperCovers(game, queryTitle = null) {
  const authParams = getScreenScraperAuthParams();
  if (!authParams) return [];

  const sysId = SCREENSCRAPER_SYSTEMS[game.consoleId];
  if (!sysId) return [];

  const results = [];
  const seenUrls = new Set();
  const searchStr = (queryTitle || cleanTitle(game.title)).trim();

  const extractMedias = (ssGame, gameName = '') => {
    if (!ssGame || !Array.isArray(ssGame.medias)) return;
    for (const m of ssGame.medias) {
      const mType = (m.type || '').toLowerCase();
      const supportedMap = {
        'box-2d': '2D',
        'box-3d': '3D',
        'box-2d-back': 'Traseira',
        'box-2d-side': 'Lombada',
        'wheel-hd': 'Logo HD',
        'wheel': 'Logo',
        'steamgrid': 'Steam Grid',
        'mixrbv1': 'Mix RBV1',
        'mixrbv2': 'Mix RBV2',
        'fanart': 'Fanart',
        'marquee': 'Marquee',
        'screenmarquee': 'Screen Marquee',
        'sstitle': 'Tela de Título',
        'ss': 'Screenshot'
      };

      if (supportedMap[mType]) {
        const reg = (m.region || 'Global').toUpperCase();
        const tagType = supportedMap[mType];
        const rawUrl = m.url;
        if (rawUrl && !seenUrls.has(rawUrl)) {
          seenUrls.add(rawUrl);
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(rawUrl)}`;
          results.push({
            id: `ss_${mType}_${reg}_${results.length}`,
            type: 'screenscraper',
            label: `ScreenScraper ${tagType} (${reg})${gameName ? ' — ' + gameName : ''}`,
            url: proxyUrl,
            thumbUrl: proxyUrl,
            rawUrl: rawUrl,
            mediaType: mType
          });
        }
      }
    }
  };

  // 1. If no explicit custom query, try exact hash/ROM lookup first
  if (!queryTitle) {
    try {
      const primary = (game.discs && game.discs[0]) ? game.discs[0] : { path: game.romPath, fileName: game.fileName || path.basename(game.romPath) };
      const cleanFileName = path.basename(primary.fileName || primary.path);
      const romType = getRomFileType(primary.path);
      const romSize = getRomFileSize(primary.path) || game.sizeBytes || 0;

      let infoUrl = `https://api.screenscraper.fr/api2/jeuInfos.php?${authParams}&output=json&systemeid=${sysId}&romnom=${encodeURIComponent(cleanFileName)}&romtype=${romType}`;
      if (romSize > 0) {
        infoUrl += `&romtaille=${romSize}`;
      }
      if (game.crc32) {
        infoUrl += `&crc=${encodeURIComponent(game.crc32.toUpperCase())}`;
      }
      if (game.serial) {
        infoUrl += `&serialnum=${encodeURIComponent(game.serial)}`;
      }
      const r = await fetchWithTimeout(infoUrl, 8000);
      if (r.ok) {
        const data = await r.json();
        if (data?.response?.jeu) {
          extractMedias(data.response.jeu);
        }
      }
    } catch {}
  }

  // 2. Query search by title to get alternatives / regions
  if (searchStr) {
    try {
      const searchUrl = `https://api.screenscraper.fr/api2/jeuRecherche.php?${authParams}&output=json&systemeid=${sysId}&recherche=${encodeURIComponent(searchStr)}`;
      const r2 = await fetchWithTimeout(searchUrl, 8000);
      if (r2.ok) {
        const data2 = await r2.json();
        const jeux = data2?.response?.jeux;
        if (Array.isArray(jeux)) {
          for (const j of jeux.slice(0, 6)) {
            const jName = (Array.isArray(j.noms) && j.noms[0]?.text) || j.nom || '';
            extractMedias(j, jName);
          }
        }
      }
    } catch (err) {
      console.error('ScreenScraper search error:', err.message);
    }
  }

  return results;
}

async function fetchTheGamesDbCovers(cleanTitleStr, consoleId, apiKey) {
  if (!apiKey || !cleanTitleStr) return [];
  const platId = THEGAMESDB_PLATFORMS[consoleId];
  try {
    let searchUrl = `https://api.thegamesdb.net/v1/Games/ByGameName?apikey=${encodeURIComponent(apiKey)}&name=${encodeURIComponent(cleanTitleStr)}`;
    if (platId) searchUrl += `&filter[platform]=${platId}`;
    const searchRes = await fetchJson(searchUrl, { headers: { 'User-Agent': 'HydraRetro/1.0' } });
    const games = searchRes?.data?.games;
    if (!Array.isArray(games) || games.length === 0) return [];

    const gameIds = games.slice(0, 3).map(g => g.id);
    const imgUrl = `https://api.thegamesdb.net/v1/Games/Images?apikey=${encodeURIComponent(apiKey)}&games_id=${gameIds.join(',')}&filter[type]=boxart`;
    const imgRes = await fetchJson(imgUrl, { headers: { 'User-Agent': 'HydraRetro/1.0' } });
    if (!imgRes?.data?.images) return [];

    const baseUrl = imgRes.data.base_url?.medium || imgRes.data.base_url?.original || 'https://cdn.thegamesdb.net/images/medium/';
    const covers = [];

    for (const gid of gameIds) {
      const gImages = imgRes.data.images[gid];
      const gameObj = games.find(g => g.id === gid);
      const gTitle = gameObj?.game_title || '';
      if (Array.isArray(gImages)) {
        for (const img of gImages) {
          if (img.type === 'boxart' && (img.side === 'front' || !img.side)) {
            const fullUrl = baseUrl + img.filename;
            covers.push({
              id: `tgdb_${img.id || covers.length}`,
              type: 'thegamesdb',
              label: `TheGamesDB (${img.side === 'front' ? 'Frente' : 'Boxart'})${gTitle ? ' — ' + gTitle : ''}`,
              thumbUrl: fullUrl,
              url: fullUrl
            });
          }
        }
      }
    }
    return covers;
  } catch (err) {
    console.error('TheGamesDB error:', err.message);
    return [];
  }
}

const HYDRA_LAUNCHBOX_PLATFORMS = {
  PS1: 'ps1',
  PS2: 'ps2',
  PS3: 'ps3',
  PSP: 'psp',
  SNES: 'snes',
  N64: 'n64',
  GC: 'gamecube',
  WII: 'wii',
  GB: 'gb',
  GBC: 'gbc',
  GBA: 'gba'
};

const HYDRA_HASH_PLATFORMS = {
  SNES: 'snes',
  N64: 'n64',
  GB: 'gb',
  GBC: 'gbc',
  GBA: 'gba'
};

async function verifyRemoteImageUrl(targetUrl, timeoutMs = 2500) {
  if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) {
    return false;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(targetUrl, {
      method: 'HEAD',
      headers: { 'User-Agent': 'HydraRetro/1.0' },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      return !ct || ct.startsWith('image/') || ct.includes('octet-stream');
    }
    return false;
  } catch {
    return false;
  }
}

function stripHtmlTags(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Ported from Hydra Launcher Original (retroarch-shop-details.ts, launchbox-shop-details.ts, get-game-assets.ts)
 * Resolves game metadata & artwork (cover, hero, logo, screenshots, description in PT) via Hydra API.
 */
async function fetchHydraGameByRomHashOrTitle(game, queryTitle = null) {
  if (!game && !queryTitle) return null;
  const consoleId = game?.consoleId || 'PC';
  const isPcStore = ['PC', 'STEAM', 'EPIC'].includes(consoleId);
  const searchTitle = (queryTitle || cleanTitle(game?.title || '')).replace(/[®™©]/g, '').trim();

  // 1. If Steam AppId is known and no custom queryTitle, fetch official Hydra Steam assets
  if (!queryTitle && game?.steamAppId) {
    try {
      const r = await fetchWithTimeout(`${HYDRA_API_URL}/games/steam/${encodeURIComponent(game.steamAppId)}/assets`, 6000);
      if (r.ok) {
        const assets = await r.json();
        if (assets && (assets.libraryImageUrl || assets.coverImageUrl)) {
          return {
            objectId: String(game.steamAppId),
            shop: 'steam',
            title: assets.title || game.title,
            coverUrl: assets.libraryImageUrl || assets.coverImageUrl || assets.iconUrl,
            heroUrl: assets.libraryHeroImageUrl || null,
            logoUrl: assets.logoImageUrl || null,
            iconUrl: assets.iconUrl || null,
            source: 'hydra_steam_assets'
          };
        }
      }
    } catch {}
  }

  // 2. If RetroArch hash platform (SNES, N64, GB, GBC, GBA) and game has CRC32, match by hash (exact match like Hydra Original)
  const hashPlatform = HYDRA_HASH_PLATFORMS[consoleId];
  if (!queryTitle && hashPlatform && (game?.crc32 || game?.romPath)) {
    try {
      let romCrc = game?.crc32 ? String(game.crc32).toUpperCase().trim() : null;
      let romFileName = game?.fileName || 'rom';
      let romSize = game?.romSizeBytes || game?.sizeBytes || 0;

      // For .zip archives, Hydra API requires the UNCOMPRESSED ROM sizeBytes and inner fileName from the ZIP header
      if (game?.romPath && game.romPath.toLowerCase().endsWith('.zip') && fs.existsSync(game.romPath)) {
        try {
          const fd = fs.openSync(game.romPath, 'r');
          const buf = Buffer.alloc(512);
          fs.readSync(fd, buf, 0, 512, 0);
          fs.closeSync(fd);
          if (buf.readUInt32LE(0) === 0x04034b50) {
            const zCrc = buf.readUInt32LE(14);
            const zUncompSize = buf.readUInt32LE(22);
            const nameLen = buf.readUInt16LE(26);
            if (zCrc) romCrc = zCrc.toString(16).toUpperCase().padStart(8, '0');
            if (zUncompSize > 0) romSize = zUncompSize;
            if (nameLen > 0 && 30 + nameLen <= 512) {
              romFileName = path.basename(buf.toString('utf8', 30, 30 + nameLen));
            }
          }
        } catch {}
      }

      if (romCrc) {
        const r = await fetchWithTimeout(`${HYDRA_API_URL}/games/shop-details`, 7000, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'HydraLauncher/3.0' },
          body: JSON.stringify({
            shop: 'launchbox',
            platform: hashPlatform,
            hashFormat: 'headerless-v1',
            language: 'pt',
            roms: [{
              crc32: romCrc,
              fileName: romFileName,
              sizeBytes: romSize,
              serial: game.sku || null
            }]
          })
        });
        if (r.ok) {
          const entries = await r.json();
          if (Array.isArray(entries) && entries.length > 0 && entries[0]?.data) {
            const entry = entries[0];
            const d = entry.data;
            const assets = d.assets || {};
            const yr = d.releaseDate ? parseInt(String(d.releaseDate).slice(0, 4), 10) : null;
            return {
              objectId: String(entry.objectId),
              shop: 'launchbox',
              title: d.title || assets.title || game.title,
              description: stripHtmlTags(d.description),
              developer: Array.isArray(d.developers) && d.developers[0] ? d.developers[0] : null,
              publisher: Array.isArray(d.publishers) && d.publishers[0] ? d.publishers[0] : null,
              releaseYear: (yr && yr > 1970 && yr < 2035) ? yr : null,
              genres: Array.isArray(d.genres) && d.genres.length > 0 ? d.genres : null,
              coverUrl: assets.libraryImageUrl || d.headerImage || assets.iconUrl || null,
              heroUrl: assets.libraryHeroImageUrl || (Array.isArray(d.screenshots) && d.screenshots[0]) || null,
              logoUrl: assets.logoImageUrl || null,
              iconUrl: assets.iconUrl || null,
              screenshots: Array.isArray(d.screenshots) ? d.screenshots : [],
              source: 'hydra_launchbox_hash'
            };
          }
        }
      }
    } catch {}
  }

  // 3. If game already has hydraObjectId or SKU and no custom queryTitle, query shop-details directly
  if (!queryTitle && (game?.hydraObjectId || game?.sku)) {
    try {
      const payload = { shop: 'launchbox', language: 'pt' };
      if (game.hydraObjectId) payload.objectIds = [String(game.hydraObjectId)];
      else if (game.sku) payload.skus = [String(game.sku).toUpperCase().replace(/[^A-Z0-9]/g, '')];

      const r = await fetchWithTimeout(`${HYDRA_API_URL}/games/shop-details`, 7000, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'HydraLauncher/3.0' },
        body: JSON.stringify(payload)
      });
      if (r.ok) {
        const entries = await r.json();
        if (Array.isArray(entries) && entries.length > 0 && entries[0]?.data) {
          const entry = entries[0];
          const d = entry.data;
          const assets = d.assets || {};
          const yr = d.releaseDate ? parseInt(String(d.releaseDate).slice(0, 4), 10) : null;
          return {
            objectId: String(entry.objectId),
            shop: 'launchbox',
            title: d.title || assets.title || game.title,
            description: stripHtmlTags(d.description),
            developer: Array.isArray(d.developers) && d.developers[0] ? d.developers[0] : null,
            publisher: Array.isArray(d.publishers) && d.publishers[0] ? d.publishers[0] : null,
            releaseYear: (yr && yr > 1970 && yr < 2035) ? yr : null,
            genres: Array.isArray(d.genres) && d.genres.length > 0 ? d.genres : null,
            coverUrl: assets.libraryImageUrl || d.headerImage || assets.iconUrl || null,
            heroUrl: assets.libraryHeroImageUrl || (Array.isArray(d.screenshots) && d.screenshots[0]) || null,
            logoUrl: assets.logoImageUrl || null,
            iconUrl: assets.iconUrl || null,
            screenshots: Array.isArray(d.screenshots) ? d.screenshots : [],
            source: 'hydra_launchbox_id'
          };
        }
      }
    } catch {}
  }

  if (!searchTitle || searchTitle.length < 2) return null;

  const isHydraTitleMatch = (qStr, candStr, strict = true) => {
    const nQ = String(qStr || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const nC = String(candStr || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!nQ || !nC) return false;
    if (nQ === nC) return true;
    if (nQ.length >= 5 && nC.length >= 5 && (nC.includes(nQ) || nQ.includes(nC))) return true;
    const stopWords = new Set(['the', 'and', 'for', 'or', 'of', 'in', 'to', 'on', 'with', 'edition', 'version', 'game']);
    const qTokens = String(qStr || '').toLowerCase().split(/[^a-z0-9]+/).filter(t => (t.length >= 3 || /^\d+$/.test(t)) && !stopWords.has(t));
    const cTokens = new Set(String(candStr || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
    if (qTokens.length === 0) return false;
    if (strict && !cTokens.has(qTokens[0])) return false;
    const matched = qTokens.filter(t => cTokens.has(t)).length;
    return (matched / qTokens.length) >= (strict ? 0.75 : 0.6);
  };

  // 4. Search Hydra Catalogue (/catalogue/search)
  try {
    const lbPlat = HYDRA_LAUNCHBOX_PLATFORMS[consoleId];
    const cleanQ = searchTitle.replace(/\s+-\s+/g, ': ');
    const searchAttempts = [];

    if (!isPcStore) {
      if (lbPlat) {
        searchAttempts.push({ title: cleanQ, shops: ['launchbox'], platforms: [lbPlat], take: 8, skip: 0 });
      }
      searchAttempts.push({ title: cleanQ, shops: ['launchbox'], take: 8, skip: 0 });
    }
    searchAttempts.push({ title: cleanQ, take: 8, skip: 0 });

    for (const payload of searchAttempts) {
      const r = await fetchWithTimeout(`${HYDRA_API_URL}/catalogue/search`, 6500, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'HydraLauncher/3.0' },
        body: JSON.stringify(payload)
      });
      if (!r.ok) continue;
      const data = await r.json();
      const edges = data?.edges;
      if (!Array.isArray(edges) || edges.length === 0) continue;

      const normTarget = searchTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
      const bestEdge = edges.find(e => (e.title || '').toLowerCase().replace(/[^a-z0-9]/g, '') === normTarget) ||
                       edges.find(e => isHydraTitleMatch(searchTitle, e.title, !Boolean(queryTitle)));
      if (!bestEdge || !bestEdge.objectId) continue;

      if (bestEdge.shop === 'launchbox') {
        // Fetch full shop-details in PT + assets for this LaunchBox objectId
        try {
          const detRes = await fetchWithTimeout(`${HYDRA_API_URL}/games/shop-details`, 6500, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'HydraLauncher/3.0' },
            body: JSON.stringify({ shop: 'launchbox', objectIds: [String(bestEdge.objectId)], language: 'pt' })
          });
          if (detRes.ok) {
            const entries = await detRes.json();
            if (Array.isArray(entries) && entries.length > 0 && entries[0]?.data) {
              const entry = entries[0];
              const d = entry.data;
              const assets = d.assets || {};
              const yr = d.releaseDate ? parseInt(String(d.releaseDate).slice(0, 4), 10) : (bestEdge.releaseYear || null);
              return {
                objectId: String(entry.objectId),
                shop: 'launchbox',
                title: d.title || bestEdge.title,
                description: stripHtmlTags(d.description),
                developer: (Array.isArray(d.developers) && d.developers[0]) || (Array.isArray(bestEdge.developers) && bestEdge.developers[0]) || null,
                publisher: (Array.isArray(d.publishers) && d.publishers[0]) || (Array.isArray(bestEdge.publishers) && bestEdge.publishers[0]) || null,
                releaseYear: (yr && yr > 1970 && yr < 2035) ? yr : null,
                genres: (Array.isArray(d.genres) && d.genres.length > 0) ? d.genres : (bestEdge.genres || null),
                coverUrl: assets.libraryImageUrl || bestEdge.libraryImageUrl || d.headerImage || null,
                heroUrl: assets.libraryHeroImageUrl || (Array.isArray(d.screenshots) && d.screenshots[0]) || null,
                logoUrl: assets.logoImageUrl || null,
                iconUrl: assets.iconUrl || null,
                screenshots: Array.isArray(d.screenshots) ? d.screenshots : [],
                source: 'hydra_catalogue_launchbox'
              };
            }
          }
        } catch {}

        return {
          objectId: String(bestEdge.objectId),
          shop: 'launchbox',
          title: bestEdge.title,
          description: null,
          developer: Array.isArray(bestEdge.developers) && bestEdge.developers[0] ? bestEdge.developers[0] : null,
          publisher: Array.isArray(bestEdge.publishers) && bestEdge.publishers[0] ? bestEdge.publishers[0] : null,
          releaseYear: bestEdge.releaseYear || null,
          genres: bestEdge.genres || null,
          coverUrl: bestEdge.libraryImageUrl || null,
          heroUrl: null,
          logoUrl: null,
          source: 'hydra_catalogue_edge'
        };
      } else if (bestEdge.shop === 'steam') {
        try {
          const assetRes = await fetchWithTimeout(`${HYDRA_API_URL}/games/steam/${encodeURIComponent(bestEdge.objectId)}/assets`, 6000);
          if (assetRes.ok) {
            const assets = await assetRes.json();
            if (assets) {
              return {
                objectId: String(bestEdge.objectId),
                steamAppId: String(bestEdge.objectId),
                shop: 'steam',
                title: assets.title || bestEdge.title,
                developer: Array.isArray(bestEdge.developers) && bestEdge.developers[0] ? bestEdge.developers[0] : null,
                publisher: Array.isArray(bestEdge.publishers) && bestEdge.publishers[0] ? bestEdge.publishers[0] : null,
                releaseYear: bestEdge.releaseYear || null,
                genres: bestEdge.genres || null,
                coverUrl: assets.libraryImageUrl || bestEdge.libraryImageUrl || null,
                heroUrl: assets.libraryHeroImageUrl || null,
                logoUrl: assets.logoImageUrl || null,
                iconUrl: assets.iconUrl || null,
                source: 'hydra_catalogue_steam'
              };
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    console.error('Hydra API catalogue search error:', err.message);
  }

  return null;
}

/**
 * Fetches multiple cover alternatives from Hydra Launcher's official API (/catalogue/search + /games/{shop}/{objectId}/assets)
 * for the Cover Selector Modal ("Escolher Capa / Alternativas").
 */
async function fetchHydraCoversForModal(game, queryTitle = null) {
  const results = [];
  const seenUrls = new Set();
  const consoleId = game?.consoleId || 'PC';
  const isPcStore = ['PC', 'STEAM', 'EPIC'].includes(consoleId);
  const searchStr = (queryTitle || cleanTitle(game?.title || '')).replace(/[®™©]/g, '').trim();

  const addCoverItem = (url, label, thumbUrl = null) => {
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);
    results.push({
      id: `hydra_${results.length}`,
      type: 'hydra',
      label,
      url,
      thumbUrl: thumbUrl || url
    });
  };

  // 1. Direct match by hash / hydraObjectId / steamAppId first
  try {
    const direct = await fetchHydraGameByRomHashOrTitle(game, queryTitle);
    if (direct) {
      if (direct.coverUrl) {
        addCoverItem(direct.coverUrl, `Hydra Oficial — ${direct.title} (${direct.shop.toUpperCase()})`);
      }
      if (direct.iconUrl && direct.iconUrl !== direct.coverUrl && direct.shop === 'launchbox') {
        addCoverItem(direct.iconUrl, `Hydra Boxart Compacta — ${direct.title}`);
      }
      if (direct.heroUrl) {
        addCoverItem(direct.heroUrl, `Hydra Hero Banner — ${direct.title}`);
      }
    }
  } catch {}

  if (!searchStr || searchStr.length < 2) return results;

  // 2. Catalogue search for multiple alternatives (LaunchBox + Steam)
  try {
    const lbPlat = HYDRA_LAUNCHBOX_PLATFORMS[consoleId];
    const cleanQ = searchStr.replace(/\s+-\s+/g, ': ');
    const stopWords = new Set(['the', 'and', 'for', 'or', 'of', 'in', 'to', 'on', 'with', 'edition', 'version', 'game']);
    const qTokens = cleanQ.toLowerCase().split(/[^a-z0-9]+/).filter(t => (t.length >= 3 || /^\d+$/.test(t)) && !stopWords.has(t));
    const nQ = cleanQ.toLowerCase().replace(/[^a-z0-9]/g, '');

    const isRelevantEdge = (candTitle) => {
      if (queryTitle) return true; // User typed a custom search in the modal
      const nC = String(candTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!nC) return false;
      if (nC === nQ || (nQ.length >= 5 && (nC.includes(nQ) || nQ.includes(nC)))) return true;
      if (qTokens.length === 0) return true;
      const cTokens = new Set(String(candTitle || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
      const matched = qTokens.filter(t => cTokens.has(t)).length;
      return (matched / qTokens.length) >= 0.65;
    };

    const queries = [];
    if (!isPcStore) {
      if (lbPlat) {
        queries.push({ title: cleanQ, shops: ['launchbox'], platforms: [lbPlat], take: 12, skip: 0 });
      }
      queries.push({ title: cleanQ, shops: ['launchbox'], take: 12, skip: 0 });
    }
    queries.push({ title: cleanQ, take: 10, skip: 0 });

    for (const q of queries) {
      const r = await fetchWithTimeout(`${HYDRA_API_URL}/catalogue/search`, 6000, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'HydraLauncher/3.0' },
        body: JSON.stringify(q)
      });
      if (!r.ok) continue;
      const data = await r.json();
      const edges = data?.edges;
      if (!Array.isArray(edges)) continue;

      for (const edge of edges.slice(0, 10)) {
        if (!isRelevantEdge(edge.title)) continue;
        if (edge.shop === 'launchbox' && edge.libraryImageUrl) {
          const platLabel = edge.platform ? ` • ${edge.platform}` : '';
          addCoverItem(edge.libraryImageUrl, `Hydra LaunchBox — ${edge.title}${platLabel}`);
        } else if (edge.shop === 'steam' && edge.objectId) {
          try {
            const ar = await fetchWithTimeout(`${HYDRA_API_URL}/games/steam/${encodeURIComponent(edge.objectId)}/assets`, 4000);
            if (ar.ok) {
              const assets = await ar.json();
              if (assets?.libraryImageUrl) {
                addCoverItem(assets.libraryImageUrl, `Hydra Steam 600x900 — ${assets.title || edge.title}`);
              }
              if (assets?.libraryHeroImageUrl) {
                addCoverItem(assets.libraryHeroImageUrl, `Hydra Steam Hero — ${assets.title || edge.title}`);
              }
            }
          } catch {}
          if (edge.libraryImageUrl) {
            addCoverItem(edge.libraryImageUrl, `Hydra Steam Header — ${edge.title}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('Hydra modal covers error:', err.message);
  }

  return results;
}

async function ensureLocalGameCover(game) {
  if (isLocalCover(game.coverUrl) || isLocalCover(game.customCoverUrl)) {
    return true; // Already has a local cover! Do not download again.
  }

  if (['PC', 'STEAM', 'EPIC'].includes(game.consoleId)) {
    const consoleSub = game.consoleId.toLowerCase();
    const destFolder = path.join(COVERS_DIR, consoleSub);
    fs.mkdirSync(destFolder, { recursive: true });
    const safeTitle = (pcEngine.cleanPcGameTitle(game.title) || game.title).replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();

    // 1. Try Hydra API Official Assets first (returns high-res shared.steamstatic.com 2x covers)
    try {
      const hydraMatch = await fetchHydraGameByRomHashOrTitle(game);
      if (hydraMatch) {
        if (hydraMatch.steamAppId && !game.steamAppId) game.steamAppId = hydraMatch.steamAppId;
        if (hydraMatch.heroUrl && !game.heroUrl) game.heroUrl = hydraMatch.heroUrl;
        if (hydraMatch.logoUrl && !game.logoUrl) game.logoUrl = hydraMatch.logoUrl;
        if (hydraMatch.coverUrl) {
          const ext = hydraMatch.coverUrl.toLowerCase().includes('.webp') ? '.webp' : (hydraMatch.coverUrl.toLowerCase().includes('.png') ? '.png' : '.jpg');
          const fileName = `${safeTitle}${ext}`;
          const destPath = path.join(destFolder, fileName);
          await downloadImage(hydraMatch.coverUrl, destPath);
          game.coverUrl = `/media/covers/${consoleSub}/${fileName}`;
          return true;
        }
      }
    } catch {}

    // 2. If game already has a remote coverUrl / coverCandidates
    const targetUrl = (game.coverUrl && (game.coverUrl.startsWith('http://') || game.coverUrl.startsWith('https://')))
      ? game.coverUrl
      : (Array.isArray(game.coverCandidates) && game.coverCandidates[0]);

    if (targetUrl) {
      try {
        const ext = targetUrl.toLowerCase().includes('.webp') ? '.webp' : (targetUrl.toLowerCase().includes('.png') ? '.png' : '.jpg');
        const fileName = `${safeTitle}${ext}`;
        const destPath = path.join(destFolder, fileName);
        await downloadImage(targetUrl, destPath);
        game.coverUrl = `/media/covers/${consoleSub}/${fileName}`;
        return true;
      } catch (e) {
        console.error(`Error downloading store cover for ${game.title}:`, e.message);
      }
    }

    // 3. Search Steam Store
    try {
      const stSearch = await pcEngine.searchSteamStoreGame(game.title);
      if (stSearch) {
        game.steamAppId = stSearch.steamAppId;
        game.coverCandidates = stSearch.coverCandidates;
        game.heroUrl = game.heroUrl || stSearch.heroUrl;
        game.logoUrl = game.logoUrl || stSearch.logoUrl;
        if (stSearch.coverUrl) {
          const fileName = `${safeTitle}.jpg`;
          const destPath = path.join(destFolder, fileName);
          await downloadImage(stSearch.coverUrl, destPath);
          game.coverUrl = `/media/covers/${consoleSub}/${fileName}`;
          return true;
        }
      }
    } catch (e) {
      console.error(`Steam store search cover error for ${game.title}:`, e.message);
    }
    return false;
  }

  const primary = (game.discs && game.discs[0]) ? game.discs[0] : { path: game.romPath, fileName: game.fileName };
  const primaryBase = primary?.fileName ? path.basename(primary.fileName, path.extname(primary.fileName)) : '';
  const cCfg = db.config.consoles[game.consoleId] || {};

  // Check if an existing cover file is already in covers/ or ROM folder
  const existingArt = findLocalArtwork(cCfg.romFolder, primaryBase, game.title, game.consoleId);
  if (existingArt) {
    game.coverUrl = existingArt;
    return true;
  }

  const consoleSub = game.consoleId.toLowerCase();
  const destFolder = path.join(COVERS_DIR, consoleSub);
  fs.mkdirSync(destFolder, { recursive: true });

  const safeTitle = cleanTitle(game.title).replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();

  // 1. Hydra Launcher Official API (CRC32 Hash / LaunchBox / CDN WebP — Zero Config Required!)
  try {
    const hydraMatch = await fetchHydraGameByRomHashOrTitle(game);
    if (hydraMatch) {
      if (hydraMatch.objectId && hydraMatch.shop === 'launchbox') {
        game.hydraObjectId = hydraMatch.objectId;
      }
      if (hydraMatch.heroUrl && (!game.heroUrl || game.heroUrl.includes('thumbnails.libretro.com'))) {
        game.heroUrl = hydraMatch.heroUrl;
      }
      if (hydraMatch.logoUrl && (!game.logoUrl || game.logoUrl.includes('thumbnails.libretro.com'))) {
        game.logoUrl = hydraMatch.logoUrl;
      }
      if (hydraMatch.description && (!game.description || game.description.startsWith('Um clássico atemporal'))) {
        game.description = hydraMatch.description;
        if (hydraMatch.developer) game.developer = hydraMatch.developer;
        if (hydraMatch.publisher) game.publisher = hydraMatch.publisher;
        if (hydraMatch.releaseYear) game.releaseYear = hydraMatch.releaseYear;
        if (hydraMatch.genres) game.genres = hydraMatch.genres;
        game.metadataEnriched = true;
        game.metadataSource = hydraMatch.source;
      }
      if (hydraMatch.coverUrl) {
        const ext = hydraMatch.coverUrl.toLowerCase().includes('.webp') ? '.webp' : (hydraMatch.coverUrl.toLowerCase().includes('.jpg') || hydraMatch.coverUrl.toLowerCase().includes('.jpeg') ? '.jpg' : '.png');
        const fileName = `${safeTitle}${ext}`;
        const destPath = path.join(destFolder, fileName);
        await downloadImage(hydraMatch.coverUrl, destPath);
        game.coverUrl = `/media/covers/${consoleSub}/${fileName}`;
        return true;
      }
    }
  } catch (err) {
    console.error(`Hydra API cover download error for ${game.title}:`, err.message);
  }

  // 2. ScreenScraper (if configured)
  if (db.config.ssDevId && db.config.ssDevPassword) {
    try {
      const ssCovers = await fetchScreenScraperCovers(game);
      if (ssCovers && ssCovers.length > 0) {
        const best = ssCovers.find(c => c.label.includes('2D')) || ssCovers.find(c => c.label.includes('3D')) || ssCovers[0];
        let rawUrl = best.rawUrl || best.url;
        if (rawUrl) {
          const auth = getScreenScraperAuthParams();
          if (auth && !rawUrl.includes('devid=')) {
            rawUrl += (rawUrl.includes('?') ? '&' : '?') + auth;
          }
          const ext = rawUrl.toLowerCase().includes('.webp') ? '.webp' : (rawUrl.toLowerCase().includes('.jpg') || rawUrl.toLowerCase().includes('.jpeg') ? '.jpg' : '.png');
          const fileName = `${safeTitle}${ext}`;
          const destPath = path.join(destFolder, fileName);
          await downloadImage(rawUrl, destPath);
          game.coverUrl = `/media/covers/${consoleSub}/${fileName}`;
          return true;
        }
      }
    } catch (err) {
      console.error(`ScreenScraper download error for ${game.title}:`, err.message);
    }
  }

  // 3. SteamGridDB fallback (if API Key configured)
  const sgKey = db.config.steamGridDbApiKey;
  if (sgKey) {
    try {
      const grids = await fetchSteamGridDbGrids(cleanTitle(game.title), sgKey);
      if (grids && grids.length > 0 && grids[0].url) {
        const rawUrl = grids[0].url;
        const ext = rawUrl.toLowerCase().includes('.webp') ? '.webp' : (rawUrl.toLowerCase().includes('.jpg') || rawUrl.toLowerCase().includes('.jpeg') ? '.jpg' : '.png');
        const fileName = `${safeTitle}${ext}`;
        const destPath = path.join(destFolder, fileName);
        await downloadImage(rawUrl, destPath);
        game.coverUrl = `/media/covers/${consoleSub}/${fileName}`;
        return true;
      }
    } catch (err) {
      console.error(`SteamGridDB download error for ${game.title}:`, err.message);
    }
  }

  // 4. Libretro CDN fallback (with primaryBase first!)
  if (Array.isArray(game.coverCandidates) && game.coverCandidates.length > 0) {
    for (const candUrl of game.coverCandidates.slice(0, 6)) {
      if (candUrl) {
        try {
          const fileName = `${safeTitle}.png`;
          const destPath = path.join(destFolder, fileName);
          await downloadImage(candUrl, destPath);
          game.coverUrl = `/media/covers/${consoleSub}/${fileName}`;
          return true;
        } catch {}
      }
    }
  }

  return false;
}

let retroRatingsCache = null;
function getRetroRating(title, consoleId, curatedRating) {
  if (typeof curatedRating === 'number') return curatedRating;
  if (!retroRatingsCache) {
    try {
      if (fs.existsSync(RETRO_RATINGS_FILE)) {
        const raw = JSON.parse(fs.readFileSync(RETRO_RATINGS_FILE, 'utf8'));
        retroRatingsCache = {};
        for (const [k, v] of Object.entries(raw)) {
          const normKey = (k || '')
            .toLowerCase()
            .replace(/\s*\([^)]*\)/g, '')
            .replace(/\s*\[[^\]]*\]/g, '')
            .replace(/, the\b/g, '')
            .replace(/\bthe\s+/g, '')
            .replace(/['":\-\.\?!#&]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          retroRatingsCache[normKey] = v;
        }
      } else {
        retroRatingsCache = {};
      }
    } catch {
      retroRatingsCache = {};
    }
  }

  const norm = (title || '')
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/, the\b/g, '')
    .replace(/\bthe\s+/g, '')
    .replace(/['":\-\.\?!#&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (retroRatingsCache[norm]) return retroRatingsCache[norm];

  for (const [key, score] of Object.entries(retroRatingsCache)) {
    if (norm === key) return score;
    if (key.length >= 6 && (norm.startsWith(key + ' ') || norm.endsWith(' ' + key) || norm === key)) {
      return score;
    }
  }

  if (norm.includes('mario') || norm.includes('zelda') || norm.includes('metroid') || norm.includes('donkey kong')) {
    return 4.7;
  }
  if (norm.includes('sonic') || norm.includes('streets of rage') || norm.includes('castlevania') || norm.includes('mega man')) {
    return 4.6;
  }
  if (norm.includes('street fighter') || norm.includes('mortal kombat') || norm.includes('crash bandicoot')) {
    return 4.5;
  }
  if (norm.includes('disney') || norm.includes('capcom') || norm.includes('konami')) {
    return 4.4;
  }

  let hash = 0;
  const str = (title || '') + (consoleId || '');
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const normalized = Math.abs(hash) % 1000;
  const val = 3.7 + (normalized / 999) * 0.9;
  return Math.round(val * 10) / 10;
}

let isLibraryScanning = false;
let scanProgress = {
  stage: 'idle',
  totalConsoles: 0,
  currentConsole: '',
  consoleName: '',
  processedFiles: 0,
  totalFiles: 0,
  percent: 0,
  message: 'Pronto'
};

async function scanLibrary(targetConsoleId = null) {
  isLibraryScanning = true;
  const foundKeys = new Set();
  const removedSet = new Set(Array.isArray(db.config.removedGames) ? db.config.removedGames : []);
  let newGamesCount = 0;
  let processedCount = 0;

  let totalFilesToScan = 0;
  for (const [cid, cCfg] of Object.entries(db.config.consoles)) {
    if (['STEAM', 'EPIC', 'PC'].includes(cid)) continue;
    if (targetConsoleId && cid !== targetConsoleId) continue;
    if (cCfg.romFolder && fs.existsSync(cCfg.romFolder)) {
      try { totalFilesToScan += fs.readdirSync(cCfg.romFolder).length; } catch {}
    }
  }

  scanProgress = {
    stage: 'scanning',
    totalConsoles: Object.keys(db.config.consoles).length,
    currentConsole: targetConsoleId || 'ALL',
    consoleName: 'Iniciando...',
    processedFiles: 0,
    totalFiles: totalFilesToScan,
    percent: 0,
    message: 'Indexando consoles e diretórios...'
  };

  try {
    for (const [consoleId, cCfg] of Object.entries(db.config.consoles)) {
      if (['STEAM', 'EPIC', 'PC'].includes(consoleId)) continue;
      if (targetConsoleId && consoleId !== targetConsoleId) continue;
      if (!cCfg.romFolder || !fs.existsSync(cCfg.romFolder)) continue;

      scanProgress.currentConsole = consoleId;
      scanProgress.consoleName = cCfg.name || consoleId;
      scanProgress.message = `Varrendo ${cCfg.name || consoleId}...`;

      const files = fs.readdirSync(cCfg.romFolder);
      const fileSet = new Set(files);
      const extSet = new Set((cCfg.extensions || []).map(e => e.toLowerCase()));
      const dirListingCache = new Map();

      // Group multi-disc games by clean title per console
      const groups = new Map();
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!extSet.has(ext)) continue;
        // Skip .bin if matching .cue exists (DuckStation boots .cue with track mappings)
        if (ext === '.bin' && fileSet.has(file.slice(0, -4) + '.cue')) continue;
        const fullPath = path.join(cCfg.romFolder, file);
        let stat;
        try { stat = fs.statSync(fullPath); } catch { continue; }
        if (!stat.isFile()) continue;

        const baseName = path.basename(file, path.extname(file));
        const hydraMeta = consoleId === 'PS1' ? ps1HydraMeta[file] : null;
        let title = (hydraMeta && hydraMeta.title) ? hydraMeta.title : cleanTitle(baseName);
        if (consoleId === 'MAME' && ARCADE_TITLES[baseName.toLowerCase()]) {
          title = ARCADE_TITLES[baseName.toLowerCase()];
        }
        const groupId = `${consoleId}::${title.toLowerCase()}`;
        if (removedSet.has(groupId)) continue;

        if (!groups.has(groupId)) {
          groups.set(groupId, {
            consoleId,
            title,
            baseName,
            file,
            fullPath,
            sizeBytes: stat.size,
            discs: [],
            hydraMeta
          });
        }
        const g = groups.get(groupId);
        g.discs.push({
          fileName: file,
          path: fullPath,
          label: baseName,
          sizeBytes: stat.size
        });
      }

      // Fast local cover index for instant offline matching
      const localCoversMap = new Map();
      const cSub = consoleId.toLowerCase();
      const consoleCoverDirs = [
        path.join(COVERS_DIR, cSub),
        path.join(APP_ROOT, 'covers', cSub)
      ];
      for (const dir of consoleCoverDirs) {
        if (fs.existsSync(dir)) {
          try {
            const cFiles = fs.readdirSync(dir);
            for (const cf of cFiles) {
              const ext = path.extname(cf).toLowerCase();
              if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
                const full = path.join(dir, cf);
                const url = formatLocalCoverUrl(full);
                const base = path.basename(cf, ext);
                const norm = base.toLowerCase().replace(/[^a-z0-9]/g, '');
                const cl = cleanTitle(base).toLowerCase().replace(/[^a-z0-9]/g, '');
                if (!localCoversMap.has(base)) localCoversMap.set(base, url);
                if (!localCoversMap.has(norm)) localCoversMap.set(norm, url);
                if (cl && !localCoversMap.has(cl)) localCoversMap.set(cl, url);
              }
            }
          } catch {}
        }
      }

      const resolveLocalCover = (bName, clTitle) => {
        if (!bName && !clTitle) return null;
        if (bName && localCoversMap.has(bName)) return localCoversMap.get(bName);
        const normB = (bName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normB && localCoversMap.has(normB)) return localCoversMap.get(normB);
        if (clTitle && localCoversMap.has(clTitle)) return localCoversMap.get(clTitle);
        const normC = (clTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normC && localCoversMap.has(normC)) return localCoversMap.get(normC);
        const clB = cleanTitle(bName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (clB && localCoversMap.has(clB)) return localCoversMap.get(clB);
        return null;
      };

      for (const [groupId, g] of groups.entries()) {
        processedCount++;
        foundKeys.add(groupId);
        g.discs.sort((a, b) => a.fileName.localeCompare(b.fileName));
        const primary = g.discs[0];
        const primaryBase = path.basename(primary.fileName, path.extname(primary.fileName));

        const existing = db.games[groupId];
        const totalSizeBytes = g.discs.reduce((acc, d) => acc + d.sizeBytes, 0);
        const isQuickMatch = existing && existing.romPath === primary.path && existing.sizeBytes === totalSizeBytes;

        if (isQuickMatch) {
          existing.discs = g.discs;
          if (!existing.customCoverUrl && (!existing.coverUrl || !isLocalCover(existing.coverUrl))) {
            const localCover = resolveLocalCover(primaryBase, g.title);
            if (localCover) {
              existing.coverUrl = localCover;
              existing.fallbackCoverUrl = localCover;
            }
          }
          if (processedCount % 60 === 0) {
            scanProgress.processedFiles = processedCount;
            scanProgress.percent = totalFilesToScan > 0 ? Math.min(99, Math.round((processedCount / totalFilesToScan) * 100)) : 50;
            scanProgress.message = `Indexando ${cCfg.name || consoleId} (${processedCount} de ${totalFilesToScan})...`;
            await new Promise(r => setImmediate(r));
          }
          continue;
        }

        const localCover = resolveLocalCover(primaryBase, g.title) || findLocalArtwork(cCfg.romFolder, primaryBase, g.title, consoleId, dirListingCache);

      // Smart metadata lookup: exact, cleaned, stripped, or fuzzy
      const curated = (() => {
        if (gamesMeta[g.title]) return gamesMeta[g.title];
        const cl = cleanTitle(g.title);
        if (gamesMeta[cl]) return gamesMeta[cl];
        const baseCl = cleanTitle(primaryBase);
        if (gamesMeta[baseCl]) return gamesMeta[baseCl];
        const noParen = g.title.replace(/\s*\([^)]*\)/g, '').trim();
        if (gamesMeta[noParen]) return gamesMeta[noParen];
        const lowerCl = cl.toLowerCase();
        for (const [k, v] of Object.entries(gamesMeta)) {
          if (k.toLowerCase() === lowerCl || cleanTitle(k).toLowerCase() === lowerCl || k.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase() === lowerCl) {
            return v;
          }
        }
        return null;
      })();

      // Use clean polished title if curated exists
      if (curated && curated.title) {
        g.title = curated.title;
      }
      const localLogo = null;
      const localVideo = null;

      const isZip = path.extname(primary.fileName).toLowerCase() === '.zip';
      const zipMeta = isZip ? getZipMetadata(primary.path) : null;
      const innerBase = zipMeta ? zipMeta.firstEntry : null;

      const candidateBases = getArtworkCandidates(primaryBase, innerBase, g.title);
      const effectiveBase = innerBase || primaryBase;

      const coverCandidates = candidateBases.map(b => libretroUrl(cCfg.libretroThumbRepo, 'Named_Boxarts', b));
      const heroCandidates = candidateBases.map(b => libretroUrl(cCfg.libretroThumbRepo, 'Named_Snaps', b));
      const logoCandidates = candidateBases.map(b => libretroUrl(cCfg.libretroThumbRepo, 'Named_Titles', b));

      let coverUrl = null;
      let heroUrl = null;
      let logoUrl = null;

      if (localCover) {
        coverUrl = localCover;
        heroUrl = heroCandidates[0] || localCover;
        logoUrl = localLogo || logoCandidates[0];
      } else if (g.hydraMeta) {
        coverUrl = g.hydraMeta.coverImageUrl || g.hydraMeta.iconUrl || coverCandidates[0];
        heroUrl = g.hydraMeta.heroImageUrl || heroCandidates[0];
        logoUrl = g.hydraMeta.logoImageUrl || localLogo || logoCandidates[0];
      } else {
        coverUrl = coverCandidates[0] || libretroUrl(cCfg.libretroThumbRepo, 'Named_Boxarts', effectiveBase);
        heroUrl = heroCandidates[0] || libretroUrl(cCfg.libretroThumbRepo, 'Named_Snaps', effectiveBase);
        logoUrl = localLogo || logoCandidates[0];
      }

      const defaultDevMap = {
        PS1: 'PlayStation Studios',
        GENESIS: 'Sega',
        SNES: 'Nintendo',
        MAME: 'Arcade',
        PS2: 'Sony Interactive Entertainment',
        WII: 'Nintendo',
        GC: 'Nintendo',
        PSP: 'Sony Interactive Entertainment',
        PS3: 'Sony Interactive Entertainment',
        N64: 'Nintendo',
        GBA: 'Nintendo',
        GBC: 'Nintendo',
        GB: 'Nintendo',
        SWITCH: 'Nintendo'
      };
      const defaultGenreMap = {
        PS1: ['PlayStation', 'Clássico 32-Bit'],
        GENESIS: ['Mega Drive', 'Clássico 16-Bit'],
        SNES: ['Super Nintendo', 'Clássico 16-Bit'],
        MAME: ['Arcade', 'Fliperama'],
        PS2: ['PlayStation 2', 'Clássico 128-Bit'],
        WII: ['Nintendo Wii', 'Aventura 3D'],
        GC: ['GameCube', 'Clássico 128-Bit'],
        PSP: ['PlayStation Portable', 'Portátil Sony'],
        PS3: ['PlayStation 3', 'Alta Definição'],
        N64: ['Nintendo 64', 'Clássico 64-Bit'],
        GBA: ['Game Boy Advance', 'Portátil 32-Bit'],
        GBC: ['Game Boy Color', 'Portátil Colorido'],
        GB: ['Game Boy', 'Portátil Clássico'],
        SWITCH: ['Nintendo Switch', 'Exclusivo Moderno']
      };

      const developer = curated?.developer || defaultDevMap[consoleId] || cCfg.manufacturer || 'Desconhecida';
      const publisher = curated?.publisher || defaultDevMap[consoleId] || cCfg.manufacturer || 'Desconhecida';
      const releaseYear = curated?.releaseYear || cCfg.releaseYear;
      const genres = curated?.genres || defaultGenreMap[consoleId] || ['Clássico Retrô', cCfg.name || cCfg.shortName];
      const description = curated?.description || (g.hydraMeta?.description) || `Um clássico atemporal de ${cCfg.name || cCfg.shortName} pronto para ser jogado em tela cheia com comandos responsivos.`;
      const players = curated?.players || '1-2 Jogadores';
      const rating = getRetroRating(g.title, consoleId, curated?.rating);

      if (existing?.steamGridData) {
        if (existing.steamGridData.coverUrl) coverUrl = existing.steamGridData.coverUrl;
        if (existing.steamGridData.heroUrl) heroUrl = existing.steamGridData.heroUrl;
        if (existing.steamGridData.logoUrl) logoUrl = existing.steamGridData.logoUrl;
      }

      const crc32 = existing?.crc32 || (zipMeta ? zipMeta.crc32 : computeRomCrc32(primary.path));
      const thumbFile = path.join(THUMBS_DIR, consoleId.toLowerCase(), `${primaryBase}.webp`);
      const thumbUrl = fs.existsSync(thumbFile) ? `/media/thumbs/${consoleId.toLowerCase()}/${encodeURIComponent(primaryBase)}.webp` : null;

      if (processedCount % 30 === 0) {
        scanProgress.processedFiles = processedCount;
        scanProgress.percent = totalFilesToScan > 0 ? Math.min(99, Math.round((processedCount / totalFilesToScan) * 100)) : 50;
        scanProgress.message = `Indexando ${cCfg.name || consoleId} (${processedCount} de ${totalFilesToScan})...`;
        await new Promise(r => setImmediate(r));
      }

      if (!existing) {
        db.games[groupId] = {
          id: groupId,
          consoleId,
          title: g.title,
          sortTitle: g.title.replace(/^The\s+/i, ''),
          romPath: primary.path,
          fileName: primary.fileName,
          crc32,
          thumbUrl,
          discs: g.discs,
          sizeBytes: g.discs.reduce((acc, d) => acc + d.sizeBytes, 0),
          coverUrl,
          coverCandidates,
          fallbackCoverUrl: localCover,
          heroUrl,
          heroCandidates,
          logoUrl,
          logoCandidates,
          fallbackLogoUrl: localLogo,
          videoUrl: localVideo,
          hydraObjectId: g.hydraMeta?.objectId || null,
          sku: g.hydraMeta?.sku || null,
          favorite: false,
          playTimeSeconds: 0,
          playCount: 0,
          lastPlayedAt: null,
          addedAt: new Date().toISOString(),
          achievements: null,
          description,
          developer,
          publisher,
          releaseYear,
          genres,
          players,
          rating,
          steamGridData: null,
          customCoverUrl: null
        };
        newGamesCount++;
      } else {
        existing.romPath = primary.path;
        existing.fileName = primary.fileName;
        existing.crc32 = crc32;
        existing.thumbUrl = thumbUrl;
        existing.discs = g.discs;
        existing.sizeBytes = g.discs.reduce((acc, d) => acc + d.sizeBytes, 0);

        let effectiveCover = existing.customCoverUrl;
        if (!effectiveCover && localCover) {
          effectiveCover = localCover;
        }
        if (!effectiveCover && isLocalCover(existing.coverUrl)) {
          effectiveCover = existing.coverUrl;
        }
        if (!effectiveCover && existing.coverUrl) {
          effectiveCover = existing.coverUrl;
        }
        if (!effectiveCover) {
          effectiveCover = coverUrl;
        }
        existing.coverUrl = effectiveCover;
        existing.coverCandidates = coverCandidates;
        existing.fallbackCoverUrl = localCover;
        existing.heroUrl = heroUrl;
        existing.heroCandidates = heroCandidates;
        existing.logoUrl = logoUrl;
        existing.logoCandidates = logoCandidates;
        existing.fallbackLogoUrl = localLogo;
        existing.videoUrl = localVideo;
        if (!existing.metadataEnriched) {
          existing.description = description;
          existing.developer = developer;
          existing.publisher = publisher;
          existing.releaseYear = releaseYear;
        }
        existing.genres = genres;
        existing.players = players;
        existing.rating = rating;
      }
    }
  }

  // 1. PC Games Scan
  for (const [key, g] of Object.entries(db.games)) {
    if (g.consoleId === 'PC' && g.isManualPcGame) {
      if (g.romPath && fs.existsSync(g.romPath)) {
        foundKeys.add(key);
      }
    }
  }

  const pcFoldersToScan = new Set();
  const defaultPcFolder = path.join(ROMS_DIR, 'PC');
  if (fs.existsSync(defaultPcFolder)) pcFoldersToScan.add(defaultPcFolder);
  if (Array.isArray(db.config.pcGameFolders)) {
    for (const pf of db.config.pcGameFolders) {
      if (pf && fs.existsSync(pf)) pcFoldersToScan.add(pf);
    }
  }

  function registerOrUpdatePcGame(title, exePath, statSize = 0, isManual = false) {
    if (!title || !exePath) return;
    const cleanT = pcEngine.cleanPcGameTitle(title) || title;
    const groupId = `PC::${cleanT.toLowerCase()}`;
    if (!isManual && removedSet.has(groupId)) return;
    foundKeys.add(groupId);

    const existing = db.games[groupId];
    let sizeBytes = statSize;
    if (!sizeBytes) {
      try { sizeBytes = fs.statSync(exePath).size; } catch {}
    }
    const fileName = path.basename(exePath);

    if (!existing) {
      db.games[groupId] = {
        id: groupId,
        consoleId: 'PC',
        title: cleanT,
        sortTitle: cleanT.replace(/^The\s+/i, ''),
        romPath: exePath,
        fileName,
        sizeBytes,
        installed: true,
        coverUrl: null,
        coverCandidates: [],
        heroUrl: null,
        logoUrl: null,
        developer: 'PC / Windows',
        publisher: 'PC / Windows',
        releaseYear: 2024,
        genres: ['Jogos de PC', 'Windows'],
        rating: getRetroRating(cleanT, 'PC', 4.5),
        description: `Jogo de PC (${cleanT}) pronto para execução nativa no Windows.`,
        players: '1 Jogador',
        favorite: false,
        playTimeSeconds: 0,
        playCount: 0,
        lastPlayedAt: null,
        addedAt: new Date().toISOString(),
        isManualPcGame: isManual,
        metadataEnriched: false
      };
      newGamesCount++;
    } else {
      existing.romPath = exePath;
      existing.fileName = fileName;
      existing.sizeBytes = sizeBytes || existing.sizeBytes;
      existing.installed = true;
      if (isManual) existing.isManualPcGame = true;
    }
  }

  for (const targetFolder of pcFoldersToScan) {
    let entries;
    try {
      entries = fs.readdirSync(targetFolder, { withFileTypes: true });
    } catch {
      continue;
    }

    let hasProcessedEntries = false;
    for (const entry of entries) {
      const fullPath = path.join(targetFolder, entry.name);
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.exe', '.lnk', '.bat', '.cmd'].includes(ext)) {
          if (ext === '.exe' && pcEngine.isIgnoredExecutable(fullPath)) {
            continue;
          }
          hasProcessedEntries = true;
          const cleanT = pcEngine.cleanPcGameTitle(path.basename(entry.name, ext));
          let size = 0;
          try { size = fs.statSync(fullPath).size; } catch {}
          registerOrUpdatePcGame(cleanT, fullPath, size, false);
        }
      } else if (entry.isDirectory()) {
        const subFolderName = entry.name;
        if (subFolderName.startsWith('.') || subFolderName.startsWith('$')) continue;
        const bestExe = pcEngine.findBestExecutableInFolder(fullPath);
        if (bestExe) {
          hasProcessedEntries = true;
          const cleanT = pcEngine.cleanPcGameTitle(subFolderName);
          let size = 0;
          try { size = fs.statSync(bestExe).size; } catch {}
          registerOrUpdatePcGame(cleanT, bestExe, size, false);
        }
      }
    }

    if (!hasProcessedEntries) {
      const bestExe = pcEngine.findBestExecutableInFolder(targetFolder);
      if (bestExe) {
        const cleanT = pcEngine.cleanPcGameTitle(path.basename(targetFolder));
        registerOrUpdatePcGame(cleanT, bestExe, 0, false);
      }
    }
  }

  // 2. STEAM Games Scan
  const steamPath = pcEngine.getSteamInstallPath();
  if (steamPath) {
    const installedSteam = pcEngine.scanSteamInstalledGames(steamPath);
    for (const app of installedSteam) {
      const groupId = 'STEAM::' + app.appId;
      if (removedSet.has(groupId)) continue;
      foundKeys.add(groupId);
      const existing = db.games[groupId];

      const coverUrl = existing?.customCoverUrl || (isLocalCover(existing?.coverUrl) ? existing.coverUrl : app.coverUrl);
      const coverCandidates = app.coverCandidates || [app.coverUrl];
      const heroUrl = existing?.heroUrl || app.heroUrl;
      const logoUrl = existing?.logoUrl || app.logoUrl;
      const developer = existing?.developer || 'Steam';
      const publisher = existing?.publisher || 'Valve / Steam';
      const releaseYear = existing?.releaseYear || 2020;
      const genres = existing?.genres || ['Steam', 'PC'];
      const rating = existing?.rating || 4.7;

      if (!existing) {
        db.games[groupId] = {
          id: groupId,
          consoleId: 'STEAM',
          title: app.title,
          sortTitle: app.title.replace(/^The\s+/i, ''),
          steamAppId: app.appId,
          romPath: app.exePath || app.launchUrl,
          fileName: app.exePath ? path.basename(app.exePath) : ('steam_app_' + app.appId),
          launchUrl: app.launchUrl,
          installed: true,
          sizeBytes: app.sizeBytes || 0,
          coverUrl,
          coverCandidates,
          heroUrl,
          logoUrl,
          developer,
          publisher,
          releaseYear,
          genres,
          rating,
          description: `Jogo da biblioteca Steam (${app.title}).`,
          players: '1 Jogador',
          favorite: false,
          playTimeSeconds: 0,
          playCount: 0,
          lastPlayedAt: null,
          addedAt: new Date().toISOString(),
          metadataEnriched: false
        };
        newGamesCount++;
      } else {
        existing.installed = true;
        existing.romPath = app.exePath || app.launchUrl;
        if (app.exePath) existing.fileName = path.basename(app.exePath);
        existing.launchUrl = app.launchUrl;
        existing.sizeBytes = app.sizeBytes || existing.sizeBytes;
        if (!existing.coverUrl || !isLocalCover(existing.coverUrl)) {
          existing.coverUrl = coverUrl;
        }
        if (!existing.heroUrl) existing.heroUrl = heroUrl;
        if (!existing.logoUrl) existing.logoUrl = logoUrl;
        if (!existing.coverCandidates || existing.coverCandidates.length === 0) {
          existing.coverCandidates = coverCandidates;
        }
      }
    }
  }

  // Preserva em foundKeys qualquer jogo STEAM::* que tenha fromSteamAccount === true
  for (const [key, g] of Object.entries(db.games)) {
    if (g.consoleId === 'STEAM' && g.fromSteamAccount) {
      foundKeys.add(key);
    }
  }

  // 3. EPIC Games Scan
  const installedEpic = pcEngine.scanEpicInstalledManifests();
  for (const item of installedEpic) {
    const groupId = 'EPIC::' + item.appName;
    if (removedSet.has(groupId)) continue;
    foundKeys.add(groupId);
    const existing = db.games[groupId];

    const coverUrl = existing?.customCoverUrl || existing?.coverUrl || null;
    const developer = existing?.developer || 'Epic Games';
    const publisher = existing?.publisher || 'Epic Games';
    const releaseYear = existing?.releaseYear || 2021;
    const genres = existing?.genres || ['Epic Games', 'PC'];
    const rating = existing?.rating || 4.6;
    const sizeBytes = item.installSize || item.sizeBytes || 0;

    if (!existing) {
      db.games[groupId] = {
        id: groupId,
        consoleId: 'EPIC',
        title: item.title,
        sortTitle: item.title.replace(/^The\s+/i, ''),
        epicAppName: item.appName,
        romPath: item.exePath || item.launchUrl,
        fileName: item.exePath ? path.basename(item.exePath) : item.appName,
        launchUrl: item.launchUrl,
        installed: true,
        sizeBytes,
        coverUrl,
        coverCandidates: coverUrl ? [coverUrl] : [],
        heroUrl: existing?.heroUrl || null,
        logoUrl: existing?.logoUrl || null,
        developer,
        publisher,
        releaseYear,
        genres,
        rating,
        description: `Jogo da biblioteca Epic Games (${item.title}).`,
        players: '1 Jogador',
        favorite: false,
        playTimeSeconds: 0,
        playCount: 0,
        lastPlayedAt: null,
        addedAt: new Date().toISOString(),
        metadataEnriched: false
      };
      newGamesCount++;
    } else {
      existing.installed = true;
      existing.romPath = item.exePath || item.launchUrl;
      if (item.exePath) existing.fileName = path.basename(item.exePath);
      existing.launchUrl = item.launchUrl;
      existing.sizeBytes = sizeBytes || existing.sizeBytes;
    }
  }

  // Preserva em foundKeys qualquer jogo EPIC::* que tenha fromEpicAccount === true
  for (const [key, g] of Object.entries(db.games)) {
    if (g.consoleId === 'EPIC' && g.fromEpicAccount) {
      foundKeys.add(key);
    }
  }

  // Remove games whose ROMs were deleted from disk
  for (const key of Object.keys(db.games)) {
    if (!foundKeys.has(key)) {
      delete db.games[key];
    }
  }

    saveDb(db);
    enqueueGamesForEnrichment();
    scanProgress = {
      stage: 'complete',
      totalConsoles: Object.keys(db.config.consoles).length,
      currentConsole: 'ALL',
      consoleName: 'Concluído',
      processedFiles: processedCount,
      totalFiles: totalFilesToScan,
      percent: 100,
      message: 'Catálogo pronto!'
    };
    isLibraryScanning = false;
    return { totalGames: Object.keys(db.games).length, newGamesCount };
  } catch (err) {
    console.error('[HydraRetro] Erro durante a varredura:', err);
    scanProgress.stage = 'error';
    scanProgress.message = 'Erro na varredura: ' + err.message;
    isLibraryScanning = false;
    throw err;
  }
}

// Generate deterministic RetroAchievements / Classic Milestones for any game + support real Hydra & RetroAchievements API
function getGameAchievements(game) {
  if (game.raAchievements && Array.isArray(game.raAchievements) && game.raAchievements.length > 0) {
    // Live check for PC local achievement files (Goldberg, RUNE, CODEX, OnlineFix, Steam Cache)
    if (['PC', 'STEAM', 'EPIC'].includes(game.consoleId) && (game.steamAppId || game.romPath)) {
      try {
        const localUnlocks = achEngine.scanPcLocalUnlockedAchievements(game);
        if (localUnlocks && localUnlocks.size > 0) {
          for (const a of game.raAchievements) {
            const k = String(a.name || a.id || '').toUpperCase();
            const u = localUnlocks.get(k);
            if (u && !a.unlocked) {
              a.unlocked = true;
              a.unlockTime = u.unlockTime || Date.now();
              if (a.iconUnlocked) a.icon = a.iconUnlocked;
            }
          }
        }
      } catch {}
    }
    return game.raAchievements;
  }
  
  const playTimeSec = game.playTimeSeconds || 0;
  const playCount = game.playCount || 0;
  const isFav = Boolean(game.favorite);
  
  return [
    {
      id: `${game.id}_start`,
      title: 'Primeiros Passos',
      description: 'Inicie o jogo pela primeira vez',
      points: 5,
      unlocked: playCount > 0,
      icon: '🎮'
    },
    {
      id: `${game.id}_30min`,
      title: 'Embalando no Clássico',
      description: 'Acumule 30 minutos de gameplay',
      points: 10,
      unlocked: playTimeSec >= 1800,
      icon: '⏱️'
    },
    {
      id: `${game.id}_fav`,
      title: 'Item de Coleção',
      description: 'Adicione este jogo aos seus Favoritos',
      points: 10,
      unlocked: isFav,
      icon: '⭐'
    },
    {
      id: `${game.id}_1h`,
      title: 'Veterano Retrô',
      description: 'Jogue por 1 hora completa',
      points: 20,
      unlocked: playTimeSec >= 3600,
      icon: '🏅'
    },
    {
      id: `${game.id}_3h`,
      title: 'Mestre da Nostalgia',
      description: 'Acumule 3 horas explorando o jogo',
      points: 30,
      unlocked: playTimeSec >= 10800,
      icon: '🏆'
    },
    {
      id: `${game.id}_5sessions`,
      title: 'Amor à Fita / Disco',
      description: 'Abra e jogue em 5 sessões distintas',
      points: 25,
      unlocked: playCount >= 5,
      icon: '💎'
    }
  ];
}

function cleanTitleForHltb(raw) {
  let title = (raw || '')
    .replace(/[®™©]/g, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/MD$/, '')
    .replace(/^007\s*-\s*/i, 'GoldenEye ')
    .replace(/[-:_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (title.toLowerCase() === 'sf2') title = 'Street Fighter II';
  return title;
}

const HYDRA_API_BASE_URL = 'https://hydra-api-us-east-1.losbroxas.org';

function formatHydraHltbDuration(durationStr) {
  if (!durationStr) return '--';
  return String(durationStr)
    .replace(/\bHours\b/gi, 'Horas')
    .replace(/\bHour\b/gi, 'Hora')
    .replace(/\bMins\b/gi, 'Min')
    .replace(/\bMinutes\b/gi, 'Min')
    .trim();
}

async function fetchHydraApiHowLongToBeat(shop, objectId) {
  if (!shop || !objectId) return null;
  try {
    const url = `${HYDRA_API_BASE_URL}/games/${encodeURIComponent(shop)}/${encodeURIComponent(objectId)}/how-long-to-beat`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'HydraLauncher/4.1.6',
        'Accept': 'application/json'
      }
    });
    if (!res.ok) return null;
    const categories = await res.json();
    if (!Array.isArray(categories) || categories.length === 0) return null;

    const findCat = (keywords) => categories.find(c =>
      c && c.title && keywords.some(k => c.title.toLowerCase().includes(k))
    );

    const mainCat = findCat(['main story', 'história principal', 'single-player']) || categories[0];
    const extraCat = findCat(['main + sides', 'main + extra', 'extras']) || categories[1];
    const compCat = findCat(['completionist', 'completista', '100%']) || categories[2];

    return {
      source: 'hydra_api',
      shop,
      objectId: String(objectId),
      categories: categories.map(c => ({
        title: c.title,
        duration: formatHydraHltbDuration(c.duration),
        rawDuration: c.duration,
        accuracy: c.accuracy || '00'
      })),
      mainTime: mainCat ? formatHydraHltbDuration(mainCat.duration) : '--',
      mainAccuracy: mainCat?.accuracy && mainCat.accuracy !== '00' ? `${mainCat.accuracy}%` : null,
      mainExtraTime: extraCat ? formatHydraHltbDuration(extraCat.duration) : '--',
      mainExtraAccuracy: extraCat?.accuracy && extraCat.accuracy !== '00' ? `${extraCat.accuracy}%` : null,
      completionistTime: compCat ? formatHydraHltbDuration(compCat.duration) : '--',
      completionistAccuracy: compCat?.accuracy && compCat.accuracy !== '00' ? `${compCat.accuracy}%` : null
    };
  } catch (e) {
    return null;
  }
}

async function searchHowLongToBeat(title, game = null) {
  let hydraData = null;

  // 1. Camada Primária (Idêntica ao Hydra Launcher Original: /games/{shop}/{objectId}/how-long-to-beat)
  try {
    let shop = null;
    let objectId = null;

    if (game) {
      if (game.steamAppId) {
        shop = 'steam';
        objectId = String(game.steamAppId);
      } else if (game.hydraObjectId) {
        shop = 'launchbox';
        objectId = String(game.hydraObjectId);
      } else if (['PC', 'STEAM', 'EPIC'].includes(game.consoleId)) {
        const stSearch = await pcEngine.searchSteamStoreGame(game.title || title);
        if (stSearch && stSearch.steamAppId) {
          game.steamAppId = stSearch.steamAppId;
          shop = 'steam';
          objectId = String(stSearch.steamAppId);
        }
      }
    }

    if (shop && objectId) {
      hydraData = await fetchHydraApiHowLongToBeat(shop, objectId);
    }
  } catch (_) {}

  // 2. Camada Direta HowLongToBeat.com (Complementa reviewScore, link direto e jogos retrô/custom sem ID)
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  const referer = 'https://howlongtobeat.com/';
  let directData = null;

  try {
    const initRes = await fetch(`https://howlongtobeat.com/api/search/site/init?t=${Date.now()}`, {
      headers: { 'User-Agent': ua, 'Referer': referer }
    });
    const init = await initRes.json();
    if (init && init.token) {
      const query = cleanTitleForHltb(title);
      const payload = {
        searchType: "games",
        searchTerms: query.split(/\s+/),
        searchPage: 1,
        size: 5,
        searchOptions: {
          games: {
            userId: 0,
            platform: "",
            sortCategory: "popular",
            rangeCategory: "main",
            rangeTime: { min: 0, max: 0 },
            gameplay: { perspective: "", flow: "", genre: "", difficulty: "" },
            rangeYear: { min: "", max: "" },
            modifier: ""
          },
          users: { sortCategory: "postcount" },
          lists: { sortCategory: "follows" },
          filter: "",
          sort: 0,
          randomizer: 0
        },
        useCache: true
      };
      if (init.hpKey) payload[init.hpKey] = init.hpVal;

      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': ua,
        'Accept': '*/*',
        'Referer': referer,
        'X-Auth-Token': init.token
      };
      if (init.hpKey) {
        headers['X-Hp-Key'] = init.hpKey;
        headers['X-Hp-Val'] = init.hpVal;
      }

      const searchRes = await fetch('https://howlongtobeat.com/api/search/site', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await searchRes.json();
      if (data && data.data && data.data.length > 0) {
        const g = data.data[0];
        directData = {
          id: g.game_id,
          name: g.game_name,
          mainTime: g.comp_main ? (g.comp_main / 3600).toFixed(1) + ' Horas' : '--',
          mainExtraTime: g.comp_plus ? (g.comp_plus / 3600).toFixed(1) + ' Horas' : '--',
          completionistTime: g.comp_100 ? (g.comp_100 / 3600).toFixed(1) + ' Horas' : '--',
          allStylesTime: g.comp_all ? (g.comp_all / 3600).toFixed(1) + ' Horas' : '--',
          reviewScore: g.review_score,
          platforms: g.profile_platform ? g.profile_platform.split(', ') : [],
          imageUrl: g.game_image ? `https://howlongtobeat.com/games/${g.game_image}` : null,
          url: `https://howlongtobeat.com/game/${g.game_id}`,
          source: 'hltb_direct'
        };
      }
    }
  } catch (e) {
    console.error('HLTB Direct Error:', e.message);
  }

  if (hydraData && directData) {
    return {
      ...directData,
      ...hydraData,
      mainTime: hydraData.mainTime !== '--' ? hydraData.mainTime : directData.mainTime,
      mainExtraTime: hydraData.mainExtraTime !== '--' ? hydraData.mainExtraTime : directData.mainExtraTime,
      completionistTime: hydraData.completionistTime !== '--' ? hydraData.completionistTime : directData.completionistTime,
      source: 'hydra_api+hltb_direct'
    };
  }

  return hydraData || directData || null;
}

function parseDetailsFromWikiExtract(extract, lang) {
  let dev = null;
  let pub = null;
  let year = null;
  const yMatch = extract.match(/\b(19[89]\d|20[0-2]\d)\b/);
  if (yMatch) year = parseInt(yMatch[1], 10);
  if (lang === 'pt') {
    const devMatch = extract.match(/desenvolvido (?:e publicado )?pela?\s+([^,\.\(\);]+)/i);
    if (devMatch) dev = devMatch[1].trim();
    const pubMatch = extract.match(/publicado pela?\s+([^,\.\(\);]+)/i);
    if (pubMatch) pub = pubMatch[1].trim();
  } else {
    const devMatch = extract.match(/developed (?:and published )?by\s+([^,\.\(\);]+)/i);
    if (devMatch) dev = devMatch[1].trim();
    const pubMatch = extract.match(/published by\s+([^,\.\(\);]+)/i);
    if (pubMatch) pub = pubMatch[1].trim();
  }
  return { dev, pub, year };
}

async function fetchOnlineMetadata(title, consoleId) {
  const clean = (title || '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .replace(/, The\b/i, '')
    .replace(/^The\s+/i, '')
    .replace(/[-:_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean || clean.length < 2) return null;

  const cCfg = (db && db.config && db.config.consoles && db.config.consoles[consoleId]) || {};
  const consoleName = cCfg.name || consoleId || '';
  const userAgent = 'HydraRetro/1.0 (https://github.com/HydraRetro; contact@hydraretro.local)';

  // 1. Try Portuguese Wikipedia
  const candidatesPt = [
    clean.replace(/\s+/g, '_'),
    `${clean.replace(/\s+/g, '_')}_(jogo_eletrônico)`,
    `${clean.replace(/\s+/g, '_')}_(jogo)`
  ];
  for (const cand of candidatesPt) {
    try {
      const url = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cand)}`;
      const r = await fetch(url, { headers: { 'User-Agent': userAgent } });
      if (r.ok) {
        const data = await r.json();
        if (data.type === 'standard' && data.extract && data.extract.length > 50) {
          const parsed = parseDetailsFromWikiExtract(data.extract, 'pt');
          return {
            description: data.extract,
            developer: parsed.dev,
            publisher: parsed.pub,
            releaseYear: parsed.year,
            source: 'wikipedia_pt'
          };
        }
      }
    } catch {}
  }

  // 2. Try English Wikipedia
  const candidatesEn = [
    clean.replace(/\s+/g, '_'),
    `${clean.replace(/\s+/g, '_')}_(video_game)`,
    `${clean.replace(/\s+/g, '_')}_(${encodeURIComponent(consoleName.replace(/\s+/g, '_'))}_video_game)`
  ];
  for (const cand of candidatesEn) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cand)}`;
      const r = await fetch(url, { headers: { 'User-Agent': userAgent } });
      if (r.ok) {
        const data = await r.json();
        if (data.type === 'standard' && data.extract && data.extract.length > 50) {
          const parsed = parseDetailsFromWikiExtract(data.extract, 'en');
          return {
            description: data.extract,
            developer: parsed.dev,
            publisher: parsed.pub,
            releaseYear: parsed.year,
            source: 'wikipedia_en'
          };
        }
      }
    } catch {}
  }

  // 3. OpenSearch fallback
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(clean + ' ' + consoleName)}&limit=3&namespace=0&format=json`;
    const r = await fetch(searchUrl, { headers: { 'User-Agent': userAgent } });
    if (r.ok) {
      const [, titles] = await r.json();
      if (titles && titles[0]) {
        const sumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titles[0].replace(/\s+/g, '_'))}`;
        const sumR = await fetch(sumUrl, { headers: { 'User-Agent': userAgent } });
        if (sumR.ok) {
          const sum = await sumR.json();
          if (sum.extract && sum.extract.length > 50) {
            const parsed = parseDetailsFromWikiExtract(sum.extract, 'en');
            return {
              description: sum.extract,
              developer: parsed.dev,
              publisher: parsed.pub,
              releaseYear: parsed.year,
              source: 'wikipedia_search'
            };
          }
        }
      }
    }
  } catch {}

  return null;
}

// Background auto-enrich queue (1 request every 1.5s to prevent rate limits)
let metadataQueue = [];
let isQueueRunning = false;

function enqueueGamesForEnrichment() {
  for (const game of Object.values(db.games)) {
    const isGeneric = !game.description || game.description.startsWith('Um clássico atemporal') || game.description.startsWith('Jogo de PC (') || game.description.startsWith('Jogo da biblioteca');
    const needsCover = !isLocalCover(game.coverUrl) && !isLocalCover(game.customCoverUrl);
    if ((isGeneric && !game.metadataEnriched) || needsCover) {
      if (!metadataQueue.includes(game.id)) {
        metadataQueue.push(game.id);
      }
    }
  }
  if (!isQueueRunning && metadataQueue.length > 0) {
    processMetadataQueue();
  }
}

async function processMetadataQueue() {
  if (metadataQueue.length === 0) {
    isQueueRunning = false;
    return;
  }
  isQueueRunning = true;
  const gameId = metadataQueue.shift();
  const game = db.games[gameId];
  if (game) {
    let updated = false;

    // Special handling for PC, STEAM, EPIC
    if (['PC', 'STEAM', 'EPIC'].includes(game.consoleId)) {
      if (!game.steamAppId) {
        try {
          const stSearch = await pcEngine.searchSteamStoreGame(game.title);
          if (stSearch) {
            game.steamAppId = stSearch.steamAppId;
            if (!isLocalCover(game.coverUrl) && !isLocalCover(game.customCoverUrl)) {
              game.coverCandidates = stSearch.coverCandidates;
              const consoleSub = game.consoleId.toLowerCase();
              const destFolder = path.join(COVERS_DIR, consoleSub);
              fs.mkdirSync(destFolder, { recursive: true });
              const safeTitle = (pcEngine.cleanPcGameTitle(game.title) || game.title).replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
              const fileName = `${safeTitle}.jpg`;
              const destPath = path.join(destFolder, fileName);
              try {
                await downloadImage(stSearch.coverUrl, destPath);
                game.coverUrl = `/media/covers/${consoleSub}/${fileName}`;
                updated = true;
              } catch (e) {
                console.error(`Error downloading Steam store cover for ${game.title}:`, e.message);
              }
            }
            game.heroUrl = game.heroUrl || stSearch.heroUrl;
            game.logoUrl = game.logoUrl || stSearch.logoUrl;
            updated = true;
          }
        } catch (e) {
          console.error(`Steam store search error for ${game.title}:`, e.message);
        }
      }

      if (game.steamAppId && !game.metadataEnriched) {
        try {
          const stDetails = await pcEngine.fetchSteamAppDetails(game.steamAppId);
          if (stDetails) {
            if (stDetails.description) game.description = stDetails.description;
            if (stDetails.developer) game.developer = stDetails.developer;
            if (stDetails.publisher) game.publisher = stDetails.publisher;
            if (stDetails.releaseYear) game.releaseYear = stDetails.releaseYear;
            if (Array.isArray(stDetails.genres) && stDetails.genres.length > 0) game.genres = stDetails.genres;
            game.metadataEnriched = true;
            game.metadataSource = 'steam_store';
            updated = true;
          }
        } catch (e) {
          console.error(`Steam app details error for ${game.title}:`, e.message);
        }
      }

      // If still not local cover, try ensureLocalGameCover
      if (!isLocalCover(game.coverUrl) && !isLocalCover(game.customCoverUrl)) {
        try {
          const coverDownloaded = await ensureLocalGameCover(game);
          if (coverDownloaded) updated = true;
        } catch {}
      }
    } else {
      // 1. Download cover to local disk ONLY if not yet assigned locally
      if (!isLocalCover(game.coverUrl) && !isLocalCover(game.customCoverUrl)) {
        try {
          const coverDownloaded = await ensureLocalGameCover(game);
          if (coverDownloaded) {
            updated = true;
          }
        } catch (err) {
          console.error(`Error ensuring cover for ${game.title}:`, err.message);
        }
      }

      // 2. Metadata enrichment (ScreenScraper as PRIMARY source)
      if (!game.description || game.description.startsWith('Um clássico atemporal')) {
        if (db.config.ssDevId && db.config.ssDevPassword) {
          try {
            const ssGame = await fetchScreenScraperGame(game);
            if (ssGame) {
              if (Array.isArray(ssGame.synopsis)) {
                const ptSyn = ssGame.synopsis.find(s => s.langue === 'pt' || s.langue === 'br');
                const enSyn = ssGame.synopsis.find(s => s.langue === 'en');
                const syn = ptSyn ? ptSyn.texte : (enSyn ? enSyn.texte : null);
                if (syn) game.description = syn;
              }
              if (ssGame.developpeur && ssGame.developpeur.nom) game.developer = ssGame.developpeur.nom;
              if (ssGame.editeur && ssGame.editeur.nom) game.publisher = ssGame.editeur.nom;
              if (ssGame.dates && Array.isArray(ssGame.dates) && ssGame.dates[0] && ssGame.dates[0].text) {
                const yr = parseInt(ssGame.dates[0].text.slice(0, 4), 10);
                if (yr > 1970 && yr < 2030) game.releaseYear = yr;
              }
              game.metadataEnriched = true;
              game.metadataSource = 'screenscraper';
              updated = true;
            }
          } catch {}
        }

        // Wikipedia fallback
        if (!game.metadataEnriched || !game.description || game.description.startsWith('Um clássico atemporal')) {
          try {
            const data = await fetchOnlineMetadata(game.title, game.consoleId);
            if (data) {
              if (data.description && (!game.description || game.description.startsWith('Um clássico atemporal'))) game.description = data.description;
              if (data.developer && !game.developer) game.developer = data.developer;
              if (data.publisher && !game.publisher) game.publisher = data.publisher;
              if (data.releaseYear && !game.releaseYear) game.releaseYear = data.releaseYear;
              game.metadataEnriched = true;
              if (!game.metadataSource) game.metadataSource = data.source;
              updated = true;
            }
          } catch {}
        }
      }
    }

    if (updated) {
      saveDb(db);
    }
  }
  setTimeout(processMetadataQueue, 1500);
}

function runFocusHelper(args) {
  const helperPath = path.join(APP_ROOT, 'FocusHelper.exe');
  if (fs.existsSync(helperPath)) {
    try {
      spawn(helperPath, args, { detached: true, stdio: 'ignore' }).unref();
    } catch {}
  }
}

function launchGame(gameId, discIndex = 0) {
  const game = db.games[gameId];
  if (!game) throw new Error('Jogo não encontrado');
  if (activeSession && activeSession.process) {
    try { activeSession.process.kill(); } catch {}
    activeSession = null;
  }

  // PC, STEAM, EPIC Handling
  if (['PC', 'STEAM', 'EPIC'].includes(game.consoleId)) {
    if (game.romPath && fs.existsSync(game.romPath) && game.romPath.toLowerCase().endsWith('.exe')) {
      const exePath = game.romPath;
      const cwd = path.dirname(exePath);
      const child = spawn(exePath, [], {
        cwd,
        detached: false,
        stdio: 'ignore',
        windowsHide: false
      });

      if (child.pid) {
        runFocusHelper(['focus-emu', String(child.pid)]);
      }

      const startedAt = Date.now();
      game.playCount = (game.playCount || 0) + 1;
      game.lastPlayedAt = new Date().toISOString();
      saveDb(db);

      activeSession = {
        gameId,
        title: game.title,
        consoleId: game.consoleId,
        pid: child.pid,
        startedAt,
        process: child
      };

      const interval = setInterval(() => {
        if (!activeSession || activeSession.gameId !== gameId) {
          clearInterval(interval);
          return;
        }
        const now = Date.now();
        const elapsedSec = Math.max(1, Math.round((now - activeSession.lastTick) / 1000));
        activeSession.lastTick = now;
        if (db.games[gameId]) {
          db.games[gameId].playTimeSeconds = (db.games[gameId].playTimeSeconds || 0) + elapsedSec;
          saveDb(db);
        }
      }, 5000);
      activeSession.lastTick = startedAt;

      child.on('error', (err) => {
        console.error('PC GAME SPAWN ERROR:', err);
      });

      child.on('exit', (code, signal) => {
        console.log(`PC GAME EXITED: code=${code}, signal=${signal}`);
        clearInterval(interval);
        if (activeSession && activeSession.gameId === gameId) {
          const now = Date.now();
          const remainingSec = Math.max(0, Math.round((now - activeSession.lastTick) / 1000));
          const totalSessionSec = Math.max(1, Math.round((now - startedAt) / 1000));
          if (db.games[gameId]) {
            db.games[gameId].playTimeSeconds = (db.games[gameId].playTimeSeconds || 0) + remainingSec;
            db.games[gameId].lastPlayedAt = new Date().toISOString();
          }
          db.sessions.unshift({
            id: crypto.randomUUID(),
            gameId,
            title: game.title,
            consoleId: game.consoleId,
            startedAt: new Date(startedAt).toISOString(),
            endedAt: new Date(now).toISOString(),
            durationSeconds: totalSessionSec
          });
          if (db.sessions.length > 100) db.sessions.length = 100;
          saveDb(db);
          activeSession = null;
        }
        runFocusHelper(['restore-ui']);
      });

      return { status: 'launched', pid: child.pid, gameId };
    } else {
      let child = null;
      const targetLaunch = game.launchUrl || game.romPath;

      if (game.consoleId === 'EPIC' && game.epicAppName) {
        const epicStatus = pcEngine.getEpicAccountStatus(DATA_DIR);
        const legendaryPath = pcEngine.getLegendaryPath(APP_ROOT);
        if (epicStatus.loggedIn && fs.existsSync(legendaryPath)) {
          const configDir = pcEngine.getEpicConfigDir(DATA_DIR);
          const env = { ...process.env, LEGENDARY_CONFIG_PATH: configDir };
          try {
            child = spawn(legendaryPath, ['launch', game.epicAppName], {
              env,
              detached: true,
              stdio: 'ignore'
            });
            child.unref();
          } catch (_) {
            child = null;
          }
        }
      }

      if (!child) {
        child = spawn('cmd.exe', ['/c', 'start', '', targetLaunch], {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();
      }

      game.playCount = (game.playCount || 0) + 1;
      game.lastPlayedAt = new Date().toISOString();
      saveDb(db);
      runFocusHelper(['focus-emu', '0']);
      return { status: 'launched', pid: child?.pid || 0, gameId };
    }
  }

  const cCfg = db.config.consoles[game.consoleId];
  if (!cCfg) throw new Error('Console não configurado');
  let emuPath = cCfg.emulatorPath;
  if (!fs.existsSync(emuPath)) {
    if (game.consoleId === 'SWITCH') {
      const ava = path.join(path.dirname(emuPath), 'Ryujinx.Ava.exe');
      if (fs.existsSync(ava)) {
        emuPath = ava;
      } else {
        throw new Error(`Emulador Ryujinx não encontrado em: ${emuPath}`);
      }
    } else {
      throw new Error(`Emulador não encontrado em: ${emuPath}`);
    }
  }

  const targetDisc = (game.discs && game.discs[discIndex]) ? game.discs[discIndex] : { path: game.romPath };
  if (!fs.existsSync(targetDisc.path)) {
    throw new Error(`ROM não encontrada em: ${targetDisc.path}`);
  }

  let args = [];
  if (game.consoleId === 'PS1') {
    args = ['-batch', '-fullscreen', '--', targetDisc.path];
  } else if (game.consoleId === 'PS2') {
    args = ['-batch', '-fullscreen', '-nogui', '--', targetDisc.path];
  } else if (game.consoleId === 'WII' || game.consoleId === 'GC') {
    args = ['-b', '-e', targetDisc.path];
  } else if (game.consoleId === 'PSP') {
    args = ['--fullscreen', targetDisc.path];
  } else if (game.consoleId === 'PS3') {
    args = ['--no-gui', targetDisc.path];
  } else if (game.consoleId === 'SWITCH') {
    args = ['--fullscreen', targetDisc.path];
  } else if (cCfg.corePath) {
    args = ['-f', '-L', cCfg.corePath, targetDisc.path];
  } else {
    args = [targetDisc.path];
  }

  const cwd = path.dirname(emuPath);
  const child = spawn(emuPath, args, {
    cwd,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: false
  });

  // Real-time emulator achievement unlock parser (ported from Hydra Original emulator-achievement-log.ts)
  const handleEmulatorLogChunk = (chunk) => {
    try {
      const lines = chunk.toString().split(/\r?\n/);
      for (const line of lines) {
        const parsed = achEngine.parseEmulatorAchievementLogLine(game.consoleId, line);
        if (parsed && db.games[gameId]) {
          const g = db.games[gameId];
          if (!Array.isArray(g.raAchievements)) g.raAchievements = [];
          const existing = g.raAchievements.find(
            a => String(a.id) === parsed.id || String(a.name) === parsed.id || (a.title && a.title.toLowerCase() === parsed.title.toLowerCase())
          );
          if (existing) {
            if (!existing.unlocked) {
              existing.unlocked = true;
              existing.unlockTime = Date.now();
              if (existing.iconUnlocked) existing.icon = existing.iconUnlocked;
              saveDb(db);
            }
          } else {
            g.raAchievements.unshift({
              id: parsed.id,
              name: parsed.id,
              title: parsed.title,
              description: 'Desbloqueada em tempo real durante a partida!',
              points: 10,
              unlocked: true,
              unlockTime: Date.now(),
              icon: null,
              source: 'emulator_realtime_log'
            });
            saveDb(db);
          }
        }
      }
    } catch {}
  };
  if (child.stdout) child.stdout.on('data', handleEmulatorLogChunk);
  if (child.stderr) child.stderr.on('data', handleEmulatorLogChunk);

  if (child.pid) {
    runFocusHelper(['focus-emu', String(child.pid)]);
  }

  const startedAt = Date.now();
  game.playCount = (game.playCount || 0) + 1;
  game.lastPlayedAt = new Date().toISOString();
  saveDb(db);

  activeSession = {
    gameId,
    title: game.title,
    consoleId: game.consoleId,
    pid: child.pid,
    startedAt,
    process: child
  };

  // Live playtime ticker every 5 seconds while game is running
  const interval = setInterval(() => {
    if (!activeSession || activeSession.gameId !== gameId) {
      clearInterval(interval);
      return;
    }
    const now = Date.now();
    const elapsedSec = Math.max(1, Math.round((now - activeSession.lastTick) / 1000));
    activeSession.lastTick = now;
    if (db.games[gameId]) {
      db.games[gameId].playTimeSeconds = (db.games[gameId].playTimeSeconds || 0) + elapsedSec;
      saveDb(db);
    }
  }, 5000);
  activeSession.lastTick = startedAt;

  child.on('error', (err) => {
    console.error('EMULATOR SPAWN ERROR:', err);
  });

  child.on('exit', (code, signal) => {
    console.log(`EMULATOR EXITED: code=${code}, signal=${signal}`);
    clearInterval(interval);
    if (activeSession && activeSession.gameId === gameId) {
      const now = Date.now();
      const remainingSec = Math.max(0, Math.round((now - activeSession.lastTick) / 1000));
      const totalSessionSec = Math.max(1, Math.round((now - startedAt) / 1000));
      if (db.games[gameId]) {
        db.games[gameId].playTimeSeconds = (db.games[gameId].playTimeSeconds || 0) + remainingSec;
        db.games[gameId].lastPlayedAt = new Date().toISOString();
      }
      db.sessions.unshift({
        id: crypto.randomUUID(),
        gameId,
        title: game.title,
        consoleId: game.consoleId,
        startedAt: new Date(startedAt).toISOString(),
        endedAt: new Date(now).toISOString(),
        durationSeconds: totalSessionSec
      });
      if (db.sessions.length > 100) db.sessions.length = 100;
      saveDb(db);
      activeSession = null;
    }
    runFocusHelper(['restore-ui']);
  });

  return { status: 'launched', pid: child.pid, gameId };
}

// ROM watchers & initial scan moved to server.listen for instant startup

function getSaveDirectories() {
  const dirs = [];
  
  // 1. RetroArch (Genesis, SNES, Arcade, N64, GBA, GBC, GB)
  const raSaves = path.join(APP_ROOT, 'emulators', 'retroarch', 'saves');
  const raStates = path.join(APP_ROOT, 'emulators', 'retroarch', 'states');
  if (fs.existsSync(raSaves)) dirs.push({ name: 'RetroArch_Saves', path: raSaves });
  if (fs.existsSync(raStates)) dirs.push({ name: 'RetroArch_States', path: raStates });

  // 2. DuckStation (PS1)
  const duckMem = path.join(APP_ROOT, 'emulators', 'duckstation', 'memcards');
  const duckStates = path.join(APP_ROOT, 'emulators', 'duckstation', 'savestates');
  if (fs.existsSync(duckMem)) dirs.push({ name: 'DuckStation_Memcards', path: duckMem });
  if (fs.existsSync(duckStates)) dirs.push({ name: 'DuckStation_States', path: duckStates });

  // 3. PCSX2 (PS2)
  const pcsx2Mem = path.join(APP_ROOT, 'emulators', 'pcsx2', 'memcards');
  const pcsx2States = path.join(APP_ROOT, 'emulators', 'pcsx2', 'sstates');
  if (fs.existsSync(pcsx2Mem)) dirs.push({ name: 'PCSX2_Memcards', path: pcsx2Mem });
  if (fs.existsSync(pcsx2States)) dirs.push({ name: 'PCSX2_States', path: pcsx2States });

  // 4. Dolphin (Wii & GC)
  const dolGc = path.join(APP_ROOT, 'emulators', 'dolphin', 'User', 'GC');
  const dolWii = path.join(APP_ROOT, 'emulators', 'dolphin', 'User', 'Wii');
  const dolStates = path.join(APP_ROOT, 'emulators', 'dolphin', 'User', 'StateSaves');
  if (fs.existsSync(dolGc)) dirs.push({ name: 'Dolphin_GC', path: dolGc });
  if (fs.existsSync(dolWii)) dirs.push({ name: 'Dolphin_Wii', path: dolWii });
  if (fs.existsSync(dolStates)) dirs.push({ name: 'Dolphin_States', path: dolStates });

  // 5. PPSSPP (PSP)
  const pspSave = path.join(APP_ROOT, 'emulators', 'ppsspp', 'memstick', 'PSP', 'SAVEDATA');
  const pspStates = path.join(APP_ROOT, 'emulators', 'ppsspp', 'memstick', 'PSP', 'PPSSPP_STATE');
  if (fs.existsSync(pspSave)) dirs.push({ name: 'PPSSPP_Savedata', path: pspSave });
  if (fs.existsSync(pspStates)) dirs.push({ name: 'PPSSPP_States', path: pspStates });

  // 6. RPCS3 (PS3)
  const rpcs3Save = path.join(APP_ROOT, 'emulators', 'rpcs3', 'dev_hdd0', 'home', '00000001', 'savedata');
  if (fs.existsSync(rpcs3Save)) dirs.push({ name: 'RPCS3_Savedata', path: rpcs3Save });

  return dirs;
}

function exportSavesToZip() {
  return new Promise((resolve, reject) => {
    const saveDirs = getSaveDirectories();
    const existingPaths = saveDirs.filter(d => fs.existsSync(d.path)).map(d => d.path);
    
    if (fs.existsSync(DB_FILE)) existingPaths.push(DB_FILE);

    if (existingPaths.length === 0) {
      return reject(new Error('Nenhuma pasta de saves encontrada para exportar'));
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timeStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    const zipName = `HydraRetro_Saves_Backup_${timeStr}.zip`;
    const zipPath = path.join(BACKUPS_DIR, zipName);

    const quotedPaths = existingPaths.map(p => `'${p.replace(/'/g, "''")}'`).join(', ');
    const psCmd = `$paths = @(${quotedPaths}); Compress-Archive -Path $paths -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`;

    const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCmd]);
    let errOutput = '';
    ps.stderr.on('data', d => errOutput += d.toString());
    ps.on('close', (code) => {
      if (code === 0 && fs.existsSync(zipPath)) {
        const stat = fs.statSync(zipPath);
        resolve({
          fileName: zipName,
          filePath: zipPath,
          sizeBytes: stat.size,
          createdDate: now.toISOString()
        });
      } else {
        reject(new Error(errOutput || `Falha ao compactar saves (código ${code})`));
      }
    });
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, 'http://127.0.0.1:38475');
  const pathname = urlObj.pathname;

  if (pathname !== '/api/window-closed' && pathname !== '/api/quit' && shutdownTimer) {
    clearTimeout(shutdownTimer);
    shutdownTimer = null;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // API Routes
  if (pathname === '/api/state' && req.method === 'GET') {
    const gamesList = Object.values(db.games).map(g => ({
      id: g.id,
      consoleId: g.consoleId,
      title: g.title,
      sortTitle: g.sortTitle || g.title,
      romPath: g.romPath,
      fileName: g.fileName,
      installed: g.installed !== false,
      sizeBytes: g.sizeBytes,
      coverUrl: g.coverUrl,
      heroUrl: g.heroUrl,
      logoUrl: g.logoUrl,
      fallbackCoverUrl: g.fallbackCoverUrl,
      fallbackLogoUrl: g.fallbackLogoUrl,
      videoUrl: g.videoUrl,
      hydraObjectId: g.hydraObjectId,
      steamAppId: g.steamAppId,
      favorite: Boolean(g.favorite),
      playTimeSeconds: g.playTimeSeconds || 0,
      playCount: g.playCount || 0,
      lastPlayedAt: g.lastPlayedAt,
      addedAt: g.addedAt,
      description: g.description,
      developer: g.developer,
      publisher: g.publisher,
      releaseYear: g.releaseYear,
      genres: g.genres,
      players: g.players,
      rating: g.rating,
      discs: g.discs,
      isManualPcGame: g.isManualPcGame,
      metadataEnriched: g.metadataEnriched,
      coverCandidates: (g.coverCandidates || []).slice(0, 3),
      heroCandidates: (g.heroCandidates || []).slice(0, 2),
      logoCandidates: (g.logoCandidates || []).slice(0, 2),
      achievements: getGameAchievements(g)
    }));
    const totalPlayTimeSeconds = gamesList.reduce((acc, g) => acc + (g.playTimeSeconds || 0), 0);
    const activeDlCount = (downloadsEngine.downloads || []).filter(
      d => d.status === 'downloading' || d.status === 'checking' || d.status === 'extracting'
    ).length;

    return sendJson(res, 200, {
      isScanning: isLibraryScanning,
      scanProgress,
      config: db.config,
      games: gamesList,
      sessions: db.sessions.slice(0, 30),
      downloads: downloadsEngine.downloads,
      downloadSources: downloadsEngine.getDownloadSources(),
      activeDownloadsCount: activeDlCount,
      isTorrentEngineReady: Boolean(downloadsEngine.nativeAddon),
      activeSession: activeSession ? {
        gameId: activeSession.gameId,
        title: activeSession.title,
        consoleId: activeSession.consoleId,
        startedAt: activeSession.startedAt,
        elapsedSeconds: Math.round((Date.now() - activeSession.startedAt) / 1000)
      } : null,
      stats: {
        totalGames: gamesList.length,
        totalPlayTimeSeconds,
        favoritesCount: gamesList.filter(g => g.favorite).length,
        playedCount: gamesList.filter(g => (g.playCount || 0) > 0).length,
        installedCount: gamesList.filter(g => g.installed !== false).length,
        uninstalledCount: gamesList.filter(g => g.installed === false).length,
        downloadsCount: (downloadsEngine.downloads || []).length
      }
    });
  }

  if (pathname === '/api/scan' && req.method === 'POST') {
    const body = await readBody(req);
    const consoleId = body && body.consoleId ? String(body.consoleId) : null;
    const result = await scanLibrary(consoleId);
    return sendJson(res, 200, result);
  }

  // Unified All-In-One Scan (ROMs + PC Games + Steam + Epic + GOG + Xbox Game Pass)
  if (pathname === '/api/scan/all' && req.method === 'POST') {
    try {
      // 1. Scan ROMs for all console folders
      const romResult = scanLibrary();

      // 2. Scan PC Games
      let pcAdded = 0;
      if (typeof pcEngine !== 'undefined' && pcEngine) {
        try {
          const pcRes = await pcEngine.scanAllPcGames();
          pcAdded = pcRes.newlyAdded || 0;
          await pcEngine.syncLocalSteamGames();
          await pcEngine.syncLocalEpicGames();
        } catch {}
      }

      // 3. Scan GOG & Xbox Game Pass across all drives
      let storesDiscovered = 0;
      let storesAdded = 0;
      if (downloadsEngine) {
        try {
          const discovered = await downloadsEngine.scanGogAndXboxGames();
          storesDiscovered = discovered.length;
          for (const item of discovered) {
            const groupId = `${item.store}::${item.id}`;
            let localCoverUrl = null;
            let localHeroUrl = null;

            if (item.coverPath && fs.existsSync(item.coverPath)) {
              try {
                const coversDir = path.join(APP_ROOT, 'covers');
                if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
                const ext = path.extname(item.coverPath) || '.png';
                const destName = `cover_${groupId.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;
                const destPath = path.join(coversDir, destName);
                fs.copyFileSync(item.coverPath, destPath);
                localCoverUrl = `/covers/${destName}`;
              } catch {}
            }

            if (item.heroPath && fs.existsSync(item.heroPath)) {
              try {
                const coversDir = path.join(APP_ROOT, 'covers');
                if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
                const ext = path.extname(item.heroPath) || '.png';
                const destName = `hero_${groupId.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;
                const destPath = path.join(coversDir, destName);
                fs.copyFileSync(item.heroPath, destPath);
                localHeroUrl = `/covers/${destName}`;
              } catch {}
            }

            if (!db.games[groupId]) {
              db.games[groupId] = {
                id: groupId,
                consoleId: item.store,
                title: item.title,
                sortTitle: item.title.replace(/^The\s+/i, ''),
                romPath: item.exePath,
                fileName: path.basename(item.exePath),
                sizeBytes: 0,
                installed: true,
                coverUrl: localCoverUrl,
                coverCandidates: localCoverUrl ? [localCoverUrl] : [],
                heroUrl: localHeroUrl,
                logoUrl: null,
                developer: item.store === 'XBOX' ? 'Xbox Game Studios' : item.store,
                publisher: item.store === 'XBOX' ? 'Microsoft Xbox' : item.store,
                releaseYear: 2024,
                genres: [item.store === 'XBOX' ? 'Xbox Game Pass' : item.store, 'PC Games'],
                rating: 4.8,
                description: `Título instalado da loja ${item.store} (${item.title}).`,
                players: '1 Jogador',
                favorite: false,
                playTimeSeconds: 0,
                playCount: 0,
                lastPlayedAt: null,
                addedAt: new Date().toISOString(),
                metadataEnriched: Boolean(localCoverUrl)
              };
              storesAdded++;
            } else {
              if (localCoverUrl && !db.games[groupId].coverUrl) db.games[groupId].coverUrl = localCoverUrl;
              if (localHeroUrl && !db.games[groupId].heroUrl) db.games[groupId].heroUrl = localHeroUrl;
              db.games[groupId].romPath = item.exePath;
              db.games[groupId].installed = true;
            }
          }
        } catch {}
      }

      saveDb(db);
      const totalGames = Object.keys(db.games).length;
      return sendJson(res, 200, {
        ok: true,
        totalGames,
        newGamesCount: (romResult.newGamesCount || 0) + pcAdded + storesAdded,
        romsCount: romResult.totalGames,
        storesDiscovered
      });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  if (pathname === '/api/launch' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const result = launchGame(body.gameId, body.discIndex || 0);
      return sendJson(res, 200, result);
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/stop' && req.method === 'POST') {
    if (activeSession && activeSession.process) {
      try { activeSession.process.kill(); } catch {}
      activeSession = null;
    }
    return sendJson(res, 200, { status: 'stopped' });
  }

  if (pathname === '/api/favorite' && req.method === 'POST') {
    const body = await readBody(req);
    const g = db.games[body.gameId];
    if (!g) return sendJson(res, 404, { error: 'Not found' });
    g.favorite = !g.favorite;
    saveDb(db);
    return sendJson(res, 200, { favorite: g.favorite, achievements: getGameAchievements(g) });
  }

  if (pathname === '/api/steamgrid/sync' && req.method === 'POST') {
    const body = await readBody(req);
    const key = (body.apiKey || db.config.steamGridDbApiKey || '').trim();

    if (body.gameId) {
      const g = db.games[body.gameId];
      if (!g) return sendJson(res, 404, { error: 'Jogo não encontrado' });

      let sgRes = null;
      if (key) {
        sgRes = await fetchSteamGridDb(cleanTitle(g.title), key);
      }

      // Fallback or primary via Hydra Official API (no API key needed)
      if (!sgRes) {
        const hydraRes = await fetchHydraGameByRomHashOrTitle(g);
        if (hydraRes && (hydraRes.coverUrl || hydraRes.heroUrl || hydraRes.logoUrl)) {
          sgRes = {
            coverUrl: hydraRes.coverUrl,
            heroUrl: hydraRes.heroUrl,
            logoUrl: hydraRes.logoUrl
          };
          if (hydraRes.objectId && hydraRes.shop === 'launchbox') g.hydraObjectId = hydraRes.objectId;
        }
      }

      if (!sgRes) {
        return sendJson(res, 404, { error: `Nenhuma arte HD encontrada para "${g.title}"` });
      }

      if (sgRes.coverUrl) {
        try {
          const consoleSub = g.consoleId.toLowerCase();
          const destFolder = path.join(COVERS_DIR, consoleSub);
          fs.mkdirSync(destFolder, { recursive: true });
          const safeTitle = cleanTitle(g.title).replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
          const ext = sgRes.coverUrl.toLowerCase().includes('.webp') ? '.webp' : (sgRes.coverUrl.toLowerCase().includes('.png') ? '.png' : '.jpg');
          const fileName = `${safeTitle}_hd${ext}`;
          const destPath = path.join(destFolder, fileName);
          await downloadImage(sgRes.coverUrl, destPath);
          g.coverUrl = `/media/covers/${consoleSub}/${fileName}`;
          g.customCoverUrl = g.coverUrl;
        } catch {
          g.coverUrl = sgRes.coverUrl;
        }
      }
      if (sgRes.heroUrl) g.heroUrl = sgRes.heroUrl;
      if (sgRes.logoUrl) g.logoUrl = sgRes.logoUrl;
      g.steamGridData = sgRes;
      saveDb(db);
      return sendJson(res, 200, { ok: true, game: g });
    } else {
      if (!key) {
        return sendJson(res, 400, { error: 'Chave da API SteamGridDB não configurada. Adicione sua API Key nas Configurações!' });
      }
      let updatedCount = 0;
      for (const g of Object.values(db.games)) {
        const sgRes = await fetchSteamGridDb(cleanTitle(g.title), key);
        if (sgRes) {
          if (sgRes.coverUrl) g.coverUrl = sgRes.coverUrl;
          if (sgRes.heroUrl) g.heroUrl = sgRes.heroUrl;
          if (sgRes.logoUrl) g.logoUrl = sgRes.logoUrl;
          g.steamGridData = sgRes;
          updatedCount++;
        }
      }
      saveDb(db);
      return sendJson(res, 200, { ok: true, updatedCount });
    }
  }

  if (pathname === '/api/covers/auto-resolve' && req.method === 'POST') {
    const body = await readBody(req);
    const game = body.gameId ? db.games[body.gameId] : null;
    if (!game) {
      return sendJson(res, 404, { error: 'Jogo não encontrado' });
    }
    try {
      const ok = await ensureLocalGameCover(game);
      if (ok) {
        saveDb(db);
        return sendJson(res, 200, {
          ok: true,
          coverUrl: game.coverUrl,
          heroUrl: game.heroUrl,
          logoUrl: game.logoUrl
        });
      }
      return sendJson(res, 200, { ok: false, coverUrl: game.coverUrl });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  if (pathname === '/api/hltb' && req.method === 'POST') {
    const body = await readBody(req);
    const game = body.gameId ? db.games[body.gameId] : null;
    const title = body.title || (game ? game.title : '');

    if (game && game.hltbData && !body.forceRefresh) {
      return sendJson(res, 200, { ok: true, data: game.hltbData, cached: true });
    }

    if (!title) {
      return sendJson(res, 400, { error: 'Título do jogo não fornecido' });
    }

    const hltb = await searchHowLongToBeat(title, game);
    if (!hltb) {
      return sendJson(res, 404, { error: 'Jogo não encontrado no HowLongToBeat' });
    }

    if (game) {
      game.hltbData = hltb;
      saveDb(db);
    }
    return sendJson(res, 200, { ok: true, data: hltb });
  }

  if (pathname === '/api/metadata/enrich' && req.method === 'POST') {
    const body = await readBody(req);
    const game = body.gameId ? db.games[body.gameId] : null;
    if (!game) {
      return sendJson(res, 404, { error: 'Jogo não encontrado' });
    }

    if (game.metadataEnriched && !body.forceRefresh) {
      if (!game.raAchievements || game.raAchievements.length === 0) {
        try {
          await achEngine.syncGameAchievements(game, db.config, fetchHydraGameByRomHashOrTitle);
          saveDb(db);
        } catch {}
      }
      return sendJson(res, 200, { ok: true, game: { ...game, achievements: getGameAchievements(game) }, cached: true });
    }

    // 1. Hydra Official API (LaunchBox CRC32/Title & Steam Store)
    try {
      const hydraData = await fetchHydraGameByRomHashOrTitle(game);
      if (hydraData) {
        if (hydraData.objectId && hydraData.shop === 'launchbox') game.hydraObjectId = hydraData.objectId;
        if (hydraData.steamAppId && !game.steamAppId) game.steamAppId = hydraData.steamAppId;
        if (hydraData.description) game.description = hydraData.description;
        if (hydraData.developer) game.developer = hydraData.developer;
        if (hydraData.publisher) game.publisher = hydraData.publisher;
        if (hydraData.releaseYear) game.releaseYear = hydraData.releaseYear;
        if (Array.isArray(hydraData.genres) && hydraData.genres.length > 0) game.genres = hydraData.genres;
        if (hydraData.heroUrl && (!game.heroUrl || game.heroUrl.includes('thumbnails.libretro.com'))) game.heroUrl = hydraData.heroUrl;
        if (hydraData.logoUrl && (!game.logoUrl || game.logoUrl.includes('thumbnails.libretro.com'))) game.logoUrl = hydraData.logoUrl;
        if (hydraData.description) {
          game.metadataEnriched = true;
          game.metadataSource = hydraData.source;
        }
      }
    } catch {}

    // 2. ScreenScraper metadata enrichment
    if (!game.metadataEnriched && db.config.ssDevId && db.config.ssDevPassword) {
      try {
        const ssGame = await fetchScreenScraperGame(game);
        if (ssGame) {
          if (Array.isArray(ssGame.synopsis)) {
            const ptSyn = ssGame.synopsis.find(s => s.langue === 'pt' || s.langue === 'br');
            const enSyn = ssGame.synopsis.find(s => s.langue === 'en');
            const syn = ptSyn ? ptSyn.texte : (enSyn ? enSyn.texte : null);
            if (syn) game.description = syn;
          }
          if (ssGame.developpeur && ssGame.developpeur.nom) game.developer = ssGame.developpeur.nom;
          if (ssGame.editeur && ssGame.editeur.nom) game.publisher = ssGame.editeur.nom;
          if (ssGame.dates && Array.isArray(ssGame.dates) && ssGame.dates[0] && ssGame.dates[0].text) {
            const yr = parseInt(ssGame.dates[0].text.slice(0, 4), 10);
            if (yr > 1970 && yr < 2030) game.releaseYear = yr;
          }
          game.metadataEnriched = true;
          game.metadataSource = 'screenscraper';
        }
      } catch {}
    }

    // 3. Ensure local cover if still missing
    if (!isLocalCover(game.coverUrl) && !isLocalCover(game.customCoverUrl)) {
      try {
        await ensureLocalGameCover(game);
      } catch {}
    }

    // 4. Sync official Hydra & RetroAchievements / PC local achievements
    if (!game.raAchievements || game.raAchievements.length === 0 || body.forceRefresh) {
      try {
        await achEngine.syncGameAchievements(game, db.config, fetchHydraGameByRomHashOrTitle);
      } catch {}
    }

    if (game.metadataEnriched) {
      saveDb(db);
      return sendJson(res, 200, { ok: true, game: { ...game, achievements: getGameAchievements(game) }, enriched: true });
    }

    const onlineData = await fetchOnlineMetadata(game.title, game.consoleId);
    if (onlineData) {
      if (!game.description && onlineData.description) game.description = onlineData.description;
      if (!game.developer && onlineData.developer) game.developer = onlineData.developer;
      if (!game.publisher && onlineData.publisher) game.publisher = onlineData.publisher;
      if (!game.releaseYear && onlineData.releaseYear) game.releaseYear = onlineData.releaseYear;
      game.metadataEnriched = true;
      if (!game.metadataSource) game.metadataSource = onlineData.source;
      saveDb(db);
      return sendJson(res, 200, { ok: true, game: { ...game, achievements: getGameAchievements(game) }, enriched: true });
    }

    saveDb(db);
    return sendJson(res, 200, { ok: false, game: { ...game, achievements: getGameAchievements(game) }, message: 'Nenhum metadado adicional encontrado' });
  }

  if (pathname === '/api/metadata/sync-all' && req.method === 'POST') {
    enqueueGamesForEnrichment();
    return sendJson(res, 200, {
      ok: true,
      queuedCount: metadataQueue.length,
      message: `Sincronização em segundo plano iniciada para ${metadataQueue.length} jogos pendentes!`
    });
  }

  if (pathname === '/api/config' && req.method === 'POST') {
    const body = await readBody(req);
    if (body.raUsername !== undefined) db.config.raUsername = body.raUsername;
    if (body.raWebApiKey !== undefined) db.config.raWebApiKey = body.raWebApiKey;
    if (body.steamGridDbApiKey !== undefined) db.config.steamGridDbApiKey = body.steamGridDbApiKey.trim();
    if (body.theGamesDbApiKey !== undefined) db.config.theGamesDbApiKey = body.theGamesDbApiKey.trim();
    if (body.ssUsername !== undefined) db.config.ssUsername = body.ssUsername.trim();
    if (body.ssPassword !== undefined) db.config.ssPassword = body.ssPassword;
    if (body.ssDevId !== undefined) db.config.ssDevId = body.ssDevId.trim();
    if (body.ssDevPassword !== undefined) db.config.ssDevPassword = body.ssDevPassword;
    if (body.steamWebApiKey !== undefined) db.config.steamWebApiKey = body.steamWebApiKey.trim();
    if (body.steamId64 !== undefined) db.config.steamId64 = body.steamId64.trim();
    if (Array.isArray(body.pcGameFolders)) db.config.pcGameFolders = body.pcGameFolders;
    if (body.includeUninstalledSteam !== undefined) db.config.includeUninstalledSteam = Boolean(body.includeUninstalledSteam);
    if (body.includeUninstalledEpic !== undefined) db.config.includeUninstalledEpic = Boolean(body.includeUninstalledEpic);
    if (body.consoles) {
      for (const [k, v] of Object.entries(body.consoles)) {
        if (db.config.consoles[k]) {
          db.config.consoles[k] = { ...db.config.consoles[k], ...v };
        } else {
          db.config.consoles[k] = v;
        }
      }
    }
    saveDb(db);
    const scanRes = scanLibrary();
    return sendJson(res, 200, { config: db.config, scan: scanRes });
  }

  if (pathname === '/api/proxy-image') {
    let targetUrl = urlObj.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400);
      return res.end('Missing url parameter');
    }

    if (targetUrl.includes('screenscraper.fr')) {
      const auth = getScreenScraperAuthParams();
      if (auth && !targetUrl.includes('devid=')) {
        targetUrl += (targetUrl.includes('?') ? '&' : '?') + auth;
      }
    }

    try {
      const client = targetUrl.startsWith('https') ? https : http;
      const preq = client.get(targetUrl, { headers: { 'User-Agent': 'HydraRetro/1.0' } }, (pres) => {
        if (pres.statusCode >= 300 && pres.statusCode < 400 && pres.headers.location) {
          let redirectUrl = pres.headers.location;
          if (redirectUrl.includes('screenscraper.fr')) {
            const auth = getScreenScraperAuthParams();
            if (auth && !redirectUrl.includes('devid=')) {
              redirectUrl += (redirectUrl.includes('?') ? '&' : '?') + auth;
            }
          }
          const client2 = redirectUrl.startsWith('https') ? https : http;
          client2.get(redirectUrl, { headers: { 'User-Agent': 'HydraRetro/1.0' } }, (rres) => {
            res.writeHead(rres.statusCode, {
              'Content-Type': rres.headers['content-type'] || 'image/png',
              'Cache-Control': 'public, max-age=86400'
            });
            rres.pipe(res);
          }).on('error', () => {
            if (!res.headersSent) res.writeHead(502);
            res.end();
          });
          return;
        }

        res.writeHead(pres.statusCode, {
          'Content-Type': pres.headers['content-type'] || 'image/png',
          'Cache-Control': 'public, max-age=86400'
        });
        pres.pipe(res);
      });

      preq.on('error', () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      preq.setTimeout(10000, () => {
        preq.destroy();
        if (!res.headersSent) res.writeHead(504);
        res.end();
      });
    } catch {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
    return;
  }

  if (pathname === '/api/covers/list' && req.method === 'GET') {
    const gameId = urlObj.searchParams.get('gameId');
    const game = gameId ? db.games[gameId] : null;
    if (!game) {
      return sendJson(res, 404, { error: 'Jogo não encontrado' });
    }

    const requestedSource = (urlObj.searchParams.get('source') || 'all').toLowerCase();
    const covers = [];
    const seenUrls = new Set();
    const cCfg = db.config.consoles[game.consoleId] || {};
    const primary = (game.discs && game.discs[0]) ? game.discs[0] : { path: game.romPath, fileName: game.fileName };
    const primaryBase = path.basename(primary.fileName, path.extname(primary.fileName));
    const cleanT = cleanTitle(game.title);
    const querySearch = (urlObj.searchParams.get('q') || cleanT).trim();

    const checkAll = requestedSource === 'all';
    const checkHydra = checkAll || requestedSource === 'hydra';
    const checkSS = checkAll || requestedSource === 'screenscraper';
    const checkSG = checkAll || requestedSource === 'steamgriddb';
    const checkTGDB = checkAll || requestedSource === 'thegamesdb';
    const checkLibretro = checkAll || requestedSource === 'libretro';
    const checkLocal = checkAll || requestedSource === 'local';

    // 1. Current Active Cover (shown in "all" if valid)
    if (game.coverUrl && checkAll) {
      const isValidActive = isLocalCover(game.coverUrl) || await verifyRemoteImageUrl(game.coverUrl, 2000);
      if (isValidActive) {
        covers.push({
          id: 'current_active',
          type: 'current',
          label: 'Capa Ativa Atual',
          url: game.coverUrl,
          thumbUrl: game.thumbUrl || game.coverUrl,
          active: true
        });
        seenUrls.add(game.coverUrl);
      }
    }

    // 2. Local covers in covers/ and media/covers/<consoleId>/ (FONTE PRIMÁRIA OFFLINE)
    if (checkLocal) {
      const checkCoverDirs = [
        { dir: path.join(COVERS_DIR, game.consoleId.toLowerCase()), prefix: `/media/covers/${game.consoleId.toLowerCase()}` },
        { dir: path.join(APP_ROOT, 'covers', game.consoleId.toLowerCase()), prefix: `/covers/${game.consoleId.toLowerCase()}` },
        { dir: path.join(APP_ROOT, 'covers'), prefix: '/covers' },
        { dir: COVERS_DIR, prefix: '/media/covers' }
      ];

      const normClean = cleanT.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normBase = primaryBase.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normQuery = querySearch.toLowerCase().replace(/[^a-z0-9]/g, '');

      for (const { dir, prefix } of checkCoverDirs) {
        if (!fs.existsSync(dir)) continue;
        try {
          const coverFiles = fs.readdirSync(dir);
          for (const cf of coverFiles) {
            const ext = path.extname(cf).toLowerCase();
            if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) continue;
            const cfBase = path.basename(cf, ext).toLowerCase().replace(/[^a-z0-9]/g, '');

            const matches = (normQuery && cfBase.includes(normQuery)) ||
                            cfBase.includes(normClean) ||
                            cfBase.includes(normBase) ||
                            (normClean.length >= 4 && normClean.includes(cfBase)) ||
                            (normBase.length >= 4 && normBase.includes(cfBase));

            if (matches) {
              const relUrl = `${prefix}/${encodeURIComponent(cf)}`;
              if (!seenUrls.has(relUrl)) {
                seenUrls.add(relUrl);
                covers.push({
                  id: `local_cover_${cf}`,
                  type: 'local_media',
                  label: `Local (covers/): ${cf}`,
                  url: relUrl,
                  thumbUrl: relUrl,
                  isLocal: true
                });
              }
            }
          }
        } catch {}
      }

      const romLocal = findLocalArtwork(cCfg.romFolder, primaryBase, cleanT, game.consoleId);
      if (romLocal && !seenUrls.has(romLocal)) {
        seenUrls.add(romLocal);
        covers.push({
          id: 'rom_folder_cover',
          type: 'local_rom',
          label: 'Local (Pasta de ROMs)',
          url: romLocal,
          thumbUrl: romLocal,
          isLocal: true
        });
      }
    }

    // 3. Hydra Launcher Official API (LaunchBox & Steam CDN — Zero API Key Needed)
    if (checkHydra) {
      try {
        const customQ = urlObj.searchParams.get('q') ? querySearch : null;
        const hydraCovers = await fetchHydraCoversForModal(game, customQ);
        for (const hc of hydraCovers) {
          if (!seenUrls.has(hc.url)) {
            seenUrls.add(hc.url);
            covers.push(hc);
          }
        }
      } catch (err) {
        console.error('Hydra covers query error:', err.message);
      }
    }

    // 4. ScreenScraper Covers
    if (checkSS && db.config.ssDevId && db.config.ssDevPassword) {
      try {
        const ssCovers = await fetchScreenScraperCovers(game, querySearch);
        for (const ssc of ssCovers) {
          if (!seenUrls.has(ssc.url) && !seenUrls.has(ssc.rawUrl)) {
            seenUrls.add(ssc.url);
            if (ssc.rawUrl) seenUrls.add(ssc.rawUrl);
            covers.push(ssc);
          }
        }
      } catch (err) {
        console.error('ScreenScraper covers query error:', err.message);
      }
    }

    // 5. SteamGridDB HD alternatives
    const sgKey = db.config.steamGridDbApiKey;
    if (checkSG && sgKey) {
      try {
        const sgGrids = await fetchSteamGridDbGrids(querySearch, sgKey);
        for (const grid of sgGrids) {
          if (!seenUrls.has(grid.url)) {
            seenUrls.add(grid.url);
            covers.push(grid);
          }
        }
      } catch (err) {
        console.error('SteamGridDB query error:', err.message);
      }
    }

    // 6. TheGamesDB covers
    const tgdbKey = db.config.theGamesDbApiKey;
    if (checkTGDB && tgdbKey) {
      try {
        const tgdbCovers = await fetchTheGamesDbCovers(querySearch, game.consoleId, tgdbKey);
        for (const tgc of tgdbCovers) {
          if (!seenUrls.has(tgc.url)) {
            seenUrls.add(tgc.url);
            covers.push(tgc);
          }
        }
      } catch (err) {
        console.error('TheGamesDB query error:', err.message);
      }
    }

    // 7. Libretro Boxart Candidates (verified via HEAD request so 404 links never appear!)
    if (checkLibretro && cCfg.libretroThumbRepo) {
      const innerBase = (primary.path && primary.path.toLowerCase().endsWith('.zip')) ? getZipFirstEntry(primary.path) : null;
      const libretroCandidates = getArtworkCandidates(primaryBase, innerBase, querySearch).slice(0, 16);
      const checks = await Promise.all(
        libretroCandidates.map(async (candBase, idx) => {
          const candUrl = libretroUrl(cCfg.libretroThumbRepo, 'Named_Boxarts', candBase);
          if (!candUrl || seenUrls.has(candUrl)) return null;
          const exists = await verifyRemoteImageUrl(candUrl, 2200);
          if (!exists) return null;

          let regLabel = 'Libretro CDN';
          if (candBase.includes('(USA)')) regLabel = 'Libretro CDN (USA)';
          else if (candBase.includes('(World)')) regLabel = 'Libretro CDN (World)';
          else if (candBase.includes('(Europe)')) regLabel = 'Libretro CDN (Europe)';
          else if (candBase.includes('(Japan)')) regLabel = 'Libretro CDN (Japan)';
          else if (candBase.includes('(Brazil)')) regLabel = 'Libretro CDN (Brasil)';
          else if (candBase.includes('(USA, Europe)')) regLabel = 'Libretro CDN (USA, Europe)';
          else regLabel = `Libretro CDN (${candBase})`;

          return {
            id: `libretro_${idx}`,
            type: 'libretro',
            label: regLabel,
            url: candUrl,
            thumbUrl: candUrl
          };
        })
      );

      for (const item of checks) {
        if (item && !seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          covers.push(item);
        }
      }
    }

    // 8. Steam Store Boxart
    if (checkAll || requestedSource === 'steam' || requestedSource === 'steam_store' || requestedSource === 'hydra') {
      try {
        const stSearch = await pcEngine.searchSteamStoreGame(querySearch || cleanT);
        if (stSearch && stSearch.coverUrl && !seenUrls.has(stSearch.coverUrl)) {
          const exists = await verifyRemoteImageUrl(stSearch.coverUrl, 2200);
          if (exists) {
            seenUrls.add(stSearch.coverUrl);
            covers.push({
              id: `steam_store_${stSearch.steamAppId}`,
              type: 'steam_store',
              label: `Steam Store HD (${stSearch.title})`,
              url: stSearch.coverUrl,
              thumbUrl: stSearch.coverUrl
            });
          }
        }
      } catch {}
    }

    return sendJson(res, 200, {
      gameId: game.id,
      title: game.title,
      consoleId: game.consoleId,
      currentCover: game.coverUrl,
      source: requestedSource,
      sourcesConfigured: {
        hydra: true,
        screenscraper: Boolean(db.config.ssDevId && db.config.ssDevPassword),
        steamgriddb: Boolean(db.config.steamGridDbApiKey),
        thegamesdb: Boolean(db.config.theGamesDbApiKey),
        steam_store: true
      },
      covers
    });
  }

  if (pathname === '/api/screenscraper/test' && req.method === 'POST') {
    const body = await readBody(req);
    const testCfg = {
      ssUsername: body.ssUsername !== undefined ? body.ssUsername : db.config.ssUsername,
      ssPassword: body.ssPassword !== undefined ? body.ssPassword : db.config.ssPassword,
      ssDevId: body.ssDevId !== undefined ? body.ssDevId : db.config.ssDevId,
      ssDevPassword: body.ssDevPassword !== undefined ? body.ssDevPassword : db.config.ssDevPassword,
      ssSoftName: 'HydraRetro'
    };
    const result = await testScreenScraperAuth(testCfg);
    return sendJson(res, 200, result);
  }

  if (pathname === '/api/covers/select' && req.method === 'POST') {
    const body = await readBody(req);
    const game = body.gameId ? db.games[body.gameId] : null;
    if (!game) {
      return sendJson(res, 404, { error: 'Jogo não encontrado' });
    }
    const chosenUrl = body.coverUrl;
    if (!chosenUrl) {
      return sendJson(res, 400, { error: 'URL da capa não fornecida' });
    }

    try {
      if (chosenUrl.startsWith('http://') || chosenUrl.startsWith('https://') || chosenUrl.startsWith('/api/proxy-image')) {
        const consoleSub = game.consoleId.toLowerCase();
        const destFolder = path.join(COVERS_DIR, consoleSub);
        fs.mkdirSync(destFolder, { recursive: true });

        const safeTitle = cleanTitle(game.title).replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();

        let downloadTarget = chosenUrl;
        if (chosenUrl.startsWith('/api/proxy-image')) {
          const u = new URL(chosenUrl, 'http://127.0.0.1:38475');
          downloadTarget = u.searchParams.get('url') || chosenUrl;
        }

        if (downloadTarget.includes('screenscraper.fr')) {
          const auth = getScreenScraperAuthParams();
          if (auth && !downloadTarget.includes('devid=')) {
            downloadTarget += (downloadTarget.includes('?') ? '&' : '?') + auth;
          }
        }

        const ext = downloadTarget.toLowerCase().includes('.webp') ? '.webp' : (downloadTarget.toLowerCase().includes('.jpg') || downloadTarget.toLowerCase().includes('.jpeg') ? '.jpg' : '.png');
        const fileName = `${safeTitle}_${Date.now()}${ext}`;
        const destPath = path.join(destFolder, fileName);

        await downloadImage(downloadTarget, destPath);
        const localRelUrl = `/media/covers/${consoleSub}/${fileName}`;
        game.coverUrl = localRelUrl;
        game.customCoverUrl = localRelUrl;
      } else {
        game.coverUrl = chosenUrl;
        game.customCoverUrl = chosenUrl;
      }

      saveDb(db);
      return sendJson(res, 200, { ok: true, game, coverUrl: game.coverUrl });
    } catch (e) {
      console.error('Error selecting cover:', e);
      return sendJson(res, 500, { error: `Erro ao salvar capa: ${e.message}` });
    }
  }

  if (pathname === '/api/covers/upload' && req.method === 'POST') {
    const body = await readBody(req);
    const game = body.gameId ? db.games[body.gameId] : null;
    if (!game) {
      return sendJson(res, 404, { error: 'Jogo não encontrado' });
    }
    if (!body.base64Data) {
      return sendJson(res, 400, { error: 'Dados da imagem não fornecidos' });
    }

    try {
      const consoleSub = game.consoleId.toLowerCase();
      const destFolder = path.join(COVERS_DIR, consoleSub);
      fs.mkdirSync(destFolder, { recursive: true });

      const safeTitle = cleanTitle(game.title).replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
      const ext = body.extension || '.png';
      const fileName = `${safeTitle}_custom_${Date.now()}${ext}`;
      const destPath = path.join(destFolder, fileName);

      const base64Data = body.base64Data.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(destPath, Buffer.from(base64Data, 'base64'));

      const localRelUrl = `/media/covers/${consoleSub}/${fileName}`;
      game.coverUrl = localRelUrl;
      game.customCoverUrl = localRelUrl;
      saveDb(db);
      return sendJson(res, 200, { ok: true, coverUrl: localRelUrl });
    } catch (err) {
      return sendJson(res, 500, { error: `Erro ao salvar imagem enviada: ${err.message}` });
    }
  }

  if (pathname === '/api/covers/open-folder' && req.method === 'POST') {
    const body = await readBody(req);
    const consoleId = (body.consoleId || 'ps1').toLowerCase();
    const folder = path.join(COVERS_DIR, consoleId);
    fs.mkdirSync(folder, { recursive: true });
    spawn('explorer.exe', [folder], { detached: true, stdio: 'ignore' }).unref();
    return sendJson(res, 200, { ok: true, folder });
  }

  if (pathname === '/api/saves/export') {
    try {
      const specificFile = urlObj.searchParams.get('file');
      if (specificFile) {
        const fp = path.join(BACKUPS_DIR, path.basename(specificFile));
        if (fs.existsSync(fp)) {
          const stat = fs.statSync(fp);
          res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="${path.basename(specificFile)}"`,
            'Content-Length': stat.size
          });
          return fs.createReadStream(fp).pipe(res);
        }
      }

      const backup = await exportSavesToZip();
      if (urlObj.searchParams.get('download') === '1') {
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${backup.fileName}"`,
          'Content-Length': backup.sizeBytes
        });
        return fs.createReadStream(backup.filePath).pipe(res);
      }
      return sendJson(res, 200, { ok: true, backup });
    } catch (e) {
      console.error('Save export error:', e);
      return sendJson(res, 500, { error: e.message });
    }
  }

  if (pathname === '/api/saves/list' && req.method === 'GET') {
    try {
      if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
      const files = fs.readdirSync(BACKUPS_DIR)
        .filter(f => f.toLowerCase().endsWith('.zip'))
        .map(f => {
          const fp = path.join(BACKUPS_DIR, f);
          const stat = fs.statSync(fp);
          return {
            fileName: f,
            filePath: fp,
            sizeBytes: stat.size,
            createdDate: stat.mtime.toISOString(),
            downloadUrl: `/api/saves/export?download=1&file=${encodeURIComponent(f)}`
          };
        })
        .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate));
      return sendJson(res, 200, { backups: files });
    } catch (e) {
      return sendJson(res, 500, { error: e.message });
    }
  }

  if (pathname === '/api/saves/open-folder' && req.method === 'POST') {
    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    spawn('explorer.exe', [BACKUPS_DIR], { detached: true, stdio: 'ignore' }).unref();
    return sendJson(res, 200, { ok: true, folder: BACKUPS_DIR });
  }

  if (pathname === '/api/open-folder' && req.method === 'POST') {
    const body = await readBody(req);
    if (body.folderPath && fs.existsSync(body.folderPath)) {
      spawn('explorer.exe', [body.folderPath], { detached: true, stdio: 'ignore' }).unref();
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 400, { error: 'Pasta não encontrada' });
  }

  if (pathname === '/api/stores/status' && req.method === 'GET') {
    const steamPath = pcEngine.getSteamInstallPath();
    const detectedUsers = steamPath ? pcEngine.detectSteamUsers(steamPath) : [];
    const legendaryPath = pcEngine.getLegendaryPath(APP_ROOT);
    const legendaryAvailable = fs.existsSync(legendaryPath);
    const epicAccount = pcEngine.getEpicAccountStatus(DATA_DIR);

    const totalSteamGames = Object.values(db.games).filter(g => g.consoleId === 'STEAM').length;
    const totalEpicGames = Object.values(db.games).filter(g => g.consoleId === 'EPIC').length;
    const totalPcGames = Object.values(db.games).filter(g => g.consoleId === 'PC').length;

    return sendJson(res, 200, {
      steam: {
        steamPath,
        detectedUsers,
        configuredSteamId64: db.config.steamId64 || '',
        hasApiKey: Boolean(db.config.steamWebApiKey),
        totalSteamGames
      },
      epic: {
        legendaryPath,
        legendaryAvailable,
        epicAccount,
        totalEpicGames
      },
      pc: {
        pcGameFolders: db.config.pcGameFolders || [],
        totalPcGames
      }
    });
  }

  if (pathname === '/api/pc/pick-exe' && req.method === 'POST') {
    const exePath = pcEngine.pickWindowsExeFile();
    if (!exePath) {
      return sendJson(res, 200, { ok: false, canceled: true });
    }

    const baseName = path.basename(exePath, path.extname(exePath));
    const parentFolder = path.basename(path.dirname(exePath));
    let rawTitle = baseName;
    if (/^(game|play|launch|launcher|start|run|main)$/i.test(baseName.trim())) {
      rawTitle = parentFolder;
    }
    const cleanT = pcEngine.cleanPcGameTitle(rawTitle) || rawTitle;
    const groupId = `PC::${cleanT.toLowerCase()}`;

    let statSize = 0;
    try { statSize = fs.statSync(exePath).size; } catch {}

    let steamAppId = null;
    let coverUrl = null;
    let heroUrl = null;
    let logoUrl = null;
    let description = `Jogo de PC (${cleanT}) pronto para execução nativa no Windows.`;
    let developer = 'PC / Windows';
    let publisher = 'PC / Windows';
    let releaseYear = 2024;
    let genres = ['Jogos de PC', 'Windows'];

    try {
      const stSearch = await pcEngine.searchSteamStoreGame(cleanT);
      if (stSearch) {
        steamAppId = stSearch.steamAppId;
        heroUrl = stSearch.heroUrl;
        logoUrl = stSearch.logoUrl;
        if (stSearch.coverUrl) {
          const destFolder = path.join(COVERS_DIR, 'pc');
          fs.mkdirSync(destFolder, { recursive: true });
          const safeTitle = cleanT.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
          const fileName = `${safeTitle}.jpg`;
          const destPath = path.join(destFolder, fileName);
          try {
            await downloadImage(stSearch.coverUrl, destPath);
            coverUrl = `/media/covers/pc/${fileName}`;
          } catch {}
        }
      }
    } catch {}

    if (steamAppId) {
      try {
        const stDetails = await pcEngine.fetchSteamAppDetails(steamAppId);
        if (stDetails) {
          if (stDetails.description) description = stDetails.description;
          if (stDetails.developer) developer = stDetails.developer;
          if (stDetails.publisher) publisher = stDetails.publisher;
          if (stDetails.releaseYear) releaseYear = stDetails.releaseYear;
          if (Array.isArray(stDetails.genres) && stDetails.genres.length > 0) genres = stDetails.genres;
        }
      } catch {}
    }

    const game = {
      id: groupId,
      consoleId: 'PC',
      title: cleanT,
      sortTitle: cleanT.replace(/^The\s+/i, ''),
      romPath: exePath,
      fileName: path.basename(exePath),
      sizeBytes: statSize,
      installed: true,
      steamAppId,
      coverUrl,
      coverCandidates: coverUrl ? [coverUrl] : [],
      heroUrl,
      logoUrl,
      developer,
      publisher,
      releaseYear,
      genres,
      rating: getRetroRating(cleanT, 'PC', 4.5),
      description,
      players: '1 Jogador',
      favorite: false,
      playTimeSeconds: 0,
      playCount: 0,
      lastPlayedAt: null,
      addedAt: new Date().toISOString(),
      isManualPcGame: true,
      metadataEnriched: Boolean(steamAppId)
    };

    db.games[groupId] = game;
    saveDb(db);
    return sendJson(res, 200, { ok: true, game });
  }

  if (pathname === '/api/pc/pick-folder' && req.method === 'POST') {
    const folderPath = pcEngine.pickWindowsFolder();
    if (!folderPath) {
      return sendJson(res, 200, { ok: false, canceled: true });
    }
    if (!Array.isArray(db.config.pcGameFolders)) {
      db.config.pcGameFolders = [];
    }
    if (!db.config.pcGameFolders.includes(folderPath)) {
      db.config.pcGameFolders.push(folderPath);
    }
    saveDb(db);
    const scanResult = scanLibrary();
    return sendJson(res, 200, { ok: true, folderPath, scanResult });
  }

  if (pathname === '/api/pc/remove-folder' && req.method === 'POST') {
    const body = await readBody(req);
    const targetFolder = body.folderPath;
    if (targetFolder && Array.isArray(db.config.pcGameFolders)) {
      db.config.pcGameFolders = db.config.pcGameFolders.filter(f => f !== targetFolder);
      saveDb(db);
      scanLibrary();
    }
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/steam/sync' && req.method === 'POST') {
    const body = await readBody(req);
    let targetSteamId64 = (body.steamId64 || '').trim();
    const apiKey = (body.steamWebApiKey !== undefined ? body.steamWebApiKey : (db.config.steamWebApiKey || '')).trim();

    if (!targetSteamId64) {
      const users = pcEngine.detectSteamUsers();
      if (users.length > 0) {
        targetSteamId64 = users[0].steamId64;
      } else if (db.config.steamId64) {
        targetSteamId64 = db.config.steamId64;
      }
    }

    if (targetSteamId64) {
      db.config.steamId64 = targetSteamId64;
    }
    if (body.steamWebApiKey !== undefined) {
      db.config.steamWebApiKey = apiKey;
    }
    saveDb(db);

    scanLibrary();

    let syncedCount = 0;
    if (targetSteamId64) {
      try {
        const owned = await pcEngine.fetchSteamAccountOwnedGames(targetSteamId64, apiKey);
        for (const g of owned) {
          const groupId = 'STEAM::' + g.appId;
          const existing = db.games[groupId];
          syncedCount++;

          if (!existing) {
            db.games[groupId] = {
              id: groupId,
              consoleId: 'STEAM',
              title: g.title,
              sortTitle: g.title.replace(/^The\s+/i, ''),
              steamAppId: g.appId,
              romPath: g.launchUrl,
              fileName: 'steam_app_' + g.appId,
              launchUrl: g.launchUrl,
              installed: false,
              sizeBytes: 0,
              coverUrl: g.coverUrl,
              coverCandidates: [g.coverUrl],
              heroUrl: g.heroUrl,
              logoUrl: g.logoUrl,
              developer: 'Steam',
              publisher: 'Valve / Steam',
              releaseYear: 2020,
              genres: ['Steam', 'PC'],
              rating: 4.7,
              description: `Jogo da conta Steam (${g.title}).`,
              players: '1 Jogador',
              favorite: false,
              playTimeSeconds: g.playTimeSeconds || 0,
              playCount: (g.playTimeSeconds || 0) > 0 ? 1 : 0,
              lastPlayedAt: null,
              addedAt: new Date().toISOString(),
              fromSteamAccount: true,
              metadataEnriched: false
            };
          } else {
            existing.fromSteamAccount = true;
            existing.playTimeSeconds = Math.max(existing.playTimeSeconds || 0, g.playTimeSeconds || 0);
            if (!existing.coverUrl || !isLocalCover(existing.coverUrl)) {
              existing.coverUrl = existing.coverUrl || g.coverUrl;
            }
            if (!existing.heroUrl) existing.heroUrl = g.heroUrl;
            if (!existing.logoUrl) existing.logoUrl = g.logoUrl;
          }
        }
      } catch (err) {
        console.error('Steam account fetch error:', err.message);
      }
    }

    saveDb(db);
    enqueueGamesForEnrichment();
    const totalSteamGames = Object.values(db.games).filter(g => g.consoleId === 'STEAM').length;
    return sendJson(res, 200, { ok: true, syncedCount, totalSteamGames, steamId64: targetSteamId64 });
  }

  if (pathname === '/api/epic/auth' && req.method === 'POST') {
    const body = await readBody(req);
    const code = (body.code || '').trim();
    if (!code) {
      return sendJson(res, 400, { error: 'Código de autorização não fornecido' });
    }

    try {
      const account = pcEngine.authenticateEpicWithCode(APP_ROOT, DATA_DIR, code);
      const epicGames = pcEngine.syncEpicLibraryWithLegendary(APP_ROOT, DATA_DIR);

      let syncedCount = 0;
      for (const g of epicGames) {
        if (!g.appName) continue;
        const groupId = 'EPIC::' + g.appName;
        const existing = db.games[groupId];
        syncedCount++;

        if (!existing) {
          db.games[groupId] = {
            id: groupId,
            consoleId: 'EPIC',
            title: g.title,
            sortTitle: g.title.replace(/^The\s+/i, ''),
            epicAppName: g.appName,
            romPath: `com.epicgames.launcher://apps/${g.appName}?action=launch&silent=true`,
            fileName: g.appName,
            launchUrl: `com.epicgames.launcher://apps/${g.appName}?action=launch&silent=true`,
            installed: false,
            sizeBytes: 0,
            coverUrl: g.coverUrl || null,
            coverCandidates: g.coverUrl ? [g.coverUrl] : [],
            heroUrl: g.heroUrl || null,
            logoUrl: g.logoUrl || null,
            developer: g.developer || 'Epic Games',
            publisher: 'Epic Games',
            releaseYear: g.releaseYear || 2021,
            genres: ['Epic Games', 'PC'],
            rating: 4.6,
            description: g.description || `Jogo da conta Epic Games (${g.title}).`,
            players: '1 Jogador',
            favorite: false,
            playTimeSeconds: 0,
            playCount: 0,
            lastPlayedAt: null,
            addedAt: new Date().toISOString(),
            fromEpicAccount: true,
            metadataEnriched: Boolean(g.description)
          };
        } else {
          existing.fromEpicAccount = true;
          if (!existing.coverUrl || !isLocalCover(existing.coverUrl)) {
            existing.coverUrl = existing.coverUrl || g.coverUrl;
          }
          if (!existing.heroUrl) existing.heroUrl = g.heroUrl;
          if (!existing.logoUrl) existing.logoUrl = g.logoUrl;
          if (g.description && (!existing.description || existing.description.startsWith('Jogo da'))) {
            existing.description = g.description;
          }
          if (g.developer) existing.developer = g.developer;
          if (g.releaseYear) existing.releaseYear = g.releaseYear;
        }
      }

      saveDb(db);
      enqueueGamesForEnrichment();
      return sendJson(res, 200, { ok: true, account, syncedCount });
    } catch (err) {
      console.error('Epic auth error:', err.message);
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname === '/api/epic/sync' && req.method === 'POST') {
    await scanLibrary();
    const accountStatus = pcEngine.getEpicAccountStatus(DATA_DIR);
    let syncedCount = 0;

    if (accountStatus.loggedIn) {
      try {
        const epicGames = pcEngine.syncEpicLibraryWithLegendary(APP_ROOT, DATA_DIR);
        for (const g of epicGames) {
          if (!g.appName) continue;
          const groupId = 'EPIC::' + g.appName;
          const existing = db.games[groupId];
          syncedCount++;

          if (!existing) {
            db.games[groupId] = {
              id: groupId,
              consoleId: 'EPIC',
              title: g.title,
              sortTitle: g.title.replace(/^The\s+/i, ''),
              epicAppName: g.appName,
              romPath: `com.epicgames.launcher://apps/${g.appName}?action=launch&silent=true`,
              fileName: g.appName,
              launchUrl: `com.epicgames.launcher://apps/${g.appName}?action=launch&silent=true`,
              installed: false,
              sizeBytes: 0,
              coverUrl: g.coverUrl || null,
              coverCandidates: g.coverUrl ? [g.coverUrl] : [],
              heroUrl: g.heroUrl || null,
              logoUrl: g.logoUrl || null,
              developer: g.developer || 'Epic Games',
              publisher: 'Epic Games',
              releaseYear: g.releaseYear || 2021,
              genres: ['Epic Games', 'PC'],
              rating: 4.6,
              description: g.description || `Jogo da conta Epic Games (${g.title}).`,
              players: '1 Jogador',
              favorite: false,
              playTimeSeconds: 0,
              playCount: 0,
              lastPlayedAt: null,
              addedAt: new Date().toISOString(),
              fromEpicAccount: true,
              metadataEnriched: Boolean(g.description)
            };
          } else {
            existing.fromEpicAccount = true;
            if (!existing.coverUrl || !isLocalCover(existing.coverUrl)) {
              existing.coverUrl = existing.coverUrl || g.coverUrl;
            }
            if (!existing.heroUrl) existing.heroUrl = g.heroUrl;
            if (!existing.logoUrl) existing.logoUrl = g.logoUrl;
            if (g.description && (!existing.description || existing.description.startsWith('Jogo da'))) {
              existing.description = g.description;
            }
            if (g.developer) existing.developer = g.developer;
            if (g.releaseYear) existing.releaseYear = g.releaseYear;
          }
        }
        saveDb(db);
        enqueueGamesForEnrichment();
      } catch (err) {
        console.error('Epic sync error:', err.message);
      }
    }

    return sendJson(res, 200, { ok: true, syncedCount });
  }

  if (pathname === '/api/epic/logout' && req.method === 'POST') {
    pcEngine.logoutEpicAccount(DATA_DIR);
    for (const [key, g] of Object.entries(db.games)) {
      if (g.consoleId === 'EPIC' && !g.installed) {
        delete db.games[key];
      }
    }
    saveDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/achievements/sync' && req.method === 'POST') {
    const body = await readBody(req);
    const { gameId, all } = body;

    if (all) {
      let syncedGames = 0;
      let totalAchievements = 0;
      const candidates = Object.values(db.games).filter(
        g => ['PC', 'STEAM', 'EPIC'].includes(g.consoleId) || (g.playCount || 0) > 0 || g.favorite
      ).slice(0, 40);

      for (const g of candidates) {
        try {
          const achs = await achEngine.syncGameAchievements(g, db.config, fetchHydraGameByRomHashOrTitle);
          if (Array.isArray(achs) && achs.length > 0) {
            syncedGames++;
            totalAchievements += achs.length;
          }
        } catch {}
      }
      saveDb(db);
      return sendJson(res, 200, { ok: true, syncedGames, totalAchievements });
    }

    const game = db.games[gameId];
    if (!game) return sendJson(res, 404, { error: 'Jogo não encontrado' });

    try {
      const achs = await achEngine.syncGameAchievements(game, db.config, fetchHydraGameByRomHashOrTitle);
      saveDb(db);
      return sendJson(res, 200, {
        ok: true,
        gameId: game.id,
        retroAchievementsGameId: game.retroAchievementsGameId || null,
        achievements: getGameAchievements(game),
        officialCount: Array.isArray(achs) ? achs.length : 0
      });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname === '/api/achievements/ra-connect' && req.method === 'POST') {
    const body = await readBody(req);
    const username = (body.username !== undefined ? body.username : db.config.raUsername || '').trim();
    const password = (body.password || '').trim();
    const webApiKey = (body.webApiKey !== undefined ? body.webApiKey : db.config.raWebApiKey || '').trim();
    const hardcore = Boolean(body.hardcore !== undefined ? body.hardcore : db.config.raHardcore);

    if (!username) {
      return sendJson(res, 400, { error: 'Informe seu nome de usuário do RetroAchievements.org' });
    }

    let token = db.config.raToken || '';
    if (password) {
      try {
        const account = await achEngine.requestRetroAchievementsConnectToken(username, password);
        token = account.token;
      } catch (err) {
        return sendJson(res, 400, { error: err.message });
      }
    }

    db.config.raUsername = username;
    if (webApiKey) db.config.raWebApiKey = webApiKey;
    if (token) db.config.raToken = token;
    db.config.raHardcore = hardcore;

    const injectedEmulators = achEngine.injectRetroAchievementsIntoEmulators(APP_ROOT, username, token, hardcore);
    saveDb(db);

    return sendJson(res, 200, {
      ok: true,
      username,
      hasToken: Boolean(token),
      hasWebApiKey: Boolean(db.config.raWebApiKey),
      hardcore,
      injectedEmulators
    });
  }

  if (pathname === '/api/achievements/pc-scan' && req.method === 'POST') {
    let gamesWithUnlocks = 0;
    let totalUnlocked = 0;

    for (const g of Object.values(db.games)) {
      if (!['PC', 'STEAM', 'EPIC'].includes(g.consoleId)) continue;
      try {
        const unlockedMap = achEngine.scanPcLocalUnlockedAchievements(g);
        if (unlockedMap.size > 0) {
          await achEngine.syncGameAchievements(g, db.config, fetchHydraGameByRomHashOrTitle);
          gamesWithUnlocks++;
          totalUnlocked += unlockedMap.size;
        }
      } catch {}
    }

    saveDb(db);
    return sendJson(res, 200, { ok: true, gamesWithUnlocks, totalUnlocked });
  }

  if (pathname === '/api/game/remove' && req.method === 'POST') {
    const body = await readBody(req);
    const { gameId, deleteFiles } = body;
    const game = gameId ? db.games[gameId] : null;
    if (!game) {
      return sendJson(res, 404, { error: 'Jogo não encontrado na biblioteca' });
    }

    if (!Array.isArray(db.config.removedGames)) {
      db.config.removedGames = [];
    }
    if (!db.config.removedGames.includes(gameId)) {
      db.config.removedGames.push(gameId);
    }

    let fileDeleted = false;
    if (deleteFiles && game.romPath && fs.existsSync(game.romPath)) {
      try {
        const stat = fs.statSync(game.romPath);
        if (stat.isFile()) {
          fs.unlinkSync(game.romPath);
          fileDeleted = true;
        }
      } catch (err) {
        console.error('Error deleting game file:', err.message);
      }
    }

    delete db.games[gameId];
    saveDb(db);
    return sendJson(res, 200, { ok: true, removedId: gameId, fileDeleted });
  }

  if (pathname === '/api/game/open-location' && req.method === 'POST') {
    const body = await readBody(req);
    const game = body.gameId ? db.games[body.gameId] : null;
    if (!game || !game.romPath) {
      return sendJson(res, 404, { error: 'Caminho do arquivo não encontrado' });
    }

    if (fs.existsSync(game.romPath)) {
      spawn('explorer.exe', [`/select,"${game.romPath}"`], { detached: true, stdio: 'ignore', shell: true }).unref();
      return sendJson(res, 200, { ok: true, path: game.romPath });
    }

    const dir = path.dirname(game.romPath);
    if (fs.existsSync(dir)) {
      spawn('explorer.exe', [dir], { detached: true, stdio: 'ignore' }).unref();
      return sendJson(res, 200, { ok: true, path: dir });
    }

    return sendJson(res, 404, { error: 'Arquivo ou pasta não existe no disco' });
  }

  if (pathname === '/api/game/full-details' && req.method === 'POST') {
    const body = await readBody(req);
    const game = body.gameId ? db.games[body.gameId] : null;
    if (!game) {
      return sendJson(res, 404, { error: 'Jogo não encontrado' });
    }

    const isPc = ['PC', 'STEAM', 'EPIC'].includes(game.consoleId);

    // 1. Resolve Hydra API Identity & Metadata if not yet resolved
    if (!game.hydraObjectId && !game.steamAppId) {
      try {
        const hydraData = await fetchHydraGameByRomHashOrTitle(game);
        if (hydraData) {
          if (hydraData.objectId && hydraData.shop === 'launchbox') game.hydraObjectId = hydraData.objectId;
          if (hydraData.steamAppId) game.steamAppId = hydraData.steamAppId;
          if (hydraData.description && (!game.description || game.description.startsWith('Um clássico') || game.description.startsWith('Jogo d'))) {
            game.description = hydraData.description;
          }
          if (hydraData.developer) game.developer = hydraData.developer;
          if (hydraData.publisher) game.publisher = hydraData.publisher;
          if (hydraData.releaseYear) game.releaseYear = hydraData.releaseYear;
          if (Array.isArray(hydraData.genres) && hydraData.genres.length > 0) game.genres = hydraData.genres;
          if (hydraData.heroUrl && (!game.heroUrl || game.heroUrl.includes('thumbnails.libretro.com'))) game.heroUrl = hydraData.heroUrl;
          if (hydraData.logoUrl && (!game.logoUrl || game.logoUrl.includes('thumbnails.libretro.com'))) game.logoUrl = hydraData.logoUrl;
          if (Array.isArray(hydraData.screenshots) && hydraData.screenshots.length > 0) {
            game.screenshots = hydraData.screenshots;
          }
        }
      } catch {}
    }

    // For PC games without steamAppId, try searching Steam Store for rich details
    if (isPc && !game.steamAppId) {
      try {
        const stMatch = await pcEngine.searchSteamStoreGame(cleanTitle(game.title));
        if (stMatch && stMatch.steamAppId) {
          game.steamAppId = stMatch.steamAppId;
        }
      } catch {}
    }

    let screenshots = Array.isArray(game.screenshots) ? [...game.screenshots] : [];
    let movies = [];
    let supportedLanguages = [];
    let pcRequirements = { minimum: '', recommended: '' };
    let controllerSupport = isPc ? 'none' : 'full';
    let metacriticScore = null;
    let aboutHtml = '';

    // 2A. Fetch Steam Store AppDetails (Languages, Requirements, Controller Support, Screenshots, Trailers)
    if (game.steamAppId) {
      try {
        const stUrl = `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(game.steamAppId)}&l=brazilian`;
        const stRes = await fetchWithTimeout(stUrl, 7500, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (stRes.ok) {
          const stJson = await stRes.json();
          const d = stJson?.[String(game.steamAppId)]?.data;
          if (d) {
            if (Array.isArray(d.screenshots) && d.screenshots.length > 0) {
              screenshots = d.screenshots.slice(0, 12).map(s => s.path_full || s.path_thumbnail).filter(Boolean);
              game.screenshots = screenshots;
            }
            if (Array.isArray(d.movies) && d.movies.length > 0) {
              movies = d.movies.slice(0, 3).map(m => ({
                id: m.id,
                name: m.name || 'Trailer',
                thumbnail: m.thumbnail || '',
                url: m.mp4?.max || m.mp4?.['480'] || m.webm?.max || m.webm?.['480'] || ''
              })).filter(m => m.url);
            }
            if (d.supported_languages) {
              const langPart = String(d.supported_languages).split('<br>')[0];
              supportedLanguages = langPart.split(',').map(raw => {
                const hasAudio = raw.includes('*');
                const cleanLang = raw.replace(/<[^>]+>/g, '').replace(/\*/g, '').trim();
                return cleanLang ? { language: cleanLang, caption: true, audio: hasAudio } : null;
              }).filter(Boolean);
            }
            if (d.pc_requirements) {
              pcRequirements = {
                minimum: d.pc_requirements.minimum || '',
                recommended: d.pc_requirements.recommended || ''
              };
            }
            if (d.controller_support === 'full' || (Array.isArray(d.categories) && d.categories.some(c => c.id === 28))) {
              controllerSupport = 'full';
            } else if (d.controller_support === 'partial' || (Array.isArray(d.categories) && d.categories.some(c => c.id === 18))) {
              controllerSupport = 'partial';
            }
            if (d.metacritic && d.metacritic.score) {
              metacriticScore = d.metacritic.score;
            }
            if (d.about_the_game || d.detailed_description) {
              aboutHtml = d.about_the_game || d.detailed_description;
            }
            if (d.short_description && (!game.description || game.description.startsWith('Jogo d'))) {
              game.description = stripHtmlTags(d.short_description);
            }
            if (Array.isArray(d.developers) && d.developers[0]) game.developer = d.developers[0];
            if (Array.isArray(d.publishers) && d.publishers[0]) game.publisher = d.publishers[0];
          }
        }
      } catch {}
    }

    // 2B. Fetch LaunchBox Shop-Details Screenshots & Specs for Retro Consoles
    if (!isPc) {
      if (game.hydraObjectId && screenshots.length === 0) {
        try {
          const detRes = await fetchWithTimeout(`${HYDRA_API_URL}/games/shop-details`, 6500, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'HydraLauncher/3.0' },
            body: JSON.stringify({ shop: 'launchbox', objectIds: [String(game.hydraObjectId)], language: 'pt' })
          });
          if (detRes.ok) {
            const entries = await detRes.json();
            if (Array.isArray(entries) && entries[0]?.data) {
              const d = entries[0].data;
              if (Array.isArray(d.screenshots) && d.screenshots.length > 0) {
                screenshots = d.screenshots;
                game.screenshots = screenshots;
              }
              if (d.description && (!game.description || game.description.startsWith('Um clássico'))) {
                game.description = stripHtmlTags(d.description);
              }
            }
          }
        } catch {}
      }

      // Supplement with verified Libretro Named_Snaps / Named_Titles if screenshots are empty
      if (screenshots.length < 2 && Array.isArray(game.heroCandidates)) {
        for (const snapUrl of game.heroCandidates.slice(0, 4)) {
          if (snapUrl && !screenshots.includes(snapUrl)) {
            const ok = await verifyRemoteImageUrl(snapUrl, 1800);
            if (ok) screenshots.push(snapUrl);
          }
          if (screenshots.length >= 3) break;
        }
      }

      // Parse languages from ROM filename for retro consoles
      const fn = (game.fileName || '').toLowerCase();
      if (fn.includes('brazil') || fn.includes('pt-br') || fn.includes('(pt)')) {
        supportedLanguages.push({ language: 'Português (Brasil)', caption: true, audio: false });
      }
      if (fn.includes('en,fr,de')) {
        supportedLanguages.push(
          { language: 'Inglês', caption: true, audio: true },
          { language: 'Francês', caption: true, audio: false },
          { language: 'Alemão', caption: true, audio: false }
        );
      } else if (fn.includes('japan') && !fn.includes('usa')) {
        supportedLanguages.push({ language: 'Japonês', caption: true, audio: true });
      } else {
        supportedLanguages.push({ language: 'Inglês', caption: true, audio: true });
      }

      const cCfg = db.config.consoles[game.consoleId] || {};
      const sizeMb = game.sizeBytes ? (game.sizeBytes / (1024 * 1024)).toFixed(1) + ' MB' : 'N/A';
      pcRequirements = {
        minimum: `<ul>
          <li><strong>Plataforma:</strong> ${cCfg.name || game.consoleId} (${cCfg.releaseYear || ''})</li>
          <li><strong>Emulador Integrado:</strong> ${path.basename(cCfg.emulatorPath || 'RetroArch')} (Modo Tela Cheia 60 FPS)</li>
          <li><strong>Arquivo ROM:</strong> ${game.fileName || 'N/A'} (${sizeMb})</li>
          ${game.crc32 ? `<li><strong>Hash CRC32:</strong> ${game.crc32}</li>` : ''}
        </ul>`,
        recommended: `<ul>
          <li><strong>Controle:</strong> Controle Xbox (XInput) ou PlayStation pré-mapeado</li>
          <li><strong>Atalho de Saída:</strong> Segure <code>Select + Start</code> ou <code>ESC</code> para voltar ao catálogo</li>
          <li><strong>RetroAchievements:</strong> Suporte nativo em tempo real ativado</li>
        </ul>`
      };
    }

    // 3. Fetch "More Like This" / Similar Games (ported from Hydra Original similar-games.ts)
    const similarGames = [];
    const seenSimTitles = new Set([game.title.toLowerCase()]);
    const shop = isPc ? 'steam' : 'launchbox';
    const objectId = isPc ? game.steamAppId : game.hydraObjectId;

    if (objectId) {
      try {
        const simUrl = `${HYDRA_API_URL}/catalogue/${shop}/${encodeURIComponent(objectId)}/similar?take=8`;
        const simRes = await fetchWithTimeout(simUrl, 6000, {
          headers: { 'User-Agent': 'HydraLauncher/3.0' }
        });
        if (simRes.ok) {
          const simData = await simRes.json();
          if (Array.isArray(simData)) {
            for (const sg of simData) {
              if (!sg || !sg.title) continue;
              const tLow = sg.title.toLowerCase();
              if (seenSimTitles.has(tLow)) continue;
              seenSimTitles.add(tLow);

              // Check if user already has this game in their local library
              const localMatch = Object.values(db.games).find(
                lg => lg.title.toLowerCase() === tLow ||
                      (sg.shop === 'steam' && lg.steamAppId && String(lg.steamAppId) === String(sg.objectId)) ||
                      (sg.shop === 'launchbox' && lg.hydraObjectId && String(lg.hydraObjectId) === String(sg.objectId))
              );

              similarGames.push({
                objectId: sg.objectId,
                shop: sg.shop,
                title: sg.title,
                coverUrl: localMatch?.coverUrl || sg.libraryImageUrl || sg.coverImageUrl || sg.iconUrl || null,
                localGameId: localMatch ? localMatch.id : null,
                consoleId: localMatch ? localMatch.consoleId : (sg.shop === 'steam' ? 'STEAM' : game.consoleId)
              });
            }
          }
        }
      } catch {}
    }

    // Supplement with local library games from the same console/genre so the user can always click & play similar games!
    if (similarGames.length < 8) {
      const sameConsoleGames = Object.values(db.games).filter(
        lg => lg.id !== game.id && lg.consoleId === game.consoleId && !seenSimTitles.has(lg.title.toLowerCase())
      );
      for (const lg of sameConsoleGames.slice(0, 8 - similarGames.length)) {
        seenSimTitles.add(lg.title.toLowerCase());
        similarGames.push({
          objectId: lg.hydraObjectId || lg.steamAppId || lg.id,
          shop: isPc ? 'steam' : 'launchbox',
          title: lg.title,
          coverUrl: lg.coverUrl,
          localGameId: lg.id,
          consoleId: lg.consoleId
        });
      }
    }

    saveDb(db);
    return sendJson(res, 200, {
      ok: true,
      game: {
        ...game,
        achievements: getGameAchievements(game)
      },
      details: {
        screenshots,
        movies,
        supportedLanguages,
        pcRequirements,
        controllerSupport,
        metacriticScore,
        aboutHtml,
        similarGames
      }
    });
  }

  // --- HYDRA STORE & HOME CATALOGUE ENDPOINTS ---
  if (pathname === '/api/home/catalogue' && req.method === 'GET') {
    const category = urlObj.searchParams.get('category') || 'hot';
    try {
      const items = await downloadsEngine.fetchHomeCatalogue(category);
      return sendJson(res, 200, { ok: true, category, items });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  if (pathname === '/api/home/search') {
    let q = urlObj.searchParams.get('q') || '';
    let genre = urlObj.searchParams.get('genre') || 'all';
    let order = urlObj.searchParams.get('order') || 'popularity:desc';
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (body.q) q = body.q;
      if (body.genre) genre = body.genre;
      if (body.order) order = body.order;
    }
    try {
      const items = await downloadsEngine.searchStoreCatalogue(q, { genre, order });
      return sendJson(res, 200, { ok: true, query: q, genre, order, items });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // --- USER PROFILE & HYDRA AUTH ENDPOINTS ---
  if (pathname === '/api/profile' && req.method === 'GET') {
    const profile = loadUserProfile();
    if (profile.isLoggedInHydra && profile.hydraAuthToken) {
      await getValidHydraToken(profile);
    }
    const games = Object.values(db.games || {});
    const totalPlaySec = db.stats?.totalPlayTimeSeconds || games.reduce((acc, g) => acc + (g.playTimeSeconds || 0), 0);
    let totalAch = 0;
    for (const g of games) {
      if (Array.isArray(g.achievements)) {
        totalAch += g.achievements.filter(a => a.unlocked).length;
      }
    }
    const topPlayed = games
      .filter(g => (g.playTimeSeconds || 0) > 0)
      .sort((a, b) => (b.playTimeSeconds || 0) - (a.playTimeSeconds || 0))
      .slice(0, 6)
      .map(g => ({
        id: g.id,
        title: g.title,
        coverUrl: g.coverUrl,
        playTimeSeconds: g.playTimeSeconds,
        consoleId: g.consoleId
      }));

    return sendJson(res, 200, {
      ok: true,
      ...profile,
      stats: {
        totalPlayTimeSeconds: totalPlaySec,
        totalGames: games.length,
        totalAchievements: totalAch,
        topPlayed
      },
      topPlayedGames: topPlayed
    });
  }

  if (pathname === '/api/profile/save' && req.method === 'POST') {
    const body = await readBody(req);
    const profile = loadUserProfile();
    const patchData = {};

    if (body.displayName !== undefined) {
      profile.displayName = String(body.displayName).trim();
      patchData.displayName = profile.displayName;
    }
    if (body.bio !== undefined) {
      profile.bio = String(body.bio).trim();
      patchData.bio = profile.bio;
    }
    if (body.profileImageUrl !== undefined) {
      profile.profileImageUrl = String(body.profileImageUrl).trim() || null;
      patchData.profileImageUrl = profile.profileImageUrl;
    }
    if (body.backgroundImageUrl !== undefined) {
      profile.backgroundImageUrl = String(body.backgroundImageUrl).trim() || null;
      patchData.backgroundImageUrl = profile.backgroundImageUrl;
    }

    // Se estiver conectado à conta Hydra oficial, sincronizar na nuvem
    if (profile.isLoggedInHydra) {
      try {
        const token = await getValidHydraToken(profile);
        if (token) {
          const updated = await patchHydraProfile(token, patchData);
          if (updated) {
            if (updated.displayName) profile.displayName = updated.displayName;
            if (updated.bio !== undefined) profile.bio = updated.bio;
            if (updated.profileImageUrl) profile.profileImageUrl = updated.profileImageUrl;
            if (updated.backgroundImageUrl) profile.backgroundImageUrl = updated.backgroundImageUrl;
          }
        }
      } catch (err) {
        console.warn('[HydraRetro] Erro ao sincronizar edição com Hydra API:', err.message);
      }
    }

    saveUserProfile(profile);
    return sendJson(res, 200, { ok: true, profile });
  }

  if (pathname === '/api/profile/login-hydra' && req.method === 'POST') {
    const body = await readBody(req);
    let accessToken = '';
    let refreshToken = '';
    let expiresIn = 3600;
    let workwondersJwt = null;

    let payloadRaw = body.payload || body.url || '';
    if (payloadRaw && typeof payloadRaw === 'string') {
      try {
        if (payloadRaw.includes('payload=')) {
          const match = payloadRaw.match(/payload=([^&]+)/);
          if (match) payloadRaw = decodeURIComponent(match[1]);
        }
        const decoded = Buffer.from(payloadRaw, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        accessToken = parsed.accessToken || '';
        refreshToken = parsed.refreshToken || '';
        expiresIn = parsed.expiresIn || 3600;
        workwondersJwt = parsed.workwondersJwt || null;
      } catch (e) {
        // Not a base64 payload
      }
    }

    if (!accessToken && body.token) {
      accessToken = String(body.token).trim();
    }

    if (!accessToken) {
      return sendJson(res, 400, { ok: false, error: 'Credenciais ou payload de autenticação inválidos.' });
    }

    const profile = loadUserProfile();
    try {
      const me = await fetchHydraUserData(accessToken);
      profile.id = me.id || profile.id;
      profile.username = me.username || profile.username;
      profile.displayName = me.displayName || me.username || profile.displayName;
      profile.email = me.email || profile.email || null;
      profile.bio = me.bio !== undefined ? me.bio : profile.bio;
      profile.profileImageUrl = me.profileImageUrl || profile.profileImageUrl;
      profile.backgroundImageUrl = me.backgroundImageUrl || profile.backgroundImageUrl;
      profile.subscription = me.subscription?.plan?.name || (me.subscription ? 'Supporter' : null);
      profile.subscriptionDetails = me.subscription || null;
      profile.karma = me.karma !== undefined ? me.karma : (profile.karma || 100);
      profile.hydraAuthToken = accessToken;
      profile.hydraRefreshToken = refreshToken || profile.hydraRefreshToken;
      profile.tokenExpirationTimestamp = Date.now() + (expiresIn * 1000) - (5 * 60 * 1000);
      profile.workwondersJwt = workwondersJwt || profile.workwondersJwt;
      profile.isLoggedInHydra = true;

      saveUserProfile(profile);
      return sendJson(res, 200, { ok: true, profile });
    } catch (e) {
      console.warn('[HydraRetro] Aviso ao validar usuário na API oficial Hydra:', e.message);
      // Fallback local caso offline
      profile.hydraAuthToken = accessToken;
      if (refreshToken) profile.hydraRefreshToken = refreshToken;
      profile.isLoggedInHydra = true;
      saveUserProfile(profile);
      return sendJson(res, 200, { ok: true, profile, offlineWarning: true });
    }
  }

  if (pathname === '/api/profile/logout' && req.method === 'POST') {
    const profile = loadUserProfile();
    if (profile.hydraAuthToken) {
      await logoutHydraAccount(profile.hydraAuthToken);
    }
    const resetProfile = Object.assign({}, DEFAULT_USER_PROFILE, {
      createdAt: profile.createdAt || new Date().toISOString()
    });
    saveUserProfile(resetProfile);
    return sendJson(res, 200, { ok: true, profile: resetProfile });
  }

  // --- DOWNLOADS & TORRENTS ENGINE ENDPOINTS ---
  if (pathname === '/api/downloads/list' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, downloads: downloadsEngine.downloads });
  }

  if (pathname === '/api/downloads/start' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const item = await downloadsEngine.startDownload(body);
      return sendJson(res, 200, { ok: true, download: item });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message });
    }
  }

  if (pathname === '/api/downloads/pause' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const item = await downloadsEngine.pauseDownload(body.downloadId);
      return sendJson(res, 200, { ok: true, download: item });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message });
    }
  }

  if (pathname === '/api/downloads/resume' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const item = await downloadsEngine.resumeDownload(body.downloadId);
      return sendJson(res, 200, { ok: true, download: item });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message });
    }
  }

  if (pathname === '/api/downloads/cancel' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const ok = await downloadsEngine.cancelDownload(body.downloadId, Boolean(body.deleteFiles));
      return sendJson(res, 200, { ok });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message });
    }
  }

  if (pathname === '/api/downloads/open-folder' && req.method === 'POST') {
    const dlPath = downloadsEngine.getDefaultDownloadPath();
    spawn('explorer.exe', [dlPath], { detached: true, stdio: 'ignore' }).unref();
    return sendJson(res, 200, { ok: true, folder: dlPath });
  }

  // --- DOWNLOAD SOURCES (REPACK SOURCES) ENDPOINTS ---
  if (pathname === '/api/downloads/sources' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, sources: downloadsEngine.getDownloadSources() });
  }

  if (pathname === '/api/downloads/sources' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const source = await downloadsEngine.addDownloadSource(body.url, body.name);
      return sendJson(res, 200, { ok: true, source });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message });
    }
  }

  if (pathname === '/api/downloads/sources/sync' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      if (body.sourceId) {
        const source = await downloadsEngine.syncDownloadSource(body.sourceId);
        return sendJson(res, 200, { ok: true, source });
      } else {
        const results = await downloadsEngine.syncAllDownloadSources();
        return sendJson(res, 200, { ok: true, sources: results });
      }
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message });
    }
  }

  if (pathname === '/api/downloads/sources/toggle' && req.method === 'POST') {
    const body = await readBody(req);
    const source = downloadsEngine.toggleDownloadSource(body.sourceId, body.enabled);
    return sendJson(res, 200, { ok: true, source });
  }

  if (pathname === '/api/downloads/sources/remove' && req.method === 'POST') {
    const body = await readBody(req);
    downloadsEngine.removeDownloadSource(body.sourceId || body.url);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/downloads/repacks') {
    let title = urlObj.searchParams.get('title');
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (body.title) title = body.title;
    }
    const repacks = downloadsEngine.searchRepacksForGame(title || '');
    return sendJson(res, 200, { ok: true, repacks });
  }

  // --- GOG & XBOX SCANNERS & WINDOWS AUTO-STARTUP ---
  if (pathname === '/api/integrations/scan-stores' && req.method === 'POST') {
    try {
      const discovered = await downloadsEngine.scanGogAndXboxGames();
      let added = 0;
      for (const item of discovered) {
        const groupId = `${item.store}::${item.id}`;
        let localCoverUrl = null;
        let localHeroUrl = null;

        // Copy native Xbox / GOG art to covers folder if available
        if (item.coverPath && fs.existsSync(item.coverPath)) {
          try {
            const coversDir = path.join(APP_ROOT, 'covers');
            if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
            const ext = path.extname(item.coverPath) || '.png';
            const destName = `cover_${groupId.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;
            const destPath = path.join(coversDir, destName);
            fs.copyFileSync(item.coverPath, destPath);
            localCoverUrl = `/covers/${destName}`;
          } catch {}
        }

        if (item.heroPath && fs.existsSync(item.heroPath)) {
          try {
            const coversDir = path.join(APP_ROOT, 'covers');
            if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
            const ext = path.extname(item.heroPath) || '.png';
            const destName = `hero_${groupId.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;
            const destPath = path.join(coversDir, destName);
            fs.copyFileSync(item.heroPath, destPath);
            localHeroUrl = `/covers/${destName}`;
          } catch {}
        }

        if (!db.games[groupId]) {
          db.games[groupId] = {
            id: groupId,
            consoleId: item.store,
            title: item.title,
            sortTitle: item.title.replace(/^The\s+/i, ''),
            romPath: item.exePath,
            fileName: path.basename(item.exePath),
            sizeBytes: 0,
            installed: true,
            coverUrl: localCoverUrl,
            coverCandidates: localCoverUrl ? [localCoverUrl] : [],
            heroUrl: localHeroUrl,
            logoUrl: null,
            developer: item.store === 'XBOX' ? 'Xbox Game Studios' : item.store,
            publisher: item.store === 'XBOX' ? 'Microsoft Xbox' : item.store,
            releaseYear: 2024,
            genres: [item.store, 'PC Games'],
            rating: 4.8,
            description: `Jogo instalado detectado do catálogo ${item.store} (${item.title}).`,
            players: '1 Jogador',
            favorite: false,
            playTimeSeconds: 0,
            playCount: 0,
            lastPlayedAt: null,
            addedAt: new Date().toISOString(),
            metadataEnriched: Boolean(localCoverUrl)
          };
          added++;
        } else {
          // Update existing with high-res local art if not present
          if (localCoverUrl && !db.games[groupId].coverUrl) {
            db.games[groupId].coverUrl = localCoverUrl;
          }
          if (localHeroUrl && !db.games[groupId].heroUrl) {
            db.games[groupId].heroUrl = localHeroUrl;
          }
          db.games[groupId].romPath = item.exePath;
          db.games[groupId].installed = true;
        }
      }
      if (added > 0) saveDb(db);
      return sendJson(res, 200, { ok: true, totalDiscovered: discovered.length, newlyAdded: added });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // Dedicated Xbox Scan & Add Folder endpoints
  if (pathname === '/api/xbox/scan' && req.method === 'POST') {
    try {
      const discovered = await downloadsEngine.scanGogAndXboxGames();
      const xboxGames = discovered.filter(d => d.store === 'XBOX');
      let added = 0;
      for (const item of xboxGames) {
        const groupId = `XBOX::${item.id}`;
        let localCoverUrl = null;
        let localHeroUrl = null;

        if (item.coverPath && fs.existsSync(item.coverPath)) {
          try {
            const coversDir = path.join(APP_ROOT, 'covers');
            if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
            const ext = path.extname(item.coverPath) || '.png';
            const destName = `cover_${groupId.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;
            const destPath = path.join(coversDir, destName);
            fs.copyFileSync(item.coverPath, destPath);
            localCoverUrl = `/covers/${destName}`;
          } catch {}
        }

        if (item.heroPath && fs.existsSync(item.heroPath)) {
          try {
            const coversDir = path.join(APP_ROOT, 'covers');
            if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
            const ext = path.extname(item.heroPath) || '.png';
            const destName = `hero_${groupId.replace(/[^a-zA-Z0-9_-]/g, '_')}${ext}`;
            const destPath = path.join(coversDir, destName);
            fs.copyFileSync(item.heroPath, destPath);
            localHeroUrl = `/covers/${destName}`;
          } catch {}
        }

        if (!db.games[groupId]) {
          db.games[groupId] = {
            id: groupId,
            consoleId: 'XBOX',
            title: item.title,
            sortTitle: item.title.replace(/^The\s+/i, ''),
            romPath: item.exePath,
            fileName: path.basename(item.exePath),
            sizeBytes: 0,
            installed: true,
            coverUrl: localCoverUrl,
            coverCandidates: localCoverUrl ? [localCoverUrl] : [],
            heroUrl: localHeroUrl,
            logoUrl: null,
            developer: 'Xbox Game Studios',
            publisher: 'Microsoft Xbox',
            releaseYear: 2024,
            genres: ['Xbox Game Pass', 'PC Games'],
            rating: 4.8,
            description: `Título oficial do Xbox Game Pass (${item.title}).`,
            players: '1 Jogador',
            favorite: false,
            playTimeSeconds: 0,
            playCount: 0,
            lastPlayedAt: null,
            addedAt: new Date().toISOString(),
            metadataEnriched: Boolean(localCoverUrl)
          };
          added++;
        } else {
          if (localCoverUrl && !db.games[groupId].coverUrl) db.games[groupId].coverUrl = localCoverUrl;
          if (localHeroUrl && !db.games[groupId].heroUrl) db.games[groupId].heroUrl = localHeroUrl;
          db.games[groupId].romPath = item.exePath;
          db.games[groupId].installed = true;
        }
      }
      if (added > 0) saveDb(db);
      return sendJson(res, 200, { ok: true, totalXboxGames: xboxGames.length, newlyAdded: added });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  if (pathname === '/api/xbox/add-folder' && req.method === 'POST') {
    try {
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
        $dialog.Description = "Selecione a pasta onde seus jogos do Xbox Game Pass estão instalados (ex: D:\\XboxGames)"
        $dialog.ShowNewFolderButton = $false
        if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
          Write-Output $dialog.SelectedPath
        }
      `;
      const selectedFolder = await new Promise((resolve) => {
        execFile('powershell.exe', ['-NoProfile', '-Command', psScript], { windowsHide: false }, (err, stdout) => {
          if (!err && stdout) {
            resolve(String(stdout).trim());
          } else {
            resolve(null);
          }
        });
      });

      if (!selectedFolder || !fs.existsSync(selectedFolder)) {
        return sendJson(res, 200, { ok: false, message: 'Nenhuma pasta selecionada.' });
      }

      if (!config.customXboxFolders) config.customXboxFolders = [];
      if (!config.customXboxFolders.includes(selectedFolder)) {
        config.customXboxFolders.push(selectedFolder);
        saveConfig(config);
      }

      // Re-scan with newly added folder
      const discovered = await downloadsEngine.scanGogAndXboxGames();
      return sendJson(res, 200, { ok: true, folder: selectedFolder, totalDiscovered: discovered.length });
    } catch (e) {
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  if (pathname === '/api/config/startup' && req.method === 'POST') {
    const body = await readBody(req);
    const enabled = Boolean(body.enabled);
    const launchMinimized = Boolean(body.launchMinimized);
    await downloadsEngine.setWindowsAutoLaunch(enabled, launchMinimized);
    db.config.launchOnStartup = enabled;
    db.config.launchMinimized = launchMinimized;
    saveDb(db);
    return sendJson(res, 200, { ok: true, launchOnStartup: enabled, launchMinimized });
  }

  if (pathname === '/api/quit' && req.method === 'POST') {
    sendJson(res, 200, { quitting: true });
    setTimeout(() => process.exit(0), 200);
    return;
  }

  if (pathname === '/api/window-closed' && req.method === 'POST') {
    sendJson(res, 200, { scheduled: true });
    if (shutdownTimer) clearTimeout(shutdownTimer);
    shutdownTimer = setTimeout(() => {
      if (!activeSession) {
        process.exit(0);
      }
    }, 3500);
    return;
  }

  // Serve covers from root covers/ folder
  if (pathname.startsWith('/covers/') && req.method === 'GET') {
    const relPath = decodeURIComponent(pathname.slice('/covers/'.length));
    const rootCovers = path.join(APP_ROOT, 'covers');
    const fullPath = path.join(rootCovers, relPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      const mime = ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=31536000, immutable'
      });
      return fs.createReadStream(fullPath).pipe(res);
    }
  }

  // Serve media cache (covers, thumbs in .webp)
  if (pathname.startsWith('/media/') && req.method === 'GET') {
    const relPath = decodeURIComponent(pathname.slice('/media/'.length));
    const fullPath = path.join(MEDIA_DIR, relPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      const mime = ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'public, max-age=31536000, immutable'
      });
      return fs.createReadStream(fullPath).pipe(res);
    }
  }

  // Serve local files (artwork, video previews)
  if (pathname === '/local-file' && req.method === 'GET') {
    const filePath = urlObj.searchParams.get('path');
    if (!filePath || !fs.existsSync(filePath)) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.mp4' ? 'video/mp4' : 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=86400'
    });
    return fs.createReadStream(filePath).pipe(res);
  }

  // Serve UI static files
  let uiFile = pathname === '/' ? 'index.html' : pathname.slice(1);
  const fullUiPath = path.join(UI_DIR, uiFile);
  if (fs.existsSync(fullUiPath) && fs.statSync(fullUiPath).isFile()) {
    const ext = path.extname(fullUiPath).toLowerCase();
    const mime = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.css' ? 'text/css; charset=utf-8' : ext === '.js' ? 'application/javascript; charset=utf-8' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    return fs.createReadStream(fullUiPath).pipe(res);
  }

  res.writeHead(404);
  res.end('Not found');
});

const PORT = 38475;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`HydraRetro Backend listening on http://127.0.0.1:${PORT}`);

  // Non-blocking initial scan and watcher initialization
  setImmediate(async () => {
    try {
      const initialScan = await scanLibrary();
      console.log(`HydraRetro scanned library: ${initialScan.totalGames} games (${initialScan.newGamesCount} new).`);
    } catch (e) {
      console.error('Error during initial library scan:', e);
    }

    // Auto-watch ROM directories for hot-plugging new ROMs
    for (const [cid, cCfg] of Object.entries(db.config.consoles)) {
      if (['STEAM', 'EPIC'].includes(cid)) continue;
      if (cCfg.romFolder && fs.existsSync(cCfg.romFolder)) {
        let debounceTimer = null;
        fs.watch(cCfg.romFolder, () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(async () => {
            console.log(`Detected change in ${cid} ROM folder, rescanning...`);
            await scanLibrary();
          }, 1500);
        });
      }
    }

    // Auto-watch configured PC Game folders
    if (Array.isArray(db.config.pcGameFolders)) {
      for (const pf of db.config.pcGameFolders) {
        if (pf && fs.existsSync(pf)) {
          let debounceTimer = null;
          fs.watch(pf, () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(async () => {
              console.log(`Detected change in PC game folder (${pf}), rescanning...`);
              await scanLibrary();
            }, 1500);
          });
        }
      }
    }
  });
});
