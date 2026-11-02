/**
 * HydraRetro — Unified Achievements Engine
 * Ported from Hydra Launcher Original (C:\PROJETOS\HydraLaucher):
 *  - src/main/services/achievements/get-game-achievement-data.ts (Hydra API Official Achievements in PT-BR)
 *  - src/main/services/achievements/find-achievement-files.ts (13 PC/Steam/Cracker local locations)
 *  - src/main/services/achievements/parse-achievement-file.ts & parse-achievement-formats.ts
 *  - src/main/services/retro-achievements/retro-achievements-client.ts & retro-achievements-sync.ts
 *  - src/main/services/retro-achievements/retro-achievements-emulator-account.ts
 *  - src/main/services/retro-achievements/emulator-credentials/emulator-credential-config.ts & sync.ts
 *  - src/main/services/emulators/emulator-achievement-log.ts (Real-time stdout log unlock parser)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const HYDRA_API_URL = 'https://hydra-api-us-east-1.losbroxas.org';
const RETROACHIEVEMENTS_API_URL = 'https://retroachievements.org/API';
const RETROACHIEVEMENTS_DOREQUEST_URL = 'https://retroachievements.org/dorequest.php';

const BYTE_ORDER_MARK = 0xfeff;
const MICROSECOND_TIMESTAMP_LENGTH = 7;
const UNLOCKED_PATTERN = /\bunlocked\s*=\s*true\b/i;
const UNLOCK_TIME_PATTERN = /(?:^|[{,\s])time\s*=\s*(\d+)/i;

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

// ============================================================================
// 1. PC / STEAM / CRACKER ACHIEVEMENT FILE PARSERS (Ported from parse-achievement-formats.ts)
// ============================================================================

function readFileLines(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const withoutBom = fileContent.codePointAt(0) === BYTE_ORDER_MARK
    ? fileContent.slice(1)
    : fileContent;
  return withoutBom.split(/[\r\n]+/);
}

function parseUnlockTime(unlockTime) {
  if (!unlockTime) return Date.now();
  const num = Number(unlockTime);
  if (Number.isNaN(num) || num <= 0) return Date.now();
  return typeof unlockTime === 'string' && unlockTime.length === MICROSECOND_TIMESTAMP_LENGTH
    ? num * 1000 * 1000
    : (num < 10000000000 ? num * 1000 : num);
}

function iniParse(filePath) {
  const lines = readFileLines(filePath);
  let objectName = '';
  const object = {};

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine.length || trimmedLine.startsWith('#') || trimmedLine.startsWith(';')) {
      continue;
    }
    if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
      objectName = trimmedLine.slice(1, -1);
      object[objectName] = {};
      continue;
    }
    if (!object[objectName]) object[objectName] = {};
    const [name, ...value] = trimmedLine.split('=');
    if (name) {
      object[objectName][name.trim()] = value.join('=').trim();
    }
  }
  return object;
}

function jsonParse(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const withoutBom = raw.codePointAt(0) === BYTE_ORDER_MARK ? raw.slice(1) : raw;
  return JSON.parse(withoutBom);
}

function processDefault(unlockedAchievements, achievedKey = 'Achieved', unlockTimeKey = 'UnlockTime') {
  const list = [];
  if (!unlockedAchievements || typeof unlockedAchievements !== 'object') return list;
  for (const achievement of Object.keys(unlockedAchievements)) {
    const item = unlockedAchievements[achievement];
    if (item && (item[achievedKey] == '1' || item[achievedKey] == 'true' || item.achieved == '1')) {
      list.push({
        name: achievement,
        unlockTime: parseUnlockTime(item[unlockTimeKey] || item.unlockTime || item.TimeUnlocked)
      });
    }
  }
  return list;
}

function processGoldberg(unlockedAchievements) {
  const list = [];
  if (!unlockedAchievements) return list;

  if (Array.isArray(unlockedAchievements)) {
    for (const achievement of unlockedAchievements) {
      if (achievement && achievement.earned) {
        list.push({
          name: achievement.name,
          unlockTime: parseUnlockTime(achievement.earned_time)
        });
      }
    }
    return list;
  }

  for (const achievement of Object.keys(unlockedAchievements)) {
    const item = unlockedAchievements[achievement];
    if (item && item.earned) {
      list.push({
        name: achievement,
        unlockTime: parseUnlockTime(item.earned_time)
      });
    }
  }
  return list;
}

function processOnlineFix(unlockedAchievements) {
  const list = [];
  if (!unlockedAchievements || typeof unlockedAchievements !== 'object') return list;
  for (const achievement of Object.keys(unlockedAchievements)) {
    const item = unlockedAchievements[achievement];
    if (item && (String(item.achieved).toLowerCase() === 'true' || item.achieved == '1')) {
      list.push({
        name: achievement,
        unlockTime: parseUnlockTime(item.timestamp)
      });
    } else if (item && (String(item.Achieved).toLowerCase() === 'true' || item.Achieved == '1')) {
      list.push({
        name: achievement,
        unlockTime: parseUnlockTime(item.TimeUnlocked)
      });
    }
  }
  return list;
}

function processCreamAPI(unlockedAchievements) {
  const list = [];
  if (!unlockedAchievements || typeof unlockedAchievements !== 'object') return list;
  for (const achievement of Object.keys(unlockedAchievements)) {
    const item = unlockedAchievements[achievement];
    if (item && (String(item.achieved).toLowerCase() === 'true' || item.achieved == '1')) {
      list.push({
        name: achievement,
        unlockTime: parseUnlockTime(item.unlocktime)
      });
    }
  }
  return list;
}

function processSkidrow(unlockedAchievements) {
  const list = [];
  const achievements = unlockedAchievements && unlockedAchievements['Achievements'];
  if (!achievements) return list;
  for (const achievement of Object.keys(achievements)) {
    const parts = String(achievements[achievement]).split('@');
    if (parts[0] === '1') {
      list.push({
        name: achievement,
        unlockTime: parseUnlockTime(parts[parts.length - 1])
      });
    }
  }
  return list;
}

function process3DM(unlockedAchievements) {
  const list = [];
  const achievements = unlockedAchievements && unlockedAchievements['State'];
  const times = unlockedAchievements && unlockedAchievements['Time'];
  if (!achievements) return list;
  for (const achievement of Object.keys(achievements)) {
    if (achievements[achievement] == '0101') {
      let unlockTime = Date.now();
      try {
        const time = times && times[achievement];
        if (time) {
          unlockTime = new DataView(new Uint8Array(Buffer.from(time.toString(), 'hex')).buffer).getUint32(0, true) * 1000;
        }
      } catch {}
      list.push({ name: achievement, unlockTime });
    }
  }
  return list;
}

function processRld(unlockedAchievements) {
  const list = [];
  if (!unlockedAchievements || typeof unlockedAchievements !== 'object') return list;
  for (const achievement of Object.keys(unlockedAchievements)) {
    if (achievement === 'Steam') continue;
    const item = unlockedAchievements[achievement];
    if (item && item.State) {
      try {
        const unlocked = new DataView(new Uint8Array(Buffer.from(item.State.toString(), 'hex')).buffer).getUint32(0, true);
        if (unlocked === 1) {
          const unlockTime = item.Time
            ? new DataView(new Uint8Array(Buffer.from(item.Time.toString(), 'hex')).buffer).getUint32(0, true) * 1000
            : Date.now();
          list.push({ name: achievement, unlockTime });
        }
      } catch {}
    }
  }
  return list;
}

function processUserStats(unlockedAchievements) {
  const list = [];
  const achievements = unlockedAchievements && unlockedAchievements['ACHIEVEMENTS'];
  if (!achievements) return list;
  for (const achievement of Object.keys(achievements)) {
    const raw = String(achievements[achievement]);
    if (!UNLOCKED_PATTERN.test(raw)) continue;
    const unlockTimeMatch = UNLOCK_TIME_PATTERN.exec(raw);
    list.push({
      name: achievement.replace(/"/g, ''),
      unlockTime: unlockTimeMatch ? Number(unlockTimeMatch[1]) * 1000 : Date.now()
    });
  }
  return list;
}

function processRazor1911(filePath) {
  const lines = readFileLines(filePath);
  const list = [];
  for (const line of lines) {
    if (!line.length) continue;
    const [name, unlocked, unlockTime] = line.split(' ');
    if (unlocked === '1' && name) {
      list.push({
        name,
        unlockTime: parseUnlockTime(unlockTime)
      });
    }
  }
  return list;
}

function processFltFolder(filePath) {
  try {
    return fs.readdirSync(filePath).map(achievement => ({
      name: achievement,
      unlockTime: Date.now()
    }));
  } catch {
    return [];
  }
}

function processSteamCacheAchievement(data) {
  const list = [];
  if (!Array.isArray(data)) return list;
  const achievementIndex = data.findIndex(el => Array.isArray(el) && el[0] === 'achievements');
  if (achievementIndex === -1) return list;
  const vecHighlight = data[achievementIndex]?.[1]?.data?.vecHighlight;
  if (!Array.isArray(vecHighlight)) return list;
  for (const ach of vecHighlight) {
    if (ach && ach.bAchieved && ach.strID) {
      list.push({
        name: ach.strID,
        unlockTime: ach.rtUnlocked ? ach.rtUnlocked * 1000 : Date.now()
      });
    }
  }
  return list;
}

const ACHIEVEMENT_PARSERS = {
  codex: (fp) => processDefault(iniParse(fp)),
  rune: (fp) => processDefault(iniParse(fp)),
  onlineFix: (fp) => processOnlineFix(iniParse(fp)),
  goldberg: (fp) => processGoldberg(jsonParse(fp)),
  userstats: (fp) => processUserStats(iniParse(fp)),
  rld: (fp) => processRld(iniParse(fp)),
  skidrow: (fp) => processSkidrow(iniParse(fp)),
  _3dm: (fp) => process3DM(iniParse(fp)),
  ali213: (fp) => processDefault(iniParse(fp), 'HaveAchieved', 'HaveAchievedTime'),
  flt: (fp) => processFltFolder(fp),
  creamAPI: (fp) => processCreamAPI(iniParse(fp)),
   smartSteamEmu: (fp) => processDefault(iniParse(fp)),
  rle: (fp) => processDefault(iniParse(fp)),
  empress: (fp) => processGoldberg(jsonParse(fp)),
  razor1911: (fp) => processRazor1911(fp),
  steamCache: (fp) => processSteamCacheAchievement(jsonParse(fp))
};

// ============================================================================
// 2. FIND & SCAN PC LOCAL ACHIEVEMENT FILES (Ported from find-achievement-files.ts)
// ============================================================================

function getWindowsAchievementSearchLocations(objectId) {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const publicDocs = 'C:\\Users\\Public\\Documents';
  const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
  const userDocs = path.join(os.homedir(), 'Documents');
  const id = String(objectId);

  return [
    // Goldberg SteamEmu
    { type: 'goldberg', filePath: path.join(appData, 'Goldberg SteamEmu Saves', id, 'achievements.json') },
    { type: 'goldberg', filePath: path.join(appData, 'GSE Saves', id, 'achievements.json') },
    { type: 'goldberg', filePath: path.join(localAppData, 'anadius', 'GSE Saves', id, 'achievements.json') },
    // RUNE
    { type: 'rune', filePath: path.join(publicDocs, 'Steam', 'RUNE', id, 'achievements.ini') },
    { type: 'rune', filePath: path.join(appData, 'Steam', 'RUNE', id, 'achievements.ini') },
    // CODEX
    { type: 'codex', filePath: path.join(publicDocs, 'Steam', 'CODEX', id, 'achievements.ini') },
    { type: 'codex', filePath: path.join(appData, 'Steam', 'CODEX', id, 'achievements.ini') },
    // OnlineFix
    { type: 'onlineFix', filePath: path.join(publicDocs, 'OnlineFix', id, 'Stats', 'Achievements.ini') },
    { type: 'onlineFix', filePath: path.join(publicDocs, 'OnlineFix', id, 'Achievements.ini') },
    // RLD! & DODI
    { type: 'rld', filePath: path.join(programData, 'RLD!', id, 'achievements.ini') },
    { type: 'rld', filePath: path.join(programData, 'Steam', 'Player', id, 'stats', 'achievements.ini') },
    { type: 'rld', filePath: path.join(programData, 'Steam', 'RLD!', id, 'stats', 'achievements.ini') },
    { type: 'rld', filePath: path.join(programData, 'Steam', 'dodi', id, 'stats', 'achievements.ini') },
    // EMPRESS
    { type: 'empress', filePath: path.join(appData, 'EMPRESS', 'remote', id, 'achievements.json') },
    { type: 'empress', filePath: path.join(publicDocs, 'EMPRESS', id, 'remote', id, 'achievements.json') },
    // SKIDROW
    { type: 'skidrow', filePath: path.join(userDocs, 'SKIDROW', id, 'SteamEmu', 'UserStats', 'achiev.ini') },
    { type: 'skidrow', filePath: path.join(userDocs, 'Player', id, 'SteamEmu', 'UserStats', 'achiev.ini') },
    { type: 'skidrow', filePath: path.join(localAppData, 'SKIDROW', id, 'SteamEmu', 'UserStats', 'achiev.ini') },
    // CreamAPI
    { type: 'creamAPI', filePath: path.join(appData, 'CreamAPI', id, 'stats', 'CreamAPI.Achievements.cfg') },
    // SmartSteamEmu
    { type: 'smartSteamEmu', filePath: path.join(appData, 'SmartSteamEmu', id, 'User', 'Achievements.ini') },
    // RLE
    { type: 'rle', filePath: path.join(appData, 'RLE', id, 'achievements.ini') },
    { type: 'rle', filePath: path.join(appData, 'RLE', id, 'Achievements.ini') },
    // Razor1911
    { type: 'razor1911', filePath: path.join(appData, '.1911', id, 'achievement') },
    // FLT
    { type: 'flt', filePath: path.join(appData, 'FLT', id, 'stats') }
  ];
}

function findSteamLibraryCacheFiles(objectId) {
  const results = [];
  const id = String(objectId);
  const steamCandidates = [
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
    'D:\\Steam',
    'E:\\Steam'
  ];

  for (const steamPath of steamCandidates) {
    const userdataDir = path.join(steamPath, 'userdata');
    if (!fs.existsSync(userdataDir)) continue;
    try {
      const userDirs = fs.readdirSync(userdataDir);
      for (const uid of userDirs) {
        const cacheFile = path.join(userdataDir, uid, 'config', 'librarycache', `${id}.json`);
        if (fs.existsSync(cacheFile)) {
          results.push({ type: 'steamCache', filePath: cacheFile });
        }
      }
    } catch {}
  }
  return results;
}

function findGameDirAchievementFiles(exePath) {
  if (!exePath || !fs.existsSync(exePath)) return [];
  const results = [];
  try {
    const gameDir = fs.statSync(exePath).isDirectory() ? exePath : path.dirname(exePath);
    const candidates = [
      { type: 'userstats', filePath: path.join(gameDir, 'SteamData', 'user_stats.ini') },
      { type: 'userstats', filePath: path.join(gameDir, 'user_stats.ini') },
      { type: 'ali213', filePath: path.join(gameDir, 'Profile', 'Stats', 'achievements.ini') },
      { type: 'ali213', filePath: path.join(gameDir, 'Profile', 'Player', 'Stats', 'achievements.ini') },
      { type: 'goldberg', filePath: path.join(gameDir, 'steam_settings', 'achievements.json') },
      { type: 'codex', filePath: path.join(gameDir, 'SteamEmu', 'achievements.ini') }
    ];
    for (const c of candidates) {
      if (fs.existsSync(c.filePath)) results.push(c);
    }
  } catch {}
  return results;
}

function scanPcLocalUnlockedAchievements(game) {
  const unlockedMap = new Map();
  const objectId = game.steamAppId || game.hydraObjectId;
  const candidateFiles = [];

  if (objectId) {
    for (const loc of getWindowsAchievementSearchLocations(objectId)) {
      if (fs.existsSync(loc.filePath)) {
        candidateFiles.push(loc);
      }
    }
    candidateFiles.push(...findSteamLibraryCacheFiles(objectId));
  }

  if (game.romPath) {
    candidateFiles.push(...findGameDirAchievementFiles(game.romPath));
  }

  for (const file of candidateFiles) {
    const parser = ACHIEVEMENT_PARSERS[file.type];
    if (!parser) continue;
    try {
      const parsed = parser(file.filePath);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && item.name && String(item.name).trim()) {
            const key = String(item.name).trim().toUpperCase();
            const existing = unlockedMap.get(key);
            if (!existing || (item.unlockTime && item.unlockTime < existing.unlockTime)) {
              unlockedMap.set(key, {
                name: String(item.name).trim(),
                unlockTime: item.unlockTime || Date.now(),
                source: file.type
              });
            }
          }
        }
      }
    } catch {}
  }

  return unlockedMap;
}

// ============================================================================
// 3. HYDRA API OFFICIAL ACHIEVEMENTS SCHEMA & RETROACHIEVEMENTS PROGRESS
// ============================================================================

async function fetchHydraGameAchievementSchema(shop, objectId, language = 'pt') {
  if (!shop || !objectId) return { achievements: [], retroAchievementsGameId: null };

  let achievements = [];
  let retroAchievementsGameId = null;

  try {
    const achUrl = `${HYDRA_API_URL}/games/${encodeURIComponent(shop)}/${encodeURIComponent(objectId)}/achievements?language=${encodeURIComponent(language)}`;
    const res = await fetchWithTimeout(achUrl, 7500, {
      headers: { 'User-Agent': 'HydraLauncher/3.0' }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        achievements = data;
      }
    }
  } catch {}

  if (shop === 'launchbox') {
    try {
      const gameUrl = `${HYDRA_API_URL}/games/launchbox/${encodeURIComponent(objectId)}`;
      const gRes = await fetchWithTimeout(gameUrl, 6000, {
        headers: { 'User-Agent': 'HydraLauncher/3.0' }
      });
      if (gRes.ok) {
        const gData = await gRes.json();
        if (gData && typeof gData.retroAchievementsGameId === 'number') {
          retroAchievementsGameId = gData.retroAchievementsGameId;
        }
      }
    } catch {}
  }

  return { achievements, retroAchievementsGameId };
}

async function fetchRetroAchievementsUserProgress(username, webApiKey, raGameId) {
  if (!username || !webApiKey || !raGameId) return null;
  try {
    const url = `${RETROACHIEVEMENTS_API_URL}/API_GetGameInfoAndUserProgress.php?u=${encodeURIComponent(username.trim())}&y=${encodeURIComponent(webApiKey.trim())}&g=${encodeURIComponent(raGameId)}`;
    const res = await fetchWithTimeout(url, 8500, {
      headers: { 'User-Agent': 'HydraLauncher/3.0' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.Achievements || typeof data.Achievements !== 'object') return null;

    const unlockedMap = new Map();
    const fullList = [];

    for (const ach of Object.values(data.Achievements)) {
      if (!ach || !ach.ID) continue;
      const idStr = String(ach.ID);
      const earnedDate = ach.DateEarnedHardcore || ach.DateEarned || null;
      const unlockTime = earnedDate ? new Date(`${earnedDate.replace(' ', 'T')}Z`).getTime() : null;
      const isUnlocked = Boolean(earnedDate);
      const badgeName = ach.BadgeName || '';

      if (isUnlocked) {
        unlockedMap.set(idStr.toUpperCase(), {
          name: idStr,
          unlockTime: Number.isNaN(unlockTime) ? Date.now() : unlockTime,
          hardcore: Boolean(ach.DateEarnedHardcore),
          source: 'retroachievements_api'
        });
      }

      fullList.push({
        id: idStr,
        name: idStr,
        title: ach.Title || `Achievement #${idStr}`,
        description: ach.Description || '',
        points: Number(ach.Points) || 0,
        unlocked: isUnlocked,
        unlockTime: Number.isNaN(unlockTime) ? null : unlockTime,
        hardcore: Boolean(ach.DateEarnedHardcore),
        icon: badgeName ? `https://media.retroachievements.org/Badge/${badgeName}.png` : null,
        icongray: badgeName ? `https://media.retroachievements.org/Badge/${badgeName}_lock.png` : null,
        source: 'retroachievements'
      });
    }

    return { unlockedMap, fullList, title: data.Title, consoleName: data.ConsoleName };
  } catch {
    return null;
  }
}

// ============================================================================
// 4. RETROACHIEVEMENTS EMULATOR CONNECT TOKEN & CONFIG INJECTION
//    (Ported from retro-achievements-emulator-account.ts & emulator-credential-config.ts)
// ============================================================================

async function requestRetroAchievementsConnectToken(username, password) {
  if (!username || !password) {
    throw new Error('Usuário e senha do RetroAchievements são obrigatórios para gerar o token dos emuladores.');
  }
  const body = new URLSearchParams({
    r: 'login2',
    u: username.trim(),
    p: password
  }).toString();

  const res = await fetchWithTimeout(RETROACHIEVEMENTS_DOREQUEST_URL, 12000, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Hydra/3.0 (Windows)'
    },
    body
  });

  const data = await res.json();
  if (!data || !data.Success || typeof data.User !== 'string' || typeof data.Token !== 'string') {
    throw new Error(data?.Error || 'Credenciais inválidas no RetroAchievements.org');
  }

  return {
    username: data.User,
    token: data.Token
  };
}

function setCfgKeyValue(content, key, value) {
  const regex = new RegExp(`^\\s*${key}\\s*=\\s*".*"\\s*$`, 'm');
  const newLine = `${key} = "${value}"`;
  if (regex.test(content)) {
    return content.replace(regex, newLine);
  }
  return content.trimEnd() + `\n${newLine}\n`;
}

function setIniSectionKeyValue(content, section, key, value) {
  const lines = content.split(/\r?\n/);
  const secHeader = `[${section}]`;
  let secIdx = lines.findIndex(l => l.trim().toLowerCase() === secHeader.toLowerCase());

  if (secIdx === -1) {
    lines.push('', secHeader, `${key} = ${value}`);
    return lines.join('\n');
  }

  let endIdx = lines.length;
  for (let i = secIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('[') && t.endsWith(']')) {
      endIdx = i;
      break;
    }
    const eqIdx = t.indexOf('=');
    if (eqIdx !== -1 && t.slice(0, eqIdx).trim().toLowerCase() === key.toLowerCase()) {
      lines[i] = `${key} = ${value}`;
      return lines.join('\n');
    }
  }

  lines.splice(endIdx, 0, `${key} = ${value}`);
  return lines.join('\n');
}

function injectRetroAchievementsIntoEmulators(appRoot, username, token, hardcore = false) {
  const injected = [];
  if (!username) return injected;
  const loginTs = String(Math.floor(Date.now() / 1000));

  // 1. RetroArch (emulators/retroarch/retroarch.cfg)
  const raCfgPath = path.join(appRoot, 'emulators', 'retroarch', 'retroarch.cfg');
  if (fs.existsSync(raCfgPath)) {
    try {
      let content = fs.readFileSync(raCfgPath, 'utf8');
      content = setCfgKeyValue(content, 'cheevos_enable', 'true');
      content = setCfgKeyValue(content, 'cheevos_username', username);
      if (token) content = setCfgKeyValue(content, 'cheevos_token', token);
      content = setCfgKeyValue(content, 'cheevos_hardcore_mode_enable', hardcore ? 'true' : 'false');
      content = setCfgKeyValue(content, 'cheevos_badges_enable', 'true');
      content = setCfgKeyValue(content, 'cheevos_verbose_enable', 'true');
      fs.writeFileSync(raCfgPath, content, 'utf8');
      injected.push('RetroArch');
    } catch {}
  }

  // 2. DuckStation (emulators/duckstation/settings.ini)
  const dsIniPath = path.join(appRoot, 'emulators', 'duckstation', 'settings.ini');
  if (fs.existsSync(dsIniPath)) {
    try {
      let content = fs.readFileSync(dsIniPath, 'utf8');
      content = setIniSectionKeyValue(content, 'Cheevos', 'Enabled', 'true');
      content = setIniSectionKeyValue(content, 'Cheevos', 'Username', username);
      if (token) content = setIniSectionKeyValue(content, 'Cheevos', 'Token', token);
      content = setIniSectionKeyValue(content, 'Cheevos', 'LoginTimestamp', loginTs);
      content = setIniSectionKeyValue(content, 'Cheevos', 'ChallengeMode', hardcore ? 'true' : 'false');
      content = setIniSectionKeyValue(content, 'Cheevos', 'Notifications', 'true');
      fs.writeFileSync(dsIniPath, content, 'utf8');
      injected.push('DuckStation (PS1)');
    } catch {}
  }

  // 3. PCSX2 (emulators/pcsx2/inis/PCSX2.ini)
  const pcsx2IniPath = path.join(appRoot, 'emulators', 'pcsx2', 'inis', 'PCSX2.ini');
  if (fs.existsSync(pcsx2IniPath)) {
    try {
      let content = fs.readFileSync(pcsx2IniPath, 'utf8');
      content = setIniSectionKeyValue(content, 'Achievements', 'Enabled', 'true');
      content = setIniSectionKeyValue(content, 'Achievements', 'Username', username);
      if (token) content = setIniSectionKeyValue(content, 'Achievements', 'Token', token);
      content = setIniSectionKeyValue(content, 'Achievements', 'LoginTimestamp', loginTs);
      content = setIniSectionKeyValue(content, 'Achievements', 'ChallengeMode', hardcore ? 'true' : 'false');
      content = setIniSectionKeyValue(content, 'Achievements', 'Notifications', 'true');
      fs.writeFileSync(pcsx2IniPath, content, 'utf8');
      injected.push('PCSX2 (PS2)');
    } catch {}
  }

  // 4. Dolphin (emulators/dolphin/User/Config/RetroAchievements.ini)
  const dolphinConfigDir = path.join(appRoot, 'emulators', 'dolphin', 'User', 'Config');
  if (fs.existsSync(dolphinConfigDir)) {
    try {
      const raIniPath = path.join(dolphinConfigDir, 'RetroAchievements.ini');
      let content = fs.existsSync(raIniPath) ? fs.readFileSync(raIniPath, 'utf8') : '';
      content = setIniSectionKeyValue(content, 'Achievements', 'Enabled', 'True');
      content = setIniSectionKeyValue(content, 'Achievements', 'Username', username);
      if (token) content = setIniSectionKeyValue(content, 'Achievements', 'ApiToken', token);
      content = setIniSectionKeyValue(content, 'Achievements', 'HardcoreEnabled', hardcore ? 'True' : 'False');
      content = setIniSectionKeyValue(content, 'Achievements', 'ProgressEnabled', 'True');
      fs.writeFileSync(raIniPath, content, 'utf8');
      injected.push('Dolphin (GameCube / Wii)');
    } catch {}
  }

  // 5. PPSSPP (emulators/ppsspp/memstick/PSP/SYSTEM/ppsspp.ini)
  const ppssppDir = path.join(appRoot, 'emulators', 'ppsspp', 'memstick', 'PSP', 'SYSTEM');
  if (fs.existsSync(ppssppDir)) {
    try {
      const ppssppIniPath = path.join(ppssppDir, 'ppsspp.ini');
      let content = fs.existsSync(ppssppIniPath) ? fs.readFileSync(ppssppIniPath, 'utf8') : '';
      content = setIniSectionKeyValue(content, 'Achievements', 'AchievementsEnable', 'True');
      content = setIniSectionKeyValue(content, 'Achievements', 'AchievementsUserName', username);
      content = setIniSectionKeyValue(content, 'Achievements', 'AchievementsChallengeMode', hardcore ? 'True' : 'False');
      fs.writeFileSync(ppssppIniPath, content, 'utf8');
      if (token) {
        fs.writeFileSync(path.join(ppssppDir, 'ppsspp_retroachievements.dat'), `${token}\n`, 'utf8');
      }
      injected.push('PPSSPP (PSP)');
    } catch {}
  }

  return injected;
}

// ============================================================================
// 5. REAL-TIME EMULATOR LOG PARSER (Ported from emulator-achievement-log.ts)
// ============================================================================

const RCHEEVOS_AWARD_FORMAT = {
  pattern: /Awarding achievement (\d+): (.+)$/i,
  titleFirst: false
};

const EMULATOR_LOG_FORMATS = {
  PS1: {
    pattern: /Achievement (\d+) \((.*?)\) for game \d+ unlocked/i,
    titleFirst: false
  },
  PS2: {
    pattern: /Achievements: Achievement (.*?) \((\d+)\) for game \d+ unlocked/i,
    titleFirst: true
  },
  PSP: {
    pattern: /Achievement unlocked: '(.*)' \((\d+)\)/i,
    titleFirst: true
  },
  GC: RCHEEVOS_AWARD_FORMAT,
  WII: RCHEEVOS_AWARD_FORMAT,
  SNES: RCHEEVOS_AWARD_FORMAT,
  GENESIS: RCHEEVOS_AWARD_FORMAT,
  N64: RCHEEVOS_AWARD_FORMAT,
  GBA: RCHEEVOS_AWARD_FORMAT,
  GBC: RCHEEVOS_AWARD_FORMAT,
  GB: RCHEEVOS_AWARD_FORMAT,
  MAME: RCHEEVOS_AWARD_FORMAT
};

function parseEmulatorAchievementLogLine(consoleId, line) {
  const fmt = EMULATOR_LOG_FORMATS[consoleId];
  if (!fmt || !line) return null;
  const match = fmt.pattern.exec(line.trim());
  if (!match) return null;
  return {
    id: String(fmt.titleFirst ? match[2] : match[1]).trim(),
    title: String(fmt.titleFirst ? match[1] : match[2]).trim()
  };
}

// ============================================================================
// 6. UNIFIED GAME ACHIEVEMENT SYNC COORDINATOR
// ============================================================================

async function syncGameAchievements(game, config, resolveHydraGameFn) {
  if (!game) return [];
  const isPc = ['PC', 'STEAM', 'EPIC'].includes(game.consoleId);

  // Step 1: Ensure we have Hydra objectId / steamAppId by resolving via Hydra API if needed
  if (!game.steamAppId && !game.hydraObjectId && typeof resolveHydraGameFn === 'function') {
    try {
      const hydraMatch = await resolveHydraGameFn(game);
      if (hydraMatch) {
        if (hydraMatch.steamAppId) game.steamAppId = hydraMatch.steamAppId;
        if (hydraMatch.objectId && hydraMatch.shop === 'launchbox') {
          game.hydraObjectId = hydraMatch.objectId;
        } else if (hydraMatch.objectId && hydraMatch.shop === 'steam') {
          game.steamAppId = hydraMatch.objectId;
        }
      }
    } catch {}
  }

  const shop = isPc ? (game.consoleId === 'EPIC' && !game.steamAppId ? 'epic' : 'steam') : 'launchbox';
  const objectId = isPc ? (game.steamAppId || game.epicAppName || game.hydraObjectId) : game.hydraObjectId;

  // Step 2: Fetch official achievement catalogue in Portuguese from Hydra API
  let catalogueAchievements = [];
  if (objectId) {
    const schema = await fetchHydraGameAchievementSchema(shop, objectId, 'pt');
    catalogueAchievements = schema.achievements || [];
    if (schema.retroAchievementsGameId && !game.retroAchievementsGameId) {
      game.retroAchievementsGameId = schema.retroAchievementsGameId;
    }
  }

  // Step 3: Collect unlocked achievements (from existing optimistic unlocks, PC local files, or RetroAchievements API)
  const unlockedMap = new Map();

  // Preserve already unlocked achievements in game.raAchievements
  if (Array.isArray(game.raAchievements)) {
    for (const prev of game.raAchievements) {
      if (prev && prev.unlocked && (prev.name || prev.id)) {
        const k = String(prev.name || prev.id).toUpperCase();
        unlockedMap.set(k, {
          name: String(prev.name || prev.id),
          unlockTime: prev.unlockTime || Date.now(),
          hardcore: Boolean(prev.hardcore),
          source: prev.source || 'cached'
        });
      }
    }
  }

  // 3A. PC Local Crack / Steam Cache Achievement Files
  if (isPc) {
    const pcUnlocks = scanPcLocalUnlockedAchievements(game);
    for (const [k, val] of pcUnlocks.entries()) {
      unlockedMap.set(k, val);
    }
  }

  // 3B. RetroAchievements User Progress API (if user configured raUsername + raWebApiKey)
  if (!isPc && config?.raUsername && config?.raWebApiKey && game.retroAchievementsGameId) {
    const raProgress = await fetchRetroAchievementsUserProgress(
      config.raUsername,
      config.raWebApiKey,
      game.retroAchievementsGameId
    );
    if (raProgress) {
      for (const [k, val] of raProgress.unlockedMap.entries()) {
        unlockedMap.set(k, val);
      }
      // If Hydra catalogue didn't have achievements, use the direct RetroAchievements list
      if (catalogueAchievements.length === 0 && raProgress.fullList.length > 0) {
        game.raAchievements = raProgress.fullList.sort((a, b) => Number(b.unlocked) - Number(a.unlocked));
        game.achievementsSyncedAt = new Date().toISOString();
        return game.raAchievements;
      }
    }
  }

  // Step 4: Merge Hydra Catalogue Schema with Unlocked Map
  if (catalogueAchievements.length > 0) {
    const merged = catalogueAchievements.map((ach) => {
      const achKey = String(ach.name || '').toUpperCase();
      const u = unlockedMap.get(achKey);
      const isUnlocked = Boolean(u);
      return {
        id: String(ach.name || ''),
        name: String(ach.name || ''),
        title: ach.displayName || ach.name || 'Conquista',
        description: ach.description || (ach.hidden ? 'Conquista secreta — continue jogando para descobrir.' : ''),
        points: typeof ach.points === 'number' ? ach.points : 10,
        unlocked: isUnlocked,
        unlockTime: u?.unlockTime || null,
        hardcore: Boolean(u?.hardcore),
        hidden: Boolean(ach.hidden),
        globalUnlockPercentage: ach.globalUnlockPercentage ?? null,
        icon: isUnlocked ? (ach.icon || ach.icongray) : (ach.icongray || ach.icon),
        iconUnlocked: ach.icon || null,
        iconLocked: ach.icongray || ach.icon || null,
        source: shop === 'launchbox' ? 'hydra_retroachievements' : `hydra_${shop}`
      };
    });

    // Sort unlocked first (newest unlock first), then non-hidden, then hidden
    merged.sort((a, b) => {
      if (a.unlocked && !b.unlocked) return -1;
      if (!a.unlocked && b.unlocked) return 1;
      if (a.unlocked && b.unlocked) return (b.unlockTime || 0) - (a.unlockTime || 0);
      return Number(a.hidden) - Number(b.hidden);
    });

    game.raAchievements = merged;
    game.achievementsSyncedAt = new Date().toISOString();
    return merged;
  }

  // If no remote schema exists, check if PC local files had standalone achievements
  if (isPc && unlockedMap.size > 0) {
    const standalone = Array.from(unlockedMap.values()).map(u => ({
      id: u.name,
      name: u.name,
      title: u.name,
      description: `Desbloqueada localmente (${u.source})`,
      points: 15,
      unlocked: true,
      unlockTime: u.unlockTime,
      icon: null,
      source: u.source
    }));
    game.raAchievements = standalone;
    game.achievementsSyncedAt = new Date().toISOString();
    return standalone;
  }

  return game.raAchievements || [];
}

module.exports = {
  scanPcLocalUnlockedAchievements,
  fetchHydraGameAchievementSchema,
  fetchRetroAchievementsUserProgress,
  requestRetroAchievementsConnectToken,
  injectRetroAchievementsIntoEmulators,
  parseEmulatorAchievementLogLine,
  syncGameAchievements
};
