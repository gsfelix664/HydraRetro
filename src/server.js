
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
const UI_DIR = fs.existsSync(path.join(APP_ROOT, 'ui'))
  ? path.join(APP_ROOT, 'ui')
  : path.join(__dirname, 'ui');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const PS1_META_FILE = path.join(DATA_DIR, 'ps1_hydra_metadata.json');
const GAMES_META_FILE = path.join(DATA_DIR, 'games_metadata.json');
const ROMS_DIR = path.join(APP_ROOT, 'ROMS');
const BIOS_DIR = path.join(APP_ROOT, 'BIOS');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(ROMS_DIR, 'PS1'), { recursive: true });
fs.mkdirSync(path.join(ROMS_DIR, 'GENESIS'), { recursive: true });
fs.mkdirSync(path.join(ROMS_DIR, 'SNES'), { recursive: true });
fs.mkdirSync(path.join(ROMS_DIR, 'MAME'), { recursive: true });
fs.mkdirSync(path.join(ROMS_DIR, 'PS2'), { recursive: true });
fs.mkdirSync(path.join(ROMS_DIR, 'WII'), { recursive: true });
fs.mkdirSync(path.join(ROMS_DIR, 'GC'), { recursive: true });
fs.mkdirSync(path.join(ROMS_DIR, 'PSP'), { recursive: true });
fs.mkdirSync(path.join(ROMS_DIR, 'PS3'), { recursive: true });
fs.mkdirSync(path.join(ROMS_DIR, 'N64'), { recursive: true });
fs.mkdirSync(path.join(ROMS_DIR, 'GBA'), { recursive: true });
fs.mkdirSync(path.join(ROMS_DIR, 'GBC'), { recursive: true });
fs.mkdirSync(path.join(ROMS_DIR, 'GB'), { recursive: true });
fs.mkdirSync(BIOS_DIR, { recursive: true });

const DEFAULT_CONFIG = {
  romsRoot: ROMS_DIR,
  biosRoot: BIOS_DIR,
  coinOpsRoot: 'C:\\games\\CoinOPS Next 2',
  raUsername: '',
  raWebApiKey: '',
  steamGridDbApiKey: '',
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
      coinOpsCollection: 'PlayStation 1 Official',
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
      coinOpsCollection: 'Genesis Official',
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
      coinOpsCollection: 'Super Nintendo',
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
      coinOpsCollection: 'Arcade',
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
      coinOpsCollection: 'PlayStation 2 Official',
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
      coinOpsCollection: 'Nintendo Wii',
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
      coinOpsCollection: 'Nintendo GameCube',
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
      coinOpsCollection: 'Sony PSP Official',
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
      coinOpsCollection: 'PlayStation 3',
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
      coinOpsCollection: 'Nintendo 64',
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
      coinOpsCollection: 'Game Boy Advance',
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
      coinOpsCollection: 'Game Boy Color',
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
      coinOpsCollection: 'Game Boy',
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

function findLocalArtwork(romFolder, baseName, cleanTitleStr) {
  if (!romFolder || !fs.existsSync(romFolder)) return null;
  const exts = ['.png', '.jpg', '.jpeg', '.webp'];
  const dirs = [romFolder, path.join(romFolder, 'covers'), path.join(romFolder, 'Named_Boxarts'), path.join(romFolder, 'art')];
  const names = [baseName, cleanTitleStr];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of names) {
      if (!name) continue;
      for (const ext of exts) {
        const full = path.join(dir, name + ext);
        if (fs.existsSync(full)) {
          return `/local-file?path=${encodeURIComponent(full)}`;
        }
      }
    }
  }
  return null;
}

function coinOpsArtwork(collection, type, baseName) {
  const p = path.join(db.config.coinOpsRoot, 'collections', collection, 'medium_artwork', type, `${baseName}.png`);
  if (fs.existsSync(p)) {
    return `/local-file?path=${encodeURIComponent(p)}`;
  }
  return null;
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
      const localCover = findLocalArtwork(cCfg.romFolder, primaryBase, g.title) || coinOpsArtwork(cCfg.coinOpsCollection, 'cover', primaryBase);
      const localLogo = coinOpsArtwork(cCfg.coinOpsCollection, 'logo', primaryBase);
      const localVideo = (() => {
        const vp = path.join(db.config.coinOpsRoot, 'collections', cCfg.coinOpsCollection, 'medium_artwork', 'video', `${primaryBase}.mp4`);
        return fs.existsSync(vp) ? `/local-file?path=${encodeURIComponent(vp)}` : null;
      })();

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
      const rating = curated?.rating || 4.8;

      if (existing?.steamGridData) {
        if (existing.steamGridData.coverUrl) coverUrl = existing.steamGridData.coverUrl;
        if (existing.steamGridData.heroUrl) heroUrl = existing.steamGridData.heroUrl;
        if (existing.steamGridData.logoUrl) logoUrl = existing.steamGridData.logoUrl;
      }

      if (!existing) {
        db.games[groupId] = {
          id: groupId,
          consoleId,
          title: g.title,
          sortTitle: g.title.replace(/^The\s+/i, ''),
          romPath: primary.path,
          fileName: primary.fileName,
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
          steamGridData: null
        };
        newGamesCount++;
      } else {
        existing.romPath = primary.path;
        existing.fileName = primary.fileName;
        existing.discs = g.discs;
        existing.sizeBytes = g.discs.reduce((acc, d) => acc + d.sizeBytes, 0);
        existing.coverUrl = coverUrl;
        existing.coverCandidates = coverCandidates;
        existing.fallbackCoverUrl = localCover;
        existing.heroUrl = heroUrl;
        existing.heroCandidates = heroCandidates;
        existing.logoUrl = logoUrl;
        existing.logoCandidates = logoCandidates;
        existing.fallbackLogoUrl = localLogo;
        existing.videoUrl = localVideo;
        existing.description = description;
        existing.developer = developer;
        existing.publisher = publisher;
        existing.releaseYear = releaseYear;
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
  return { totalGames: Object.keys(db.games).length, newGamesCount };
}

// Generate deterministic RetroAchievements / Classic Milestones for any game + support real RetroAchievements API
// Only return real achievements if synced from RetroAchievements API (no hardcoded fake achievements)
function getGameAchievements(game) {
  if (game.raAchievements && Array.isArray(game.raAchievements) && game.raAchievements.length > 0) {
    return game.raAchievements;
  }
  return [];
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

  child.on('exit', () => {
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

  if (pathname === '/api/config' && req.method === 'POST') {
    const body = await readBody(req);
    if (body.raUsername !== undefined) db.config.raUsername = body.raUsername;
    if (body.raWebApiKey !== undefined) db.config.raWebApiKey = body.raWebApiKey;
    if (body.steamGridDbApiKey !== undefined) db.config.steamGridDbApiKey = body.steamGridDbApiKey.trim();
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
