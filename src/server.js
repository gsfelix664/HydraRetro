
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
const ROMS_DIR = path.join(APP_ROOT, 'ROMS');
const BIOS_DIR = path.join(APP_ROOT, 'BIOS');
const BACKUPS_DIR = path.join(APP_ROOT, 'backups', 'saves');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(BIOS_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });
fs.mkdirSync(COVERS_DIR, { recursive: true });
fs.mkdirSync(THUMBS_DIR, { recursive: true });
fs.mkdirSync(BACKUPS_DIR, { recursive: true });

const CONSOLE_LIST = ['SNES', 'GENESIS', 'PS1', 'PS2', 'MAME', 'N64', 'GBA', 'GBC', 'GB', 'PSP', 'WII', 'GC', 'PS3'];
for (const cid of CONSOLE_LIST) {
  fs.mkdirSync(path.join(ROMS_DIR, cid), { recursive: true });
  fs.mkdirSync(path.join(COVERS_DIR, cid.toLowerCase()), { recursive: true });
  fs.mkdirSync(path.join(THUMBS_DIR, cid.toLowerCase()), { recursive: true });
}

const DEFAULT_CONFIG = {
  romsRoot: ROMS_DIR,
  biosRoot: BIOS_DIR,
  raUsername: '',
  raWebApiKey: '',
  steamGridDbApiKey: '',
  ssUsername: '',
  ssPassword: '',
  ssDevId: '',
  ssDevPassword: '',
  ssSoftName: 'HydraRetro',
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
      if (!c.romFolder || !fs.existsSync(c.romFolder)) {
        if (def && def.romFolder) c.romFolder = def.romFolder;
      }
      if (!c.emulatorPath || !fs.existsSync(c.emulatorPath)) {
        if (def && def.emulatorPath) c.emulatorPath = def.emulatorPath;
      }
      if (def && def.corePath && (!c.corePath || !fs.existsSync(c.corePath))) {
        c.corePath = def.corePath;
      }
    }
  }

  return db;
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

let db = loadDb();
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

function computeRomCrc32(filePath, maxBytes = 32 * 1024 * 1024) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.zip') {
      const fd = fs.openSync(filePath, 'r');
      const buf = Buffer.alloc(64);
      fs.readSync(fd, buf, 0, 64, 0);
      fs.closeSync(fd);
      if (buf.readUInt32LE(0) === 0x04034b50) {
        return buf.readUInt32LE(14).toString(16).toUpperCase().padStart(8, '0');
      }
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
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(512);
    fs.readSync(fd, buf, 0, 512, 0);
    fs.closeSync(fd);
    if (buf.readUInt32LE(0) !== 0x04034b50) return null;
    const nameLen = buf.readUInt16LE(26);
    const fileName = buf.toString('utf8', 30, 30 + nameLen);
    return path.basename(fileName, path.extname(fileName));
  } catch {
    return null;
  }
}

function getArtworkCandidates(primaryBase, innerBase, cleanTitleStr) {
  const candidates = new Set();

  // Common region suffix patterns on Libretro Thumbnails
  // (USA) and (World) are the most frequent by far
  const regions = [
    '(USA)',
    '(World)',
    '(USA, Europe)',
    '(Europe)',
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
    for (const r of regions) {
      candidates.add(r ? `${cleanTitleStr} ${r}` : cleanTitleStr);
    }
  }

  // Also normalize short region tags in filename: (U) -> (USA), (E) -> (Europe)
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
  if (normBase) candidates.add(normBase);

  if (innerBase) candidates.add(innerBase);
  candidates.add(primaryBase);

  return Array.from(candidates);
}

