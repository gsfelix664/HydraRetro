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
const UI_DIR = path.join(APP_ROOT, 'ui');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const PS1_META_FILE = path.join(DATA_DIR, 'ps1_hydra_metadata.json');
const ROMS_DIR = path.join(APP_ROOT, 'ROMS');
const BIOS_DIR = path.join(APP_ROOT, 'BIOS');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(ROMS_DIR, 'PS1'), { recursive: true });
fs.mkdirSync(path.join(ROMS_DIR, 'GENESIS'), { recursive: true });
fs.mkdirSync(BIOS_DIR, { recursive: true });

const DEFAULT_CONFIG = {
  romsRoot: ROMS_DIR,
  biosRoot: BIOS_DIR,
  coinOpsRoot: 'C:\\games\\CoinOPS Next 2',
  raUsername: '',
  raWebApiKey: '',
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

let activeSession = null;
let shutdownTimer = null;

function cleanTitle(rawName) {
  return rawName
    .replace(/\s*\((Disc|Disco)\s*\d+\).*$/i, '')
    .replace(/\s*\[Arcade Disc\]/i, '')
    .replace(/\s*\(Evolution Disc\)/i, '')
    .replace(/\s*\((USA|Europe|Japan|World|Brazil|Asia|Korea|Unl|Rev\s*[A-Z0-9]+|Alt\s*[0-9]*|Beta|Proto|Virtual Console|Sega Channel|Switch Online|Arcade Mode|Simulation Mode|Translated[^)]*)[^)]*\)/gi, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .trim() || rawName;
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
  if (innerBase) candidates.add(innerBase);
  candidates.add(primaryBase);

  // Common region suffix patterns on Libretro Thumbnails
  const regions = [
    '(World)',
    '(USA, Europe)',
    '(USA)',
    '(Europe)',
    '(World) (Rev A)',
    '(World) (Rev 1)',
    '(USA, Europe) (Rev A)',
    '(USA) (Rev A)',
    '(Europe) (Rev A)',
    '(Japan, USA)',
    '(Japan, Europe)',
    '(Japan)',
    '(Brazil)',
    ''
  ];

  for (const r of regions) {
    const str = r ? `${cleanTitleStr} ${r}` : cleanTitleStr;
    candidates.add(str);
  }

  return Array.from(candidates);
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
      const title = (hydraMeta && hydraMeta.title) ? hydraMeta.title : cleanTitle(baseName);
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

      const existing = db.games[groupId];
      const localCover = coinOpsArtwork(cCfg.coinOpsCollection, 'cover', primaryBase);
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

      if (g.hydraMeta) {
        coverUrl = g.hydraMeta.coverImageUrl || g.hydraMeta.iconUrl || localCover;
        heroUrl = g.hydraMeta.heroImageUrl || localCover;
        logoUrl = g.hydraMeta.logoImageUrl || localLogo;
      } else {
        coverUrl = libretroUrl(cCfg.libretroThumbRepo, 'Named_Boxarts', effectiveBase);
        heroUrl = libretroUrl(cCfg.libretroThumbRepo, 'Named_Snaps', effectiveBase);
        logoUrl = localLogo || libretroUrl(cCfg.libretroThumbRepo, 'Named_Titles', effectiveBase);
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
          achievements: null
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
function getGameAchievements(game) {
  const playSec = game.playTimeSeconds || 0;
  const playCount = game.playCount || 0;
  const isFav = Boolean(game.favorite);

  const builtIn = [
    {
      id: 'first_boot',
      title: 'Ficha Inserida!',
      description: `Iniciou ${game.title} pela primeira vez.`,
      points: 10,
      unlocked: playCount >= 1,
      icon: '🎮'
    },
    {
      id: 'play_15m',
      title: 'Aquecendo os Controles',
      description: 'Jogou por pelo menos 15 minutos acumulados.',
      points: 25,
      unlocked: playSec >= 900,
      icon: '⚡'
    },
    {
      id: 'play_1h',
      title: 'Clássico Viciante',
      description: 'Completou 1 hora de gameplay neste clássico.',
      points: 50,
      unlocked: playSec >= 3600,
      icon: '🔥'
    },
    {
      id: 'play_5h',
      title: 'Mestre da Locadora',
      description: 'Acumulou mais de 5 horas dominando este jogo.',
      points: 100,
      unlocked: playSec >= 18000,
      icon: '👑'
    },
    {
      id: 'veteran_sessions',
      title: 'Frequência Garantida',
      description: 'Abriu este jogo em 5 sessões diferentes.',
      points: 30,
      unlocked: playCount >= 5,
      icon: '🕹️'
    },
    {
      id: 'favorite_star',
      title: 'Relíquia Favorita',
      description: 'Marcou este clássico na sua coleção de Favoritos.',
      points: 15,
      unlocked: isFav,
      icon: '⭐'
    }
  ];

  return builtIn;
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
  } else if (game.consoleId === 'GENESIS') {
    args = ['-L', cCfg.corePath, targetDisc.path];
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

  if (pathname === '/api/config' && req.method === 'POST') {
    const body = await readBody(req);
    if (body.raUsername !== undefined) db.config.raUsername = body.raUsername;
    if (body.raWebApiKey !== undefined) db.config.raWebApiKey = body.raWebApiKey;
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