function findLocalArtwork(romFolder, baseName, cleanTitleStr, consoleId) {
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

    // Normalized match against files in directory
    try {
      const files = fs.readdirSync(dir);
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
  GB: 9
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

async function testScreenScraperAuth(config) {
  const devId = (config.ssDevId || '').trim();
  const devPass = (config.ssDevPassword || '').trim();
  const user = (config.ssUsername || '').trim();
  const pass = (config.ssPassword || '').trim();
  const soft = config.ssSoftName || 'HydraRetro';

  if (!devId || !devPass) {
    return { ok: false, error: 'Dev ID e Dev Password são necessários para acessar a API do ScreenScraper' };
  }

  let url = `https://api.screenscraper.fr/api2/ssuserInfos.php?devid=${encodeURIComponent(devId)}&devpassword=${encodeURIComponent(devPass)}&softname=${encodeURIComponent(soft)}&output=json`;
  if (user) url += `&ssid=${encodeURIComponent(user)}`;
  if (pass) url += `&sspassword=${encodeURIComponent(pass)}`;

  try {
    const res = await fetchWithTimeout(url, 8000);
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { data = null; }
    if (data && data.ssuser) {
      return {
        ok: true,
        user: data.ssuser.id || user,
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

async function fetchScreenScraperGame(game, queryTitle = null) {
  const devId = (db.config.ssDevId || '').trim();
  const devPass = (db.config.ssDevPassword || '').trim();
  const user = (db.config.ssUsername || '').trim();
  const pass = (db.config.ssPassword || '').trim();
  const soft = db.config.ssSoftName || 'HydraRetro';

  if (!devId || !devPass) return null;

  const sysId = SCREENSCRAPER_SYSTEMS[game.consoleId];
  if (!sysId) return null;

  const authParams = `devid=${encodeURIComponent(devId)}&devpassword=${encodeURIComponent(devPass)}&softname=${encodeURIComponent(soft)}&output=json` +
    (user ? `&ssid=${encodeURIComponent(user)}` : '') +
    (pass ? `&sspassword=${encodeURIComponent(pass)}` : '');

  // 1. Try jeuInfos.php by ROM name and CRC
  try {
    const primary = (game.discs && game.discs[0]) ? game.discs[0] : { path: game.romPath, fileName: game.fileName || path.basename(game.romPath) };
    let infoUrl = `https://api.screenscraper.fr/api2/jeuInfos.php?${authParams}&systemeid=${sysId}&romnom=${encodeURIComponent(primary.fileName)}`;
    if (game.crc32) {
      infoUrl += `&crc=${encodeURIComponent(game.crc32.toUpperCase())}`;
    }
    const r = await fetchWithTimeout(infoUrl, 8000);
    if (r.ok) {
      const data = await r.json();
      if (data && data.response && data.response.jeu) {
        return data.response.jeu;
      }
    }
  } catch {}

  // 2. Fallback to jeuRecherche.php by search title
  try {
    const searchStr = (queryTitle || cleanTitle(game.title)).trim();
    if (searchStr) {
      const searchUrl = `https://api.screenscraper.fr/api2/jeuRecherche.php?${authParams}&systemeid=${sysId}&recherche=${encodeURIComponent(searchStr)}`;
      const r2 = await fetchWithTimeout(searchUrl, 8000);
      if (r2.ok) {
        const data2 = await r2.json();
        if (data2 && data2.response && Array.isArray(data2.response.jeux) && data2.response.jeux.length > 0) {
          return data2.response.jeux[0];
        }
      }
    }
  } catch {}

  return null;
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

function scanLibrary() {
  const foundKeys = new Set();
  let newGamesCount = 0;

  for (const [consoleId, cCfg] of Object.entries(db.config.consoles)) {
    if (!cCfg.romFolder || !fs.existsSync(cCfg.romFolder)) continue;
    const files = fs.readdirSync(cCfg.romFolder);
    const fileSet = new Set(files);
    const extSet = new Set((cCfg.extensions || []).map(e => e.toLowerCase()));

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

    for (const [groupId, g] of groups.entries()) {
      foundKeys.add(groupId);
      g.discs.sort((a, b) => a.fileName.localeCompare(b.fileName));
      const primary = g.discs[0];
      const primaryBase = path.basename(primary.fileName, path.extname(primary.fileName));

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

      const existing = db.games[groupId];
      const localCover = findLocalArtwork(cCfg.romFolder, primaryBase, g.title, consoleId);
      const localLogo = null;
      const localVideo = null;

      const innerBase = path.extname(primary.fileName).toLowerCase() === '.zip'
        ? getZipFirstEntry(primary.path)
        : null;

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
        GB: 'Nintendo'
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
        GB: ['Game Boy', 'Portátil Clássico']
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

      const crc32 = computeRomCrc32(primary.path);
      const thumbFile = path.join(THUMBS_DIR, consoleId.toLowerCase(), `${primaryBase}.webp`);
      const thumbUrl = fs.existsSync(thumbFile) ? `/media/thumbs/${consoleId.toLowerCase()}/${encodeURIComponent(primaryBase)}.webp` : null;

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
        existing.coverUrl = existing.customCoverUrl || coverUrl;
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

  // Remove games whose ROMs were deleted from disk
  for (const key of Object.keys(db.games)) {
    if (!foundKeys.has(key)) {
      delete db.games[key];
    }
  }

  saveDb(db);
  enqueueGamesForEnrichment();
  return { totalGames: Object.keys(db.games).length, newGamesCount };
}

// Generate deterministic RetroAchievements / Classic Milestones for any game + support real RetroAchievements API
function getGameAchievements(game) {
  if (game.raAchievements && Array.isArray(game.raAchievements) && game.raAchievements.length > 0) {
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

async function searchHowLongToBeat(title) {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  const referer = 'https://howlongtobeat.com/';
  try {
    const initRes = await fetch(`https://howlongtobeat.com/api/search/site/init?t=${Date.now()}`, {
      headers: { 'User-Agent': ua, 'Referer': referer }
    });
    const init = await initRes.json();
    if (!init || !init.token) return null;

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
      return {
        id: g.game_id,
        name: g.game_name,
        mainTime: g.comp_main ? (g.comp_main / 3600).toFixed(1) + 'h' : '--',
        mainExtraTime: g.comp_plus ? (g.comp_plus / 3600).toFixed(1) + 'h' : '--',
        completionistTime: g.comp_100 ? (g.comp_100 / 3600).toFixed(1) + 'h' : '--',
        allStylesTime: g.comp_all ? (g.comp_all / 3600).toFixed(1) + 'h' : '--',
        reviewScore: g.review_score,
        platforms: g.profile_platform ? g.profile_platform.split(', ') : [],
        imageUrl: g.game_image ? `https://howlongtobeat.com/games/${g.game_image}` : null,
        url: `https://howlongtobeat.com/game/${g.game_id}`
      };
    }
  } catch (e) {
    console.error('HLTB Error:', e.message);
  }
  return null;
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
    const isGeneric = !game.description || game.description.startsWith('Um clássico atemporal');
    if (isGeneric && !game.metadataEnriched) {
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
  if (game && (!game.description || game.description.startsWith('Um clássico atemporal'))) {
    try {
      const data = await fetchOnlineMetadata(game.title, game.consoleId);
      if (data) {
        if (data.description) game.description = data.description;
        if (data.developer) game.developer = data.developer;
        if (data.publisher) game.publisher = data.publisher;
        if (data.releaseYear) game.releaseYear = data.releaseYear;
        game.metadataEnriched = true;
        game.metadataSource = data.source;
        saveDb(db);
      }
    } catch {}
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

  const cCfg = db.config.consoles[game.consoleId];
  if (!cCfg) throw new Error('Console não configurado');
  if (!fs.existsSync(cCfg.emulatorPath)) {
    throw new Error(`Emulador não encontrado em: ${cCfg.emulatorPath}`);
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
  } else if (cCfg.corePath) {
    args = ['-f', '-L', cCfg.corePath, targetDisc.path];
  } else {
    args = [targetDisc.path];
  }

  const cwd = path.dirname(cCfg.emulatorPath);
  const child = spawn(cCfg.emulatorPath, args, {
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

// Initial scan at startup
const initialScan = scanLibrary();
console.log(`HydraRetro scanned library: ${initialScan.totalGames} games (${initialScan.newGamesCount} new).`);

// Auto-watch ROM directories for hot-plugging new ROMs
for (const [cid, cCfg] of Object.entries(db.config.consoles)) {
  if (cCfg.romFolder && fs.existsSync(cCfg.romFolder)) {
    let debounceTimer = null;
    fs.watch(cCfg.romFolder, () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log(`Detected change in ${cid} ROM folder, rescanning...`);
        scanLibrary();
      }, 1500);
    });
  }
}

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
      ...g,
      achievements: getGameAchievements(g)
    }));
    const totalPlayTimeSeconds = gamesList.reduce((acc, g) => acc + (g.playTimeSeconds || 0), 0);
    return sendJson(res, 200, {
      config: db.config,
      games: gamesList,
      sessions: db.sessions.slice(0, 30),
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
        playedCount: gamesList.filter(g => (g.playCount || 0) > 0).length
      }
    });
  }

  if (pathname === '/api/scan' && req.method === 'POST') {
    const result = scanLibrary();
    return sendJson(res, 200, result);
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
    if (!key) {
      return sendJson(res, 400, { error: 'Chave da API SteamGridDB não configurada. Adicione sua API Key nas Configurações!' });
    }

    if (body.gameId) {
      const g = db.games[body.gameId];
      if (!g) return sendJson(res, 404, { error: 'Jogo não encontrado' });
      const sgRes = await fetchSteamGridDb(cleanTitle(g.title), key);
      if (!sgRes) return sendJson(res, 404, { error: `Nenhuma arte encontrada no SteamGridDB para "${g.title}"` });
      if (sgRes.coverUrl) g.coverUrl = sgRes.coverUrl;
      if (sgRes.heroUrl) g.heroUrl = sgRes.heroUrl;
      if (sgRes.logoUrl) g.logoUrl = sgRes.logoUrl;
      g.steamGridData = sgRes;
      saveDb(db);
      return sendJson(res, 200, { ok: true, game: g });
    } else {
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

    const hltb = await searchHowLongToBeat(title);
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
      return sendJson(res, 200, { ok: true, game, cached: true });
    }

    // ScreenScraper metadata enrichment
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
        }
      } catch {}
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
      return sendJson(res, 200, { ok: true, game, enriched: true });
    } else if (game.metadataEnriched) {
      saveDb(db);
      return sendJson(res, 200, { ok: true, game, enriched: true });
    }

    return sendJson(res, 200, { ok: false, game, message: 'Nenhum metadado adicional encontrado' });
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
    if (body.ssUsername !== undefined) db.config.ssUsername = body.ssUsername.trim();
    if (body.ssPassword !== undefined) db.config.ssPassword = body.ssPassword;
    if (body.ssDevId !== undefined) db.config.ssDevId = body.ssDevId.trim();
    if (body.ssDevPassword !== undefined) db.config.ssDevPassword = body.ssDevPassword;
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

  if (pathname === '/api/covers/list' && req.method === 'GET') {
    const gameId = urlObj.searchParams.get('gameId');
    const game = gameId ? db.games[gameId] : null;
    if (!game) {
      return sendJson(res, 404, { error: 'Jogo não encontrado' });
    }

    const covers = [];
    const seenUrls = new Set();
    const cCfg = db.config.consoles[game.consoleId] || {};
    const primary = (game.discs && game.discs[0]) ? game.discs[0] : { path: game.romPath, fileName: game.fileName };
    const primaryBase = path.basename(primary.fileName, path.extname(primary.fileName));
    const cleanT = cleanTitle(game.title);

    // 1. Current Active Cover
    if (game.coverUrl) {
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

    // 2. Local covers in covers/ and media/covers/<consoleId>/
    const checkCoverDirs = [
      { dir: path.join(COVERS_DIR, game.consoleId.toLowerCase()), prefix: `/media/covers/${game.consoleId.toLowerCase()}` },
      { dir: path.join(APP_ROOT, 'covers', game.consoleId.toLowerCase()), prefix: `/covers/${game.consoleId.toLowerCase()}` },
      { dir: path.join(APP_ROOT, 'covers'), prefix: '/covers' },
      { dir: COVERS_DIR, prefix: '/media/covers' }
    ];

    const normClean = cleanT.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normBase = primaryBase.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normQuery = (urlObj.searchParams.get('q') || '').toLowerCase().replace(/[^a-z0-9]/g, '');

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

    // 3. Local covers in ROM folder or adjacent folders
    const romLocal = findLocalArtwork(cCfg.romFolder, primaryBase, cleanT, game.consoleId);
    if (romLocal && !seenUrls.has(romLocal)) {
      seenUrls.add(romLocal);
      covers.push({
        id: 'rom_folder_cover',
        type: 'local_rom',
        label: 'Pasta de ROMs (Local)',
        url: romLocal,
        thumbUrl: romLocal,
        isLocal: true
      });
    }

    // 4. ScreenScraper Covers (if configured)
    if (db.config.ssDevId && db.config.ssDevPassword) {
      try {
        const ssGame = await fetchScreenScraperGame(game, querySearch);
        if (ssGame && Array.isArray(ssGame.medias)) {
          for (const m of ssGame.medias) {
            if (m.type === 'box-2D' || m.type === 'box-3D') {
              const reg = (m.region || 'Global').toUpperCase();
              const tagType = m.type === 'box-3D' ? '3D' : '2D';
              const mUrl = m.url;
              if (mUrl && !seenUrls.has(mUrl)) {
                seenUrls.add(mUrl);
                covers.push({
                  id: `ss_${m.type}_${m.region || 'def'}_${covers.length}`,
                  type: 'screenscraper',
                  label: `ScreenScraper ${tagType} (${reg})`,
                  url: mUrl,
                  thumbUrl: mUrl
                });
              }
            }
          }
        }
      } catch (err) {
        console.error('ScreenScraper covers query error:', err.message);
      }
    }

    // 5. Libretro Boxart Candidates (by region)
    if (Array.isArray(game.coverCandidates)) {
      game.coverCandidates.forEach((candUrl, idx) => {
        if (candUrl && !seenUrls.has(candUrl)) {
          seenUrls.add(candUrl);
          let regLabel = 'Libretro CDN';
          if (candUrl.includes('%28USA%29') || candUrl.includes('(USA)')) regLabel = 'Libretro CDN (USA)';
          else if (candUrl.includes('%28World%29') || candUrl.includes('(World)')) regLabel = 'Libretro CDN (World)';
          else if (candUrl.includes('%28Europe%29') || candUrl.includes('(Europe)')) regLabel = 'Libretro CDN (Europe)';
          else if (candUrl.includes('%28Japan%29') || candUrl.includes('(Japan)')) regLabel = 'Libretro CDN (Japan)';
          else if (candUrl.includes('%28Brazil%29') || candUrl.includes('(Brazil)')) regLabel = 'Libretro CDN (Brasil)';
          covers.push({
            id: `libretro_${idx}`,
            type: 'libretro',
            label: regLabel,
            url: candUrl,
            thumbUrl: candUrl
          });
        }
      });
    }

    // 6. SteamGridDB HD alternatives
    const sgKey = db.config.steamGridDbApiKey;
    if (sgKey) {
      const sgGrids = await fetchSteamGridDbGrids(cleanT, sgKey);
      for (const grid of sgGrids) {
        if (!seenUrls.has(grid.url)) {
          seenUrls.add(grid.url);
          covers.push(grid);
        }
      }
    }

    return sendJson(res, 200, {
      gameId: game.id,
      title: game.title,
      consoleId: game.consoleId,
      currentCover: game.coverUrl,
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
      if (chosenUrl.startsWith('http://') || chosenUrl.startsWith('https://')) {
        const consoleSub = game.consoleId.toLowerCase();
        const destFolder = path.join(COVERS_DIR, consoleSub);
        fs.mkdirSync(destFolder, { recursive: true });

        const safeTitle = cleanTitle(game.title).replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
        const ext = chosenUrl.toLowerCase().includes('.png') ? '.png' : (chosenUrl.toLowerCase().includes('.webp') ? '.webp' : '.jpg');
        const fileName = `${safeTitle}_${Date.now()}${ext}`;
        const destPath = path.join(destFolder, fileName);

        await downloadImage(chosenUrl, destPath);
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
});
