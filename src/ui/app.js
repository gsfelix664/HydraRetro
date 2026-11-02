let appState = {
  config: {},
  games: [],
  sessions: [],
  activeSession: null,
  stats: {}
};

let currentTab = 'ALL'; // ALL, FAVORITES, RECENT, PC, STEAM, EPIC, GOG, XBOX, HOME, DOWNLOADS, consoles, ACHIEVEMENTS, SETTINGS
let currentLetter = 'ALL';
let searchQuery = '';
let sortMode = 'ALPHA_ASC';
let selectedGameId = null;
let showInstalledOnly = false;
let isLaunching = false;
let currentHomeCategory = 'hot';
let homeGamesCache = [];
let downloadsPollingInterval = null;
let currentSettingsSubTab = 'general';

let activeZone = 'GRID'; // 'GRID', 'SIDEBAR', 'DETAILS', 'COVER_MODAL'
let gamepadGridIndex = 0;
let currentCoverList = [];
let coverModalIndex = 0;
let sfxEnabled = true;
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

function playSfx(type) {
  if (!sfxEnabled) return;
  try {
    initAudio();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    if (type === 'nav') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(460, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.035);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.038);
    } else if (type === 'select') {
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(520, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.08);
      osc2.frequency.setValueAtTime(1040, now);
      osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.08);
      gain.gain.setValueAtTime(0.10, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.09);
      osc2.stop(now + 0.09);
    } else if (type === 'back') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(290, now + 0.06);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } else if (type === 'fav') {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1175, now);
      osc.frequency.setValueAtTime(1568, now + 0.04);
      osc.frequency.setValueAtTime(2093, now + 0.08);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === 'launch') {
      [220, 330, 440, 660].forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.28);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.31);
      });
    }
  } catch {}
}

window.toggleSfx = () => {
  sfxEnabled = !sfxEnabled;
  if (sfxEnabled) playSfx('select');
  const btn = document.getElementById('btn-toggle-sfx');
  if (btn) btn.textContent = sfxEnabled ? '🔊 Efeitos Ativados' : '🔇 Efeitos Desativados';
};

function formatPlaytime(seconds) {
  if (!seconds || seconds <= 0) return '0 min';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs === 0) {
    return mins > 0 ? `${mins} min` : `${seconds}s`;
  }
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}

function formatSize(bytes) {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return 'Nunca jogado';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Nunca jogado';
  }
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

function buildAzBar() {
  const bar = document.getElementById('az-bar');
  const letters = ['ALL', '#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
  bar.innerHTML = '';
  for (const l of letters) {
    const btn = document.createElement('button');
    btn.className = `az-btn ${currentLetter === l ? 'active' : ''}`;
    btn.textContent = l === 'ALL' ? 'TODOS' : l;
    btn.onclick = () => {
      currentLetter = l;
      buildAzBar();
      renderCatalogue();
    };
    bar.appendChild(btn);
  }
}

let lastGamesDataKey = '';

function getGamesDataKey(games) {
  if (!games || games.length === 0) return 'empty';
  let favs = 0;
  for (let i = 0; i < games.length; i++) {
    if (games[i].favorite) favs++;
  }
  const mid = Math.floor(games.length / 2);
  return `${games.length}_${favs}_${games[0]?.id}_${games[mid]?.id}_${games[games.length - 1]?.id}`;
}

function syncVisibleCards(games) {
  const grid = document.getElementById('games-grid');
  if (!grid) return;
  const cards = grid.querySelectorAll('.game-card');
  for (const card of cards) {
    const id = card.dataset.id;
    const game = games.find(g => g.id === id);
    if (!game) continue;
    const img = card.querySelector('.card-art');
    const targetSrc = game.thumbUrl || game.coverUrl || game.fallbackCoverUrl;
    if (img && targetSrc && !img.src.endsWith(targetSrc) && img.src !== targetSrc) {
      img.src = targetSrc;
    }
  }
}

let isBootSplashDismissed = false;
let isInitialStateLoaded = false;

function dismissBootSplash() {
  if (isBootSplashDismissed) return;
  isBootSplashDismissed = true;
  const splash = document.getElementById('app-boot-splash');
  if (splash) {
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
    }, 550);
  }
}

async function fetchState() {
  try {
    const res = await fetch('/api/state');
    appState = await res.json();
    updateSidebarStats();
    updateRunningBanner();

    const splashStatus = document.getElementById('boot-splash-status');
    const splashBar = document.getElementById('boot-progress-bar');

    // While backend is scanning in background, keep splash screen active with live progress
    if (appState.isScanning && !isBootSplashDismissed) {
      if (splashStatus && appState.scanProgress?.message) {
        splashStatus.textContent = appState.scanProgress.message;
      }
      if (splashBar && appState.scanProgress?.percent !== undefined) {
        splashBar.style.animation = 'none';
        splashBar.style.width = `${Math.min(98, Math.max(5, appState.scanProgress.percent))}%`;
      }
      setTimeout(fetchState, 350);
      return;
    }

    // Backend finished scanning or is ready
    if (!isInitialStateLoaded) {
      isInitialStateLoaded = true;
      if (splashStatus) splashStatus.textContent = 'Catálogo pronto!';
      if (splashBar) {
        splashBar.style.animation = 'none';
        splashBar.style.width = '100%';
      }
      setTimeout(dismissBootSplash, 350);
    }

    const currentKey = getGamesDataKey(appState.games);
    if (currentKey !== lastGamesDataKey) {
      lastGamesDataKey = currentKey;
      if (currentTab === 'ACHIEVEMENTS') {
        renderAchievementsView();
      } else if (currentTab === 'PROFILE') {
        renderProfileView();
      } else if (currentTab !== 'SETTINGS') {
        renderCatalogue();
      }
    } else {
      if (currentTab !== 'ACHIEVEMENTS' && currentTab !== 'SETTINGS' && currentTab !== 'PROFILE') {
        syncVisibleCards(appState.games || []);
      }
    }

    if (selectedGameId) {
      const updated = appState.games.find(g => g.id === selectedGameId);
      if (updated) updateDetailsLiveStats(updated);
    }
  } catch (e) {
    console.error('Error fetching state:', e);
    const splashStatus = document.getElementById('boot-splash-status');
    if (splashStatus && !isBootSplashDismissed) {
      splashStatus.textContent = 'Conectando ao catálogo local...';
    }
    setTimeout(fetchState, 500);
  }
}

function updateSidebarStats() {
  const games = appState.games || [];
  const setBadge = (id, count) => {
    const el = document.getElementById(id);
    if (el) el.textContent = count;
  };
  setBadge('badge-all', games.length);
  setBadge('badge-fav', games.filter(g => g.favorite).length);
  setBadge('badge-recent', games.filter(g => g.lastPlayedAt).length);
  setBadge('badge-pc', games.filter(g => g.consoleId === 'PC').length);
  setBadge('badge-steam', games.filter(g => g.consoleId === 'STEAM').length);
  setBadge('badge-epic', games.filter(g => g.consoleId === 'EPIC').length);
  setBadge('badge-gog', games.filter(g => g.consoleId === 'GOG').length);
  setBadge('badge-xbox', games.filter(g => g.consoleId === 'XBOX').length);
  const activeDl = appState.activeDownloadsCount || (appState.downloads || []).filter(d => d.status === 'downloading' || d.status === 'seeding' || d.status === 'extracting').length;
  setBadge('badge-downloads', activeDl > 0 ? activeDl : 0);
  setBadge('badge-ps1', games.filter(g => g.consoleId === 'PS1').length);
  setBadge('badge-genesis', games.filter(g => g.consoleId === 'GENESIS').length);
  setBadge('badge-snes', games.filter(g => g.consoleId === 'SNES').length);
  setBadge('badge-mame', games.filter(g => g.consoleId === 'MAME').length);
  setBadge('badge-ps2', games.filter(g => g.consoleId === 'PS2').length);
  setBadge('badge-wii', games.filter(g => g.consoleId === 'WII').length);
  setBadge('badge-switch', games.filter(g => g.consoleId === 'SWITCH').length);
  setBadge('badge-gc', games.filter(g => g.consoleId === 'GC').length);
  setBadge('badge-psp', games.filter(g => g.consoleId === 'PSP').length);
  setBadge('badge-ps3', games.filter(g => g.consoleId === 'PS3').length);
  setBadge('badge-n64', games.filter(g => g.consoleId === 'N64').length);
  setBadge('badge-gba', games.filter(g => g.consoleId === 'GBA').length);
  setBadge('badge-gbc', games.filter(g => g.consoleId === 'GBC').length);
  setBadge('badge-gb', games.filter(g => g.consoleId === 'GB').length);

  const totalSec = appState.stats?.totalPlayTimeSeconds || 0;
  document.getElementById('global-playtime').textContent = formatPlaytime(totalSec);

  let totalUnlockedAch = 0;
  for (const g of games) {
    if (g.achievements) {
      totalUnlockedAch += g.achievements.filter(a => a.unlocked).length;
    }
  }
  document.getElementById('global-achievements').textContent = `${totalUnlockedAch} 🏆`;
}

function updateRunningBanner() {
  const banner = document.getElementById('running-banner');
  if (appState.activeSession) {
    banner.classList.remove('hidden');
    document.getElementById('running-title').textContent = `${appState.activeSession.title} [${appState.activeSession.consoleId}]`;
    document.getElementById('running-timer').textContent = `(${formatPlaytime(appState.activeSession.elapsedSeconds)})`;
  } else {
    banner.classList.add('hidden');
  }
}

function getFilteredGames() {
  let list = [...(appState.games || [])];

  if (showInstalledOnly) {
    list = list.filter(g => g.isInstalled !== false);
  }

  if (currentTab === 'FAVORITES') {
    list = list.filter(g => g.favorite);
  } else if (currentTab === 'RECENT') {
    list = list.filter(g => Boolean(g.lastPlayedAt));
  } else if (currentTab !== 'ALL' && currentTab !== 'ACHIEVEMENTS' && currentTab !== 'SETTINGS' && currentTab !== 'HOME' && currentTab !== 'DOWNLOADS') {
    list = list.filter(g => g.consoleId === currentTab);
  }

  if (currentLetter !== 'ALL') {
    list = list.filter(g => {
      const firstChar = (g.sortTitle || g.title || '').trim().charAt(0).toUpperCase();
      if (currentLetter === '#') return /^[^A-Z]/.test(firstChar);
      return firstChar === currentLetter;
    });
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(g => g.title.toLowerCase().includes(q) || g.fileName.toLowerCase().includes(q));
  }

  const getSortKey = (g) => g._sortKey || (g._sortKey = (g.sortTitle || g.title || '').toLowerCase());

  if (currentTab === 'RECENT' && sortMode === 'ALPHA_ASC') {
    list.sort((a, b) => new Date(b.lastPlayedAt || 0) - new Date(a.lastPlayedAt || 0));
  } else if (sortMode === 'ALPHA_ASC') {
    list.sort((a, b) => {
      const sa = getSortKey(a);
      const sb = getSortKey(b);
      return sa < sb ? -1 : (sa > sb ? 1 : 0);
    });
  } else if (sortMode === 'ALPHA_DESC') {
    list.sort((a, b) => {
      const sa = getSortKey(a);
      const sb = getSortKey(b);
      return sa > sb ? -1 : (sa < sb ? 1 : 0);
    });
  } else if (sortMode === 'RATING_DESC') {
    list.sort((a, b) => {
      const diff = (b.rating || 0) - (a.rating || 0);
      if (Math.abs(diff) > 0.001) return diff;
      const sa = getSortKey(a);
      const sb = getSortKey(b);
      return sa < sb ? -1 : (sa > sb ? 1 : 0);
    });
  } else if (sortMode === 'RATING_ASC') {
    list.sort((a, b) => {
      const diff = (a.rating || 0) - (b.rating || 0);
      if (Math.abs(diff) > 0.001) return diff;
      const sa = getSortKey(a);
      const sb = getSortKey(b);
      return sa < sb ? -1 : (sa > sb ? 1 : 0);
    });
  } else if (sortMode === 'PLAYTIME') {
    list.sort((a, b) => (b.playTimeSeconds || 0) - (a.playTimeSeconds || 0) || (getSortKey(a) < getSortKey(b) ? -1 : 1));
  } else if (sortMode === 'RECENT') {
    list.sort((a, b) => new Date(b.lastPlayedAt || 0) - new Date(a.lastPlayedAt || 0) || (getSortKey(a) < getSortKey(b) ? -1 : 1));
  } else if (sortMode === 'ACHIEVEMENTS') {
    const getAchScore = (g) => {
      if (!g.achievements || g.achievements.length === 0) return 0;
      return g.achievements.filter(a => a.unlocked).length;
    };
    list.sort((a, b) => getAchScore(b) - getAchScore(a) || (getSortKey(a) < getSortKey(b) ? -1 : 1));
  } else if (sortMode === 'INSTALLED_FIRST') {
    list.sort((a, b) => {
      const aInst = a.isInstalled !== false ? 1 : 0;
      const bInst = b.isInstalled !== false ? 1 : 0;
      if (aInst !== bInst) return bInst - aInst;
      const sa = getSortKey(a);
      const sb = getSortKey(b);
      return sa < sb ? -1 : (sa > sb ? 1 : 0);
    });
  }

  return list;
}

let currentCatalogueList = [];
let lastVisibleRange = { startRow: -1, endRow: -1 };
let virtualScrollRaf = null;

function renderCatalogue(resetScroll = false) {
  const viewSection = document.getElementById('view-catalogue');
  if (resetScroll && viewSection) viewSection.scrollTop = 0;

  const filtered = getFilteredGames();
  currentCatalogueList = filtered;

  const titlesMap = {
    ALL: ['Todos os Jogos', `${filtered.length} jogos prontos para iniciar com 1 clique`],
    FAVORITES: ['⭐ Meus Favoritos', `${filtered.length} clássicos marcados como favoritos`],
    RECENT: ['🕒 Últimos Jogados', `${filtered.length} jogos com histórico recente`],
    PC: ['🖥️ Jogos de PC & Executáveis (.EXE)', `${filtered.length} jogos de PC instalados com lançamento direto`],
    STEAM: ['🔵 Biblioteca Steam', `${filtered.length} jogos sincronizados da Steam (Local & Conta)`],
    EPIC: ['⚫ Biblioteca Epic Games', `${filtered.length} jogos sincronizados da Epic Games (Local & Legendary)`],
    GOG: ['🟣 Biblioteca GOG Galaxy', `${filtered.length} jogos instalados do GOG Galaxy`],
    XBOX: ['🟢 Jogos Xbox & PC Game Pass', `${filtered.length} títulos Xbox / Game Pass instalados`],
    PS1: ['PlayStation 1 (DuckStation)', `${filtered.length} jogos em alta definição • DuckStation`],
    GENESIS: ['Sega Mega Drive (Genesis Plus GX)', `${filtered.length} jogos clássicos 16-bits • Genesis Plus GX`],
    SNES: ['Super Nintendo (Snes9x)', `${filtered.length} jogos clássicos 16-bits • Snes9x`],
    MAME: ['Arcade / MAME (FBNeo)', `${filtered.length} sucessos de fliperama • FBNeo`],
    PS2: ['PlayStation 2 (PCSX2)', `${filtered.length} sucessos em 3D • PCSX2 Qt`],
    WII: ['Nintendo Wii (Dolphin)', `${filtered.length} clássicos Nintendo • Dolphin Emulator`],
    SWITCH: ['Nintendo Switch (Ryujinx)', `${filtered.length} títulos híbridos modernos • Ryujinx`],
    GC: ['Nintendo GameCube (Dolphin)', `${filtered.length} clássicos GameCube • Dolphin Emulator`],
    PSP: ['PlayStation Portable (PPSSPP)', `${filtered.length} sucessos portáteis • PPSSPP`],
    PS3: ['PlayStation 3 (RPCS3)', `${filtered.length} títulos PlayStation 3 • RPCS3`],
    N64: ['Nintendo 64 (Mupen64Plus-Next)', `${filtered.length} clássicos 64-bits • Mupen64Plus`],
    GBA: ['Game Boy Advance (mGBA)', `${filtered.length} portáteis 32-bits • mGBA`],
    GBC: ['Game Boy Color (Gambatte)', `${filtered.length} clássicos coloridos • Gambatte`],
    GB: ['Game Boy (Gambatte)', `${filtered.length} clássicos atemporais • Gambatte`]
  };

  const [hTitle, hSub] = titlesMap[currentTab] || ['Catálogo', ''];
  document.getElementById('current-view-title').textContent = hTitle;
  document.getElementById('current-view-subtitle').textContent = hSub;

  lastVisibleRange = { startRow: -1, endRow: -1 };
  updateVirtualGrid(true);
}

function getGridDimensions() {
  const grid = document.getElementById('games-grid');
  const viewSection = document.getElementById('view-catalogue');
  const availableWidth = (grid && grid.clientWidth) || (viewSection && viewSection.clientWidth - 56) || 1200;
  const minColWidth = 230; // Big Picture standard (~4-5 cards em 1080p, artes imponentes)
  const gap = 24;
  const cols = Math.max(1, Math.floor((availableWidth + gap) / (minColWidth + gap)));
  const cardWidth = Math.floor((availableWidth - (cols - 1) * gap) / cols);
  const cardHeight = Math.round(cardWidth * 1.40 + 64);
  const rowHeight = cardHeight + gap;
  return { availableWidth, cols, cardWidth, cardHeight, rowHeight, gap };
}

function updateGamepadGridFocus() {
  document.querySelectorAll('.game-card.gamepad-focused').forEach(el => el.classList.remove('gamepad-focused'));
  if (activeZone === 'GRID') {
    const card = document.querySelector(`.game-card[data-index="${gamepadGridIndex}"]`);
    if (card) {
      card.classList.add('gamepad-focused');
    }
  }
}

function updateVirtualGrid(force = false) {
  const grid = document.getElementById('games-grid');
  const viewSection = document.getElementById('view-catalogue');
  if (!grid || !viewSection) return;

  const totalItems = currentCatalogueList.length;
  if (totalItems === 0) {
    grid.innerHTML = '<div style="color:var(--text-muted);font-size:15px;padding:40px 0;text-align:center;">Nenhum jogo encontrado nesta categoria.</div>';
    grid.style.height = 'auto';
    return;
  }

  const { availableWidth, cols, cardWidth, cardHeight, rowHeight, gap } = getGridDimensions();
  const totalRows = Math.ceil(totalItems / cols);
  const totalVirtualHeight = totalRows * rowHeight;

  grid.style.position = 'relative';
  grid.style.height = `${totalVirtualHeight}px`;

  const scrollTop = viewSection.scrollTop;
  const viewportHeight = viewSection.clientHeight || 800;

  const gridOffsetTop = grid.offsetTop;
  const relativeScrollTop = Math.max(0, scrollTop - gridOffsetTop);

  const startRow = Math.max(0, Math.floor(relativeScrollTop / rowHeight) - 2);
  const endRow = Math.min(totalRows - 1, Math.ceil((relativeScrollTop + viewportHeight) / rowHeight) + 2);

  if (!force && lastVisibleRange.startRow === startRow && lastVisibleRange.endRow === endRow) {
    return;
  }
  lastVisibleRange = { startRow, endRow };

  const startIndex = startRow * cols;
  const endIndex = Math.min(totalItems, (endRow + 1) * cols);

  const existingCards = new Map();
  grid.querySelectorAll('.game-card').forEach(card => {
    const idx = parseInt(card.dataset.index, 10);
    existingCards.set(idx, card);
  });

  for (const [idx, card] of existingCards.entries()) {
    const game = currentCatalogueList[idx];
    if (idx < startIndex || idx >= endIndex || !game || card.dataset.id !== game.id) {
      card.remove();
      existingCards.delete(idx);
    }
  }

  const frag = document.createDocumentFragment();

  for (let i = startIndex; i < endIndex; i++) {
    const game = currentCatalogueList[i];
    if (!game) continue;
    const row = Math.floor(i / cols);
    const col = i % cols;
    const posX = col * (cardWidth + gap);
    const posY = row * rowHeight;

    const existing = existingCards.get(i);
    if (existing && existing.dataset.id === game.id) {
      existing.style.left = `${posX}px`;
      existing.style.top = `${posY}px`;
      existing.style.width = `${cardWidth}px`;
      existing.style.height = `${cardHeight}px`;

      const isGamepadFocused = (activeZone === 'GRID' && i === gamepadGridIndex);
      const isSelected = (selectedGameId === game.id);
      existing.classList.toggle('gamepad-focused', isGamepadFocused);
      existing.classList.toggle('selected', isSelected);
    } else {
      const card = createGameCardElement(game, cardWidth, cardHeight, posX, posY, i);
      frag.appendChild(card);
    }
  }

  if (frag.childNodes.length > 0) {
    grid.appendChild(frag);
  }
}

function createGameCardElement(game, cardWidth, cardHeight, posX, posY, index = -1) {
  const isGamepadFocused = (activeZone === 'GRID' && index === gamepadGridIndex);
  const card = document.createElement('div');
  card.className = `game-card ${selectedGameId === game.id ? 'selected' : ''} ${isGamepadFocused ? 'gamepad-focused' : ''}`;
  card.dataset.id = game.id;
  card.dataset.index = index;
  card.style.position = 'absolute';
  card.style.left = `${posX}px`;
  card.style.top = `${posY}px`;
  card.style.width = `${cardWidth}px`;
  card.style.height = `${cardHeight}px`;

  const artWrap = document.createElement('div');
  artWrap.className = 'card-art-wrap';

  const img = document.createElement('img');
  img.className = 'card-art';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.alt = game.title;
  img.src = game.thumbUrl || game.coverUrl || game.fallbackCoverUrl || '';
  let candIdx = 0;
  img.onerror = async () => {
    while (game.coverCandidates && candIdx < game.coverCandidates.length) {
      const next = game.coverCandidates[candIdx++];
      if (next && next !== img.src) {
        img.src = next;
        return;
      }
    }
    if (game.fallbackCoverUrl && img.src !== window.location.origin + game.fallbackCoverUrl) {
      img.src = game.fallbackCoverUrl;
      return;
    }
    if (!game._autoResolveAttempted) {
      game._autoResolveAttempted = true;
      try {
        const res = await fetch('/api/covers/auto-resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId: game.id })
        });
        const data = await res.json();
        if (res.ok && data.ok && data.coverUrl) {
          game.coverUrl = data.coverUrl;
          if (data.heroUrl) game.heroUrl = data.heroUrl;
          if (data.logoUrl) game.logoUrl = data.logoUrl;
          img.style.display = '';
          img.src = data.coverUrl;
          return;
        }
      } catch {}
    }
    img.style.display = 'none';
    const sh = artWrap.querySelector('.card-placeholder-shimmer');
    if (sh) sh.remove();
  };

  if (img.complete && img.naturalWidth > 0) {
    img.classList.add('loaded');
  } else {
    img.classList.add('loading');
    const shimmer = document.createElement('div');
    shimmer.className = 'card-placeholder-shimmer';
    artWrap.appendChild(shimmer);

    img.onload = () => {
      img.classList.remove('loading');
      img.classList.add('loaded');
      shimmer.remove();
      game.coverUrl = img.src;
    };
  }
  artWrap.appendChild(img);

  const badges = document.createElement('div');
  badges.className = 'card-top-badges';
  const ratingVal = (typeof game.rating === 'number' ? game.rating : 4.8).toFixed(1);
  badges.innerHTML = `
    <div class="card-badges-left">
      <span class="card-console-tag ${game.consoleId}">${game.consoleId === 'GENESIS' ? 'MD' : (game.consoleId === 'MAME' ? 'ARC' : (game.consoleId === 'SWITCH' ? 'NSW' : game.consoleId))}</span>
      <span class="card-rating-tag" title="Avaliação: ${ratingVal} / 5.0">★ ${ratingVal}</span>
    </div>
    ${game.favorite ? '<span class="card-fav-star">★</span>' : ''}
  `;
  artWrap.appendChild(badges);

  const bottomBadges = document.createElement('div');
  bottomBadges.className = 'card-bottom-badges';
  const hours = (game.playTimeSeconds || 0) / 3600;
  const ptBadgeText = hours >= 1 ? `${hours.toFixed(1)}h` : (game.playTimeSeconds > 0 ? `${Math.round(game.playTimeSeconds / 60)}m` : '0h');
  const achs = game.achievements || [];
  const unlockedAch = achs.filter(a => a.unlocked).length;
  const achBadgeText = achs.length > 0 ? `${unlockedAch}/${achs.length}` : '0';

  bottomBadges.innerHTML = `
    <span class="card-cover-badge time-badge" title="Tempo jogado: ${formatPlaytime(game.playTimeSeconds || 0)}">
      <span class="badge-icon">⏱️</span><span>${ptBadgeText}</span>
    </span>
    <span class="card-cover-badge ach-badge" title="Conquistas: ${unlockedAch} de ${achs.length} desbloqueadas">
      <span class="badge-icon">🏆</span><span>${achBadgeText}</span>
    </span>
  `;
  artWrap.appendChild(bottomBadges);

  const info = document.createElement('div');
  info.className = 'card-info';
  const ptText = game.playTimeSeconds > 0 ? formatPlaytime(game.playTimeSeconds) : formatSize(game.sizeBytes);
  info.innerHTML = `
    <div class="card-title" title="${game.title}">${game.title}</div>
    <div class="card-meta">
      <span>${appState.config?.consoles?.[game.consoleId]?.name || game.consoleId}</span>
      <span class="${game.playTimeSeconds > 0 ? 'card-playtime' : ''}">${ptText}</span>
    </div>
  `;

  card.appendChild(artWrap);
  card.appendChild(info);

  card.onclick = () => {
    closeGameContextMenu();
    const idx = currentCatalogueList.findIndex(g => g.id === game.id);
    if (idx !== -1) {
      gamepadGridIndex = idx;
      updateGamepadGridFocus();
    }
    playSfx('select');
    selectGame(game);
  };

  card.oncontextmenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const idx = currentCatalogueList.findIndex(g => g.id === game.id);
    if (idx !== -1) {
      gamepadGridIndex = idx;
      updateGamepadGridFocus();
    }
    openGameContextMenu(e, game);
  };

  return card;
}

function closeGameDetails() {
  selectedGameId = null;
  activeZone = (currentTab === 'ACHIEVEMENTS' || currentTab === 'SETTINGS') ? 'SIDEBAR' : 'GRID';
  const panel = document.getElementById('details-panel');
  if (panel) panel.classList.add('hidden');

  const video = document.getElementById('details-video');
  if (video) video.pause();
  const galVideo = document.getElementById('gallery-active-video');
  if (galVideo) galVideo.pause();

  const vCat = document.getElementById('view-catalogue');
  const vAch = document.getElementById('view-achievements');
  const vSet = document.getElementById('view-settings');
  const azBar = document.getElementById('az-bar');

  if (currentTab === 'ACHIEVEMENTS') {
    if (azBar) azBar.classList.add('hidden');
    if (vAch) vAch.classList.remove('hidden');
  } else if (currentTab === 'SETTINGS') {
    if (azBar) azBar.classList.add('hidden');
    if (vSet) vSet.classList.remove('hidden');
  } else if (currentTab === 'HOME') {
    if (azBar) azBar.classList.add('hidden');
    document.getElementById('view-home')?.classList.remove('hidden');
  } else if (currentTab === 'DOWNLOADS') {
    if (azBar) azBar.classList.add('hidden');
    document.getElementById('view-downloads')?.classList.remove('hidden');
  } else if (currentTab === 'PROFILE') {
    if (azBar) azBar.classList.add('hidden');
    document.getElementById('view-profile')?.classList.remove('hidden');
  } else {
    if (azBar) azBar.classList.remove('hidden');
    if (vCat) vCat.classList.remove('hidden');
    requestAnimationFrame(() => updateVirtualGrid(true));
  }

  const hudA = document.getElementById('hud-label-a');
  if (hudA) hudA.textContent = 'Ver Detalhes';
  updateGamepadGridFocus();
  playSfx('back');
}
window.closeGameDetails = closeGameDetails;

function selectGame(game) {
  closeGameContextMenu();
  selectedGameId = game.id;
  activeZone = 'DETAILS';
  const hudA = document.getElementById('hud-label-a');
  if (hudA) hudA.textContent = 'JOGAR AGORA';
  document.querySelectorAll('.game-card').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === game.id);
  });

  // Hide catalog/other views and show Full-Page Game Details View
  document.getElementById('view-catalogue')?.classList.add('hidden');
  document.getElementById('view-achievements')?.classList.add('hidden');
  document.getElementById('view-settings')?.classList.add('hidden');
  document.getElementById('view-home')?.classList.add('hidden');
  document.getElementById('view-downloads')?.classList.add('hidden');
  document.getElementById('view-profile')?.classList.add('hidden');
  document.getElementById('az-bar')?.classList.add('hidden');

  const panel = document.getElementById('details-panel');
  panel.classList.remove('hidden');
  panel.scrollTop = 0;

  const backdrop = document.getElementById('hero-backdrop');
  const hero = document.getElementById('details-hero');
  const initialBg = game.heroUrl || game.coverUrl || game.fallbackCoverUrl || '';
  backdrop.style.backgroundImage = `url("${initialBg}")`;
  hero.style.backgroundImage = `url("${initialBg}")`;

  const heroTest = new Image();
  heroTest.src = game.heroUrl || '';
  let heroCandIdx = 0;
  heroTest.onerror = () => {
    while (game.heroCandidates && heroCandIdx < game.heroCandidates.length) {
      const next = game.heroCandidates[heroCandIdx++];
      if (next && next !== heroTest.src) {
        heroTest.src = next;
        return;
      }
    }
    const fallback = game.coverUrl || '';
    backdrop.style.backgroundImage = `url("${fallback}")`;
    hero.style.backgroundImage = `url("${fallback}")`;
  };
  heroTest.onload = () => {
    backdrop.style.backgroundImage = `url("${heroTest.src}")`;
    hero.style.backgroundImage = `url("${heroTest.src}")`;
    game.heroUrl = heroTest.src;
  };

  const video = document.getElementById('details-video');
  if (game.videoUrl) {
    video.src = game.videoUrl;
    video.classList.remove('hidden');
    video.play().catch(() => {});
  } else {
    video.pause();
    video.classList.add('hidden');
  }

  const logo = document.getElementById('details-logo');
  if (game.logoUrl || game.fallbackLogoUrl) {
    logo.src = game.logoUrl || game.fallbackLogoUrl;
    logo.classList.remove('hidden');
    let logoCandIdx = 0;
    logo.onerror = () => {
      while (game.logoCandidates && logoCandIdx < game.logoCandidates.length) {
        const next = game.logoCandidates[logoCandIdx++];
        if (next && next !== logo.src) {
          logo.src = next;
          return;
        }
      }
      if (game.fallbackLogoUrl && logo.src !== window.location.origin + game.fallbackLogoUrl) {
        logo.src = game.fallbackLogoUrl;
      } else {
        logo.classList.add('hidden');
      }
    };
  } else {
    logo.classList.add('hidden');
  }

  const cCfg = appState.config?.consoles?.[game.consoleId];
  const cName = cCfg?.name || game.consoleId;
  const cMfg = cCfg?.manufacturer || 'Console';
  document.getElementById('details-console-badge').textContent = (cCfg?.shortName || game.consoleId).toUpperCase();
  document.getElementById('details-platform-badge').textContent = cMfg.toUpperCase();
  document.getElementById('details-platform-name').textContent = `${cName} • ${cMfg}`;
  document.getElementById('details-size-badge').textContent = formatSize(game.sizeBytes);
  document.getElementById('details-year-badge').textContent = game.releaseYear || '---';
  document.getElementById('details-rating-badge').textContent = `⭐ ${(game.rating || 4.8).toFixed(1)}`;
  document.getElementById('details-title').textContent = game.title;
  document.getElementById('details-filename').textContent = game.fileName;

  // Render Genre Pills
  const genresBox = document.getElementById('details-genres');
  genresBox.innerHTML = '';
  const genres = game.genres || ['Clássico Retrô'];
  for (const g of genres) {
    const pill = document.createElement('span');
    pill.className = 'genre-pill';
    pill.textContent = g;
    genresBox.appendChild(pill);
  }

  // Load and Render HowLongToBeat Stats
  loadGameHltb(game);

  // Render Synopsis and Tech Specs
  document.getElementById('details-description').textContent = game.description || 'Um clássico atemporal dos videogames pronto para ser revivido em tela cheia com comandos responsivos.';
  document.getElementById('details-dev').textContent = game.developer || '---';
  document.getElementById('details-pub').textContent = game.publisher || '---';
  document.getElementById('details-players').textContent = game.players || '1-2 Jogadores';

  // Auto-enrich metadata online if generic
  autoEnrichGameMetadata(game);

  // Load Hydra Full Details (Screenshots, Videos, Languages, Requirements, Controller Support, Similar Games)
  loadFullGameDetails(game);

  // Hydra Official + SteamGridDB HD Button Handler
  const sgBtn = document.getElementById('btn-steamgrid-game');
  sgBtn.onclick = async () => {
    const key = appState.config?.steamGridDbApiKey || '';
    showToast(`Buscando artes em alta definição para ${game.title}...`);
    sgBtn.disabled = true;
    try {
      const res = await fetch('/api/steamgrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, apiKey: key })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Erro ao consultar artes HD');
      } else {
        showToast('Artes HD aplicadas com sucesso!');
        await fetchState();
        const updated = appState.games.find(g => g.id === game.id);
        if (updated) selectGame(updated);
      }
    } catch {
      showToast('Falha na comunicação ao buscar artes HD');
    } finally {
      sgBtn.disabled = false;
    }
  };

  const coverBtn = document.getElementById('btn-open-cover-selector');
  if (coverBtn) {
    coverBtn.onclick = () => openCoverSelector(game.id);
  }

  const openLocBtn = document.getElementById('btn-open-file-loc');
  if (openLocBtn) {
    openLocBtn.onclick = () => openGameFileLocation(game.id);
  }

  const removeBtn = document.getElementById('btn-remove-game-details');
  if (removeBtn) {
    removeBtn.onclick = () => openRemoveGameModal(game);
  }

  const discBox = document.getElementById('disc-selector-box');
  const discSelect = document.getElementById('disc-select');
  if (game.discs && game.discs.length > 1) {
    discBox.classList.remove('hidden');
    discSelect.innerHTML = game.discs.map((d, idx) => `<option value="${idx}">Disco ${idx + 1} — ${d.fileName}</option>`).join('');
  } else {
    discBox.classList.add('hidden');
    discSelect.innerHTML = '<option value="0">Disco 1</option>';
  }

  updateDetailsLiveStats(game);

  const syncAchBtn = document.getElementById('btn-sync-game-ach');
  if (syncAchBtn) {
    syncAchBtn.onclick = async () => {
      syncAchBtn.disabled = true;
      syncAchBtn.textContent = '⏳...';
      try {
        const res = await fetch('/api/achievements/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId: game.id })
        });
        const data = await res.json();
        if (res.ok && data.achievements) {
          game.achievements = data.achievements;
          game.raAchievements = data.achievements;
          updateDetailsLiveStats(game);
          showToast(`🏆 ${data.officialCount || data.achievements.length} conquistas sincronizadas!`);
        }
      } catch {
        showToast('Erro ao sincronizar conquistas');
      } finally {
        syncAchBtn.disabled = false;
        syncAchBtn.textContent = '🔄 Sincronizar';
      }
    };
  }

  // Auto-sync official Hydra / RetroAchievements / PC local achievements when opening game details
  if (!game.raAchievements || game.raAchievements.length === 0) {
    fetch('/api/achievements/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: game.id })
    }).then(r => r.json()).then(data => {
      if (data && data.ok && Array.isArray(data.achievements) && data.officialCount > 0) {
        game.achievements = data.achievements;
        game.raAchievements = data.achievements;
        if (selectedGameId === game.id) {
          updateDetailsLiveStats(game);
        }
      }
    }).catch(() => {});
  }

  const btnPlayMain = document.getElementById('btn-play-main');
  const btnPlayIcon = document.getElementById('btn-play-main-icon');
  const btnPlayText = document.getElementById('btn-play-main-text');
  const btnDlOptions = document.getElementById('btn-download-options');
  if (btnDlOptions) btnDlOptions.classList.add('hidden');

  if (game.isInstalled === false) {
    if (btnPlayMain) {
      btnPlayMain.classList.remove('hidden');
      btnPlayMain.classList.add('dl-btn-accent');
      if (btnPlayIcon) btnPlayIcon.textContent = '📥';
      if (btnPlayText) btnPlayText.textContent = 'BAIXAR JOGO';
      btnPlayMain.onclick = () => {
        playSfx('select');
        openRepacksModal(game.title, { objectId: game.steamAppId || game.objectId || game.id, shop: game.shop || 'steam' });
      };
    }
  } else {
    if (btnPlayMain) {
      btnPlayMain.classList.remove('hidden');
      btnPlayMain.classList.remove('dl-btn-accent');
      if (btnPlayIcon) btnPlayIcon.textContent = '▶';
      if (btnPlayText) btnPlayText.textContent = 'JOGAR AGORA';
      btnPlayMain.onclick = () => {
        const discIdx = parseInt(discSelect.value || '0', 10);
        playSfx('launch');
        launchSelectedGame(game.id, discIdx);
      };
    }
  }

  document.getElementById('btn-fav-toggle').onclick = () => {
    playSfx('fav');
    toggleFavorite(game.id);
  };
}

let currentFullDetailsGameId = null;

async function loadFullGameDetails(game) {
  currentFullDetailsGameId = game.id;

  const activeImg = document.getElementById('gallery-active-img');
  const activeVid = document.getElementById('gallery-active-video');
  const thumbsStrip = document.getElementById('gallery-thumbs-strip');
  const ctrlContent = document.getElementById('details-controller-content');
  const langContent = document.getElementById('details-languages-content');
  const reqContent = document.getElementById('details-req-content');
  const reqTabMin = document.getElementById('req-tab-min');
  const reqTabRec = document.getElementById('req-tab-rec');
  const similarGrid = document.getElementById('details-similar-grid');

  // Initial immediate preview while loading
  const defaultPreview = game.heroUrl || game.coverUrl || game.fallbackCoverUrl || '';
  if (activeVid) {
    activeVid.pause();
    activeVid.classList.add('hidden');
  }
  if (activeImg) {
    activeImg.src = defaultPreview;
    activeImg.classList.remove('hidden');
  }
  if (thumbsStrip) {
    thumbsStrip.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:6px 0;">Carregando capturas de tela e vídeos...</div>`;
  }
  if (ctrlContent) {
    ctrlContent.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">Verificando suporte a controle...</div>`;
  }
  if (langContent) {
    langContent.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">Consultando idiomas...</div>`;
  }
  if (reqContent) {
    reqContent.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">Carregando especificações...</div>`;
  }
  if (similarGrid) {
    similarGrid.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">Buscando jogos similares no catálogo Hydra...</div>`;
  }

  try {
    const res = await fetch('/api/game/full-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: game.id })
    });
    const data = await res.json();
    if (currentFullDetailsGameId !== game.id || !data.ok) return;
    const details = data.details || data;

    // 1. Render Screenshots & Videos Gallery
    const mediaItems = [];
    if (Array.isArray(details.movies)) {
      for (const m of details.movies) {
        const vUrl = typeof m === 'string' ? m : (m.url || m.webm || m.mp4);
        if (vUrl) {
          mediaItems.push({ type: 'video', url: vUrl, thumb: m.thumbnail || defaultPreview, name: m.name || 'Trailer' });
        }
      }
    }
    if (Array.isArray(details.screenshots)) {
      for (const s of details.screenshots) {
        if (typeof s === 'string' && s) {
          mediaItems.push({ type: 'image', url: s, thumb: s, label: 'Screenshot' });
        } else if (s && (s.full || s.url)) {
          const u = s.full || s.url;
          mediaItems.push({ type: 'image', url: u, thumb: s.thumb || u, label: s.label || 'Screenshot' });
        }
      }
    }
    if (mediaItems.length === 0 && defaultPreview) {
      mediaItems.push({ type: 'image', url: defaultPreview, thumb: defaultPreview, label: 'Arte Principal' });
    }

    const selectGalleryItem = (idx) => {
      const item = mediaItems[idx];
      if (!item) return;
      document.querySelectorAll('.gallery-thumb-item').forEach((el, i) => {
        el.classList.toggle('active', i === idx);
      });
      if (item.type === 'video') {
        activeImg.classList.add('hidden');
        activeVid.src = item.url;
        activeVid.classList.remove('hidden');
        activeVid.play().catch(() => {});
      } else {
        activeVid.pause();
        activeVid.classList.add('hidden');
        activeImg.src = item.url;
        activeImg.classList.remove('hidden');
      }
    };

    if (thumbsStrip) {
      thumbsStrip.innerHTML = '';
      mediaItems.forEach((item, idx) => {
        const thumbEl = document.createElement('div');
        thumbEl.className = `gallery-thumb-item ${idx === 0 ? 'active' : ''}`;
        thumbEl.innerHTML = `
          <img src="${item.thumb}" loading="lazy" alt="${item.label || 'Media'}">
          ${item.type === 'video' ? '<div class="gallery-video-badge">▶</div>' : ''}
        `;
        const imgTag = thumbEl.querySelector('img');
        if (imgTag) {
          imgTag.onerror = () => {
            thumbEl.remove();
          };
        }
        thumbEl.onclick = () => {
          playSfx('nav');
          selectGalleryItem(idx);
        };
        thumbsStrip.appendChild(thumbEl);
      });
      // Show first image by default (or video if user clicks)
      const firstImgIdx = mediaItems.findIndex(m => m.type === 'image');
      selectGalleryItem(firstImgIdx !== -1 ? firstImgIdx : 0);
    }

    // 2. Render Controller Support (Xbox + PlayStation badges like Hydra/Steam)
    if (ctrlContent) {
      const support = details.controllerSupport || 'full';
      const label = support === 'full'
        ? 'Compatibilidade Total com Controle'
        : (support === 'partial' ? 'Compatibilidade Parcial com Controle' : 'Teclado / Controle via Mapeamento');
      ctrlContent.innerHTML = `
        <div class="controller-pill-row">
          <span style="font-size:22px;">🎮</span>
          <div>
            <strong style="color:#10b981;font-size:13px;display:block;">${label}</strong>
            <span style="font-size:11px;color:var(--text-muted);">Atalho de saída: Segure SELECT + START</span>
          </div>
        </div>
        <div class="controller-devices-row">
          <span class="ctrl-device-tag">🟢 Controles de Xbox (XInput)</span>
          <span class="ctrl-device-tag">🔵 Controles de PlayStation (DualShock / DualSense)</span>
        </div>
      `;
    }

    // 3. Render Supported Languages Table
    if (langContent) {
      const langs = Array.isArray(details.supportedLanguages) ? details.supportedLanguages : [];
      if (langs.length === 0) {
        langContent.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">Idioma original da mídia.</div>`;
      } else {
        langContent.innerHTML = `
          <table class="hydra-lang-table">
            <thead>
              <tr>
                <th>Idioma</th>
                <th class="check-col">Interface</th>
                <th class="check-col">Áudio</th>
              </tr>
            </thead>
            <tbody>
              ${langs.map(l => `
                <tr>
                  <td><strong>${l.language}</strong></td>
                  <td class="check-col" style="color:#10b981;">${l.caption ? '✔' : '—'}</td>
                  <td class="check-col" style="color:${l.audio ? '#10b981' : '#6b7280'};">${l.audio ? '✔' : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    }

    // 4. Render System Requirements (Mínimos / Recomendados toggle)
    if (reqContent && reqTabMin && reqTabRec) {
      const reqs = details.pcRequirements || {};
      const minHtml = reqs.minimum || 'Especificações padrão do sistema.';
      const recHtml = reqs.recommended || minHtml;

      reqTabMin.classList.add('active');
      reqTabRec.classList.remove('active');
      reqContent.innerHTML = minHtml;

      reqTabMin.onclick = () => {
        playSfx('nav');
        reqTabMin.classList.add('active');
        reqTabRec.classList.remove('active');
        reqContent.innerHTML = minHtml;
      };
      reqTabRec.onclick = () => {
        playSfx('nav');
        reqTabRec.classList.add('active');
        reqTabMin.classList.remove('active');
        reqContent.innerHTML = recHtml;
      };
    }

    // 5. Render "More Like This" (Similar Games)
    if (similarGrid) {
      const simList = Array.isArray(details.similarGames) ? details.similarGames : [];
      if (simList.length === 0) {
        // Fallback to local games of the same console
        const localSameConsole = (appState.games || [])
          .filter(g => g.consoleId === game.consoleId && g.id !== game.id)
          .slice(0, 6);
        if (localSameConsole.length === 0) {
          similarGrid.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">Nenhum jogo similar encontrado para este título.</div>`;
        } else {
          similarGrid.innerHTML = '';
          for (const lg of localSameConsole) {
            const sCard = document.createElement('div');
            sCard.className = 'similar-game-card';
            sCard.innerHTML = `
              <img src="${lg.thumbUrl || lg.coverUrl || lg.fallbackCoverUrl}" class="similar-game-art" loading="lazy" alt="${lg.title}">
              <div class="similar-game-info">
                <div class="similar-game-title" title="${lg.title}">${lg.title}</div>
                <div class="similar-game-badge">★ Na sua Biblioteca</div>
              </div>
            `;
            sCard.onclick = () => {
              playSfx('select');
              selectGame(lg);
            };
            similarGrid.appendChild(sCard);
          }
        }
      } else {
        similarGrid.innerHTML = '';
        for (const sg of simList) {
          const inLib = Boolean(sg.inLibrary || sg.localGameId);
          const sCard = document.createElement('div');
          sCard.className = 'similar-game-card';
          sCard.innerHTML = `
            <img src="${sg.coverUrl}" class="similar-game-art" loading="lazy" alt="${sg.title}">
            <div class="similar-game-info">
              <div class="similar-game-title" title="${sg.title}">${sg.title}</div>
              <div class="similar-game-badge ${inLib ? '' : 'external'}">
                ${inLib ? '★ Na sua Biblioteca' : '🔍 Similar no Hydra'}
              </div>
            </div>
          `;
          const artImg = sCard.querySelector('img');
          if (artImg) {
            artImg.onerror = () => { sCard.remove(); };
          }
          sCard.onclick = () => {
            playSfx('select');
            if (sg.localGameId) {
              const found = (appState.games || []).find(g => g.id === sg.localGameId);
              if (found) {
                selectGame(found);
                return;
              }
            }
            showToast(`Jogo similar sugerido pelo Hydra: ${sg.title}`);
          };
          similarGrid.appendChild(sCard);
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao carregar detalhes completos:', err);
  }
}

// --- RIGHT-CLICK CONTEXT MENU & REMOVE GAME MODAL ---
let contextMenuGame = null;

function openGameContextMenu(e, game) {
  contextMenuGame = game;
  playSfx('nav');
  const menu = document.getElementById('game-context-menu');
  if (!menu) return;

  document.getElementById('ctx-game-title').textContent = game.title;
  document.getElementById('ctx-fav-icon').textContent = game.favorite ? '★' : '☆';
  document.getElementById('ctx-fav-label').textContent = game.favorite
    ? 'Remover dos Favoritos'
    : 'Adicionar aos Favoritos';

  menu.classList.remove('hidden');

  const menuWidth = 260;
  const menuHeight = 310;
  let posX = e.clientX;
  let posY = e.clientY;
  if (posX + menuWidth > window.innerWidth - 12) posX = window.innerWidth - menuWidth - 12;
  if (posY + menuHeight > window.innerHeight - 12) posY = window.innerHeight - menuHeight - 12;

  menu.style.left = `${Math.max(8, posX)}px`;
  menu.style.top = `${Math.max(8, posY)}px`;

  document.getElementById('ctx-play').onclick = () => {
    closeGameContextMenu();
    playSfx('launch');
    launchSelectedGame(game.id, 0);
  };

  document.getElementById('ctx-details').onclick = () => {
    closeGameContextMenu();
    playSfx('select');
    selectGame(game);
  };

  document.getElementById('ctx-favorite').onclick = async () => {
    closeGameContextMenu();
    playSfx('fav');
    await toggleFavorite(game.id);
    showToast(game.favorite ? `Removido dos favoritos: ${game.title}` : `⭐ Adicionado aos favoritos: ${game.title}`);
  };

  document.getElementById('ctx-cover').onclick = () => {
    closeGameContextMenu();
    selectedGameId = game.id;
    openCoverSelector(game.id);
  };

  document.getElementById('ctx-hd-art').onclick = async () => {
    closeGameContextMenu();
    showToast(`🎨 Buscando artes HD para ${game.title}...`);
    try {
      const res = await fetch('/api/steamgrid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, apiKey: appState.config?.steamGridDbApiKey || '' })
      });
      if (res.ok) {
        showToast('Artes HD aplicadas com sucesso!');
        await fetchState();
      }
    } catch {}
  };

  document.getElementById('ctx-sync-ach').onclick = async () => {
    closeGameContextMenu();
    showToast(`🏆 Sincronizando conquistas e metadados de ${game.title}...`);
    try {
      await fetch('/api/metadata/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id })
      });
      const res = await fetch('/api/achievements/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id })
      });
      const data = await res.json();
      await fetchState();
      showToast(`✅ ${data.officialCount || data.achievements?.length || 0} conquistas sincronizadas!`);
    } catch {}
  };

  document.getElementById('ctx-open-folder').onclick = () => {
    closeGameContextMenu();
    openGameFileLocation(game.id);
  };

  document.getElementById('ctx-remove').onclick = () => {
    closeGameContextMenu();
    openRemoveGameModal(game);
  };
}

function closeGameContextMenu() {
  const menu = document.getElementById('game-context-menu');
  if (menu && !menu.classList.contains('hidden')) {
    menu.classList.add('hidden');
  }
}

function closeSidebarContextMenu() {
  const menu = document.getElementById('sidebar-context-menu');
  if (menu && !menu.classList.contains('hidden')) {
    menu.classList.add('hidden');
  }
}

async function scanSingleConsole(consoleId) {
  closeSidebarContextMenu();
  const cCfg = appState.config?.consoles?.[consoleId];
  const cName = cCfg?.name || consoleId;
  showToast(`🔄 Escaneando ROMs de ${cName}...`);
  playSfx('select');
  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consoleId })
    });
    const data = await res.json();
    playSfx('fav');
    showToast(`✅ ${cName}: ${data.totalGames || 0} ROMs encontradas (${data.newGamesCount || 0} novas)!`);
    await fetchState();
    switchTab(consoleId);
  } catch {
    showToast(`Erro ao escanear ${cName}`);
  }
}

async function scanAllLibraryUnified() {
  showToast('🔄 Escaneamento Geral: buscando todas as ROMs, Jogos de PC, Steam, Epic, GOG e Xbox Game Pass...');
  playSfx('launch');
  try {
    const res = await fetch('/api/scan/all', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.ok) {
      playSfx('fav');
      showToast(`🎉 Biblioteca completa sincronizada! ${data.totalGames} jogos no acervo (${data.newGamesCount || 0} novos detectados)!`);
      await fetchState();
      renderCatalogue();
    } else {
      showToast('Erro ao realizar escaneamento geral');
    }
  } catch {
    showToast('Falha de conexão com o servidor');
  }
}
window.scanSingleConsole = scanSingleConsole;
window.scanAllLibraryUnified = scanAllLibraryUnified;

function openSidebarContextMenu(e, tab) {
  e.preventDefault();
  e.stopPropagation();
  closeGameContextMenu();
  closeSidebarContextMenu();
  playSfx('nav');

  const menu = document.getElementById('sidebar-context-menu');
  const titleEl = document.getElementById('sidebar-ctx-title');
  const itemsEl = document.getElementById('sidebar-ctx-items');
  if (!menu || !titleEl || !itemsEl) return;

  const consoles = appState.config?.consoles || {};
  const cCfg = consoles[tab];
  const cName = cCfg?.name || (tab === 'ALL' ? 'Todos os Jogos' : (tab === 'FAVORITES' ? 'Meus Favoritos' : (tab === 'RECENT' ? 'Últimos Jogados' : tab)));

  titleEl.textContent = cName.toUpperCase();
  itemsEl.innerHTML = '';

  const addItem = (icon, label, onClick, isDanger = false) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ctx-item ${isDanger ? 'danger' : ''}`;
    btn.innerHTML = `<span class="ctx-icon">${icon}</span><span>${label}</span>`;
    btn.onclick = () => {
      closeSidebarContextMenu();
      onClick();
    };
    itemsEl.appendChild(btn);
  };

  const addDivider = () => {
    const div = document.createElement('div');
    div.className = 'ctx-divider';
    itemsEl.appendChild(div);
  };

  if (tab === 'PC') {
    addItem('➕', 'Adicionar Executável (.EXE)', () => window.addPcExeGame());
    addItem('📁', 'Adicionar Pasta de Jogos PC', () => window.addPcFolder());
    addItem('🔄', 'Escanear Pastas de Jogos de PC', () => window.scanPcGamesNow());
    addDivider();
    addItem('📂', 'Abrir Pasta ROMS\\PC', () => window.openExplorer('ROMS\\PC'));
  } else if (tab === 'STEAM') {
    addItem('🔄', 'Escanear Jogos Instalados da Steam', () => window.syncSteamAccount());
    addItem('🌐', 'Configurar Conta Steam (SteamID64)', () => {
      currentSettingsSubTab = 'integrations';
      switchTab('SETTINGS');
    });
  } else if (tab === 'EPIC') {
    addItem('🔄', 'Escanear Jogos Instalados da Epic Games', () => window.scanOfficialStores());
    addItem('⚡', 'Sincronizar Acervo Legendary (Epic)', () => window.syncEpicAccount());
  } else if (tab === 'GOG') {
    addItem('🔄', 'Escanear Jogos do GOG Galaxy', () => window.scanOfficialStores());
  } else if (tab === 'XBOX') {
    addItem('🟢', 'Escanear Xbox Game Pass (Todos os Discos)', () => window.scanXboxGamePass());
    addItem('📁', 'Adicionar Pasta Xbox Personalizada', () => window.addXboxFolder());
  } else if (cCfg) {
    addItem('🔄', `Escanear ROMs de ${cCfg.shortName || tab}`, () => scanSingleConsole(tab));
    addItem('📂', `Abrir Pasta ROMS\\${tab}`, () => window.openExplorer(cCfg.romFolder || `ROMS\\${tab}`));
    addDivider();
    addItem('⚙️', `Configurar Emulador / Cores`, () => {
      currentSettingsSubTab = 'emulators';
      switchTab('SETTINGS');
    });
  } else if (tab === 'ALL') {
    addItem('🔄', 'Escaneamento Geral Unificado (Tudo)', () => scanAllLibraryUnified());
    addItem('📂', 'Abrir Pasta Raiz ROMS\\', () => window.openExplorer('ROMS'));
  } else if (tab === 'HOME') {
    addItem('🔥', 'Recarregar Destaques da Home', () => renderHomeView());
    addItem('✨', 'Surpreenda-me!', () => surpriseMe());
  } else if (tab === 'DOWNLOADS') {
    addItem('➕', 'Adicionar Torrent / Magnet', () => openAddDownloadModal());
    addItem('📂', 'Abrir Pasta de Downloads', () => fetch('/api/downloads/open-folder', { method: 'POST' }));
    addItem('🔄', 'Sincronizar Fontes de Repacks', () => syncAllSourcesNow());
  } else {
    addItem('📖', `Abrir Aba ${tab}`, () => switchTab(tab));
  }

  menu.classList.remove('hidden');

  const menuWidth = 260;
  const menuHeight = itemsEl.children.length * 36 + 45;
  let posX = e.clientX;
  let posY = e.clientY;
  if (posX + menuWidth > window.innerWidth - 12) posX = window.innerWidth - menuWidth - 12;
  if (posY + menuHeight > window.innerHeight - 12) posY = window.innerHeight - menuHeight - 12;

  menu.style.left = `${Math.max(8, posX)}px`;
  menu.style.top = `${Math.max(8, posY)}px`;
}

async function openGameFileLocation(gameId) {
  playSfx('select');
  try {
    const res = await fetch('/api/game/open-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId })
    });
    if (!res.ok) {
      showToast('Não foi possível abrir o local do arquivo');
    }
  } catch {
    showToast('Erro ao abrir o Windows Explorer');
  }
}

function openRemoveGameModal(game) {
  if (!game) return;
  playSfx('select');
  const modal = document.getElementById('remove-game-modal');
  if (!modal) return;

  document.getElementById('remove-game-name').textContent = game.title;
  document.getElementById('remove-file-path').textContent = game.romPath || game.fileName || '';
  const chk = document.getElementById('remove-delete-files-chk');
  if (chk) chk.checked = false;

  modal.classList.remove('hidden');

  const closeModal = () => {
    modal.classList.add('hidden');
  };

  document.getElementById('close-remove-modal').onclick = closeModal;
  document.getElementById('btn-cancel-remove').onclick = closeModal;

  document.getElementById('btn-confirm-remove').onclick = async () => {
    const deleteFiles = Boolean(chk && chk.checked);
    closeModal();
    showToast(`Removendo ${game.title} da biblioteca...`);
    try {
      const res = await fetch('/api/game/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, deleteFiles })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        playSfx('back');
        showToast(data.deletedFile ? `🗑️ ${game.title} excluído da biblioteca e do disco!` : `✅ ${game.title} removido da biblioteca!`);
        if (selectedGameId === game.id) {
          closeGameDetails();
        }
        lastGamesDataKey = '';
        await fetchState();
      } else {
        showToast(data.error || 'Erro ao remover jogo');
      }
    } catch {
      showToast('Falha ao comunicar com o servidor');
    }
  };
}


let currentHltbGameId = null;

async function loadGameHltb(game) {
  currentHltbGameId = game.id;
  const loadingEl = document.getElementById('hltb-loading');
  const statsGrid = document.getElementById('hltb-stats-grid');
  const mainEl = document.getElementById('hltb-main');
  const extraEl = document.getElementById('hltb-extra');
  const compEl = document.getElementById('hltb-comp');
  const linkEl = document.getElementById('hltb-external-link');
  const scoreEl = document.getElementById('hltb-review-score');
  const matchedEl = document.getElementById('hltb-matched-name');

  mainEl.textContent = '--';
  extraEl.textContent = '--';
  compEl.textContent = '--';
  linkEl.href = `https://howlongtobeat.com/?q=${encodeURIComponent(game.title)}`;
  scoreEl.textContent = '';
  matchedEl.textContent = '';

  const applyHltbData = (data) => {
    mainEl.innerHTML = `${data.mainTime || '--'}${data.mainAccuracy ? `<small style="display:block;font-size:10px;color:#9ca3af;font-weight:500;margin-top:2px;">Precisão: ${data.mainAccuracy}</small>` : ''}`;
    extraEl.innerHTML = `${data.mainExtraTime || '--'}${data.mainExtraAccuracy ? `<small style="display:block;font-size:10px;color:#9ca3af;font-weight:500;margin-top:2px;">Precisão: ${data.mainExtraAccuracy}</small>` : ''}`;
    compEl.innerHTML = `${data.completionistTime || '--'}${data.completionistAccuracy ? `<small style="display:block;font-size:10px;color:#9ca3af;font-weight:500;margin-top:2px;">Precisão: ${data.completionistAccuracy}</small>` : ''}`;
    if (data.url) linkEl.href = data.url;
    if (data.reviewScore) scoreEl.textContent = `⭐ Avaliação da Comunidade: ${data.reviewScore}%`;
    if (data.name) matchedEl.textContent = `Correspondência: ${data.name}${data.source && data.source.includes('hydra_api') ? ' • Hydra HLTB API' : ''}`;
  };

  if (game.hltbData) {
    applyHltbData(game.hltbData);
    loadingEl.classList.add('hidden');
    statsGrid.classList.remove('hidden');
    return;
  }

  loadingEl.classList.remove('hidden');
  statsGrid.classList.add('hidden');

  try {
    const res = await fetch('/api/hltb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: game.id, title: game.title })
    });
    const result = await res.json();
    if (currentHltbGameId !== game.id) return;

    loadingEl.classList.add('hidden');
    statsGrid.classList.remove('hidden');

    if (result.ok && result.data) {
      game.hltbData = result.data;
      applyHltbData(result.data);
    } else {
      mainEl.textContent = 'N/D';
      extraEl.textContent = 'N/D';
      compEl.textContent = 'N/D';
      matchedEl.textContent = 'Sem dados no HowLongToBeat';
    }
  } catch (e) {
    if (currentHltbGameId === game.id) {
      loadingEl.classList.add('hidden');
      statsGrid.classList.remove('hidden');
      mainEl.textContent = 'N/D';
      extraEl.textContent = 'N/D';
      compEl.textContent = 'N/D';
      matchedEl.textContent = 'Consulta indisponível';
    }
  }
}

async function autoEnrichGameMetadata(game) {
  if (!game || game.metadataEnriched) return;
  const isGeneric = !game.description || game.description.startsWith('Um clássico atemporal');
  if (!isGeneric) return;

  try {
    const res = await fetch('/api/metadata/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: game.id })
    });
    const data = await res.json();
    if (data.ok && data.game) {
      Object.assign(game, data.game);
      if (selectedGameId === game.id) {
        document.getElementById('details-description').textContent = game.description || '';
        document.getElementById('details-dev').textContent = game.developer || '---';
        document.getElementById('details-pub').textContent = game.publisher || '---';
        if (game.releaseYear) {
          document.getElementById('details-year-badge').textContent = game.releaseYear;
        }
      }
    }
  } catch {}
}


function updateDetailsLiveStats(game) {
  document.getElementById('details-playtime').textContent = formatPlaytime(game.playTimeSeconds);
  document.getElementById('details-lastplayed').textContent = formatDate(game.lastPlayedAt);
  const favBtn = document.getElementById('btn-fav-toggle');
  favBtn.textContent = game.favorite ? '★' : '☆';

  const achList = document.getElementById('details-ach-list');
  const achs = game.achievements || [];
  const achSummary = document.getElementById('details-ach-Summary');
  if (achs.length === 0) {
    achSummary.textContent = '0 / 0';
    achList.innerHTML = `
      <div style="padding:14px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.1);color:#9ca3af;font-size:12px;text-align:center;line-height:1.6;">
        <span style="font-size:18px;display:block;margin-bottom:4px;">🏆</span>
        Sem conquistas cadastradas.<br>
        Clique em <strong>🔄 Sincronizar</strong> ou conecte sua conta <strong>RetroAchievements.org</strong> nas <em>Configurações</em>.
      </div>
    `;
  } else {
    const unlockedCount = achs.filter(a => a.unlocked).length;
    const totalPts = achs.reduce((acc, a) => acc + (a.points || 0), 0);
    const earnedPts = achs.filter(a => a.unlocked).reduce((acc, a) => acc + (a.points || 0), 0);
    achSummary.textContent = `${unlockedCount} / ${achs.length} (${earnedPts}/${totalPts} PTS)`;
    achList.innerHTML = achs.map(a => {
      const isImgIcon = a.icon && (a.icon.startsWith('http://') || a.icon.startsWith('https://') || a.icon.startsWith('/'));
      const iconHtml = isImgIcon
        ? `<img src="${a.icon}" width="36" height="36" style="border-radius:6px;object-fit:cover;filter:${a.unlocked ? 'none' : 'grayscale(1) opacity(0.65)'};" loading="lazy">`
        : `<span style="font-size:20px;">${a.icon || '🏆'}</span>`;

      const metaBadges = [];
      if (a.unlocked && a.unlockTime) {
        metaBadges.push(`<span style="color:#10b981;font-size:10px;">✓ ${new Date(a.unlockTime).toLocaleDateString('pt-BR')}</span>`);
      }
      if (a.hardcore) {
        metaBadges.push(`<span style="color:#f59e0b;font-size:10px;font-weight:700;">🔥 HARDCORE</span>`);
      }
      if (typeof a.globalUnlockPercentage === 'number') {
        metaBadges.push(`<span style="color:#9ca3af;font-size:10px;">🌍 ${a.globalUnlockPercentage.toFixed(1)}%</span>`);
      }

      return `
        <div class="ach-item ${a.unlocked ? 'unlocked' : ''}">
          <span class="ach-icon">${iconHtml}</span>
          <div class="ach-info">
            <div class="ach-title">${a.title}</div>
            <div class="ach-desc">${a.description || ''}</div>
            ${metaBadges.length > 0 ? `<div style="display:flex;gap:8px;margin-top:3px;flex-wrap:wrap;">${metaBadges.join('')}</div>` : ''}
          </div>
          <span class="ach-pts">+${a.points || 0} PTS</span>
        </div>
      `;
    }).join('');
  }
}
async function launchSelectedGame(gameId, discIndex = 0) {
  if (isLaunching) {
    showToast('Aguarde, jogo já está iniciando...');
    return;
  }
  isLaunching = true;

  const game = (appState.games || []).find(g => g.id === gameId);
  const overlay = document.getElementById('game-launcher-overlay');
  const splashTitle = document.getElementById('splash-game-title');
  const splashSub = document.getElementById('splash-game-sub');
  const splashCover = document.getElementById('splash-cover-img');
  const splashBg = document.getElementById('splash-bg');
  const splashConsole = document.getElementById('splash-console-badge');
  const splashPlaytime = document.getElementById('splash-playtime-badge');
  const step1 = document.getElementById('splash-step-1');
  const step2 = document.getElementById('splash-step-2');
  const step3 = document.getElementById('splash-step-3');

  if (overlay && game) {
    if (splashTitle) splashTitle.textContent = game.title || 'Iniciando Jogo...';
    if (splashSub) splashSub.textContent = `Preparando ${game.consoleId === 'PC' ? 'Jogo de PC' : 'Emulador ' + (game.consoleId || '')}...`;
    if (splashConsole) splashConsole.textContent = (game.consoleId || 'PC').toUpperCase();
    if (splashPlaytime) splashPlaytime.textContent = `⏱️ ${formatPlaytime(game.playTimeSeconds || 0)}`;

    const coverSrc = game.heroUrl || game.coverUrl || game.fallbackCoverUrl || '';
    if (splashCover) splashCover.src = game.coverUrl || game.heroUrl || '';
    if (splashBg && coverSrc) splashBg.style.backgroundImage = `url("${coverSrc}")`;

    if (step1) step1.className = 'splash-step active';
    if (step2) step2.className = 'splash-step';
    if (step3) step3.className = 'splash-step';

    overlay.classList.remove('hidden');
    playSfx('launch');
  } else {
    showToast('Iniciando jogo em tela cheia...');
  }

  try {
    // Step 2: Sincronizando
    setTimeout(() => {
      if (step1) step1.className = 'splash-step';
      if (step2) step2.className = 'splash-step active';
      if (splashSub) splashSub.textContent = 'Verificando integridade e preparando tela cheia...';
    }, 450);

    const res = await fetch('/api/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, discIndex })
    });
    const data = await res.json();

    if (step2) step2.className = 'splash-step';
    if (step3) step3.className = 'splash-step active';
    if (splashSub) splashSub.textContent = 'Jogo em execução!';

    if (!res.ok) {
      showToast(`Erro: ${data.error}`);
    } else {
      await fetchState();
    }
  } catch (e) {
    showToast('Falha ao iniciar o jogo');
  } finally {
    setTimeout(() => {
      if (overlay) overlay.classList.add('hidden');
      isLaunching = false;
    }, 1200);
  }
}

async function toggleFavorite(gameId) {
  const res = await fetch('/api/favorite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gameId })
  });
  if (res.ok) {
    await fetchState();
  }
}

function renderAchievementsView() {
  const games = appState.games || [];
  const totalSec = appState.stats?.totalPlayTimeSeconds || 0;
  const playedGames = games.filter(g => (g.playCount || 0) > 0).length;
  let unlocked = 0;
  let totalPoints = 0;
  for (const g of games) {
    for (const a of (g.achievements || [])) {
      if (a.unlocked) {
        unlocked++;
        totalPoints += a.points;
      }
    }
  }

  document.getElementById('stats-overview-grid').innerHTML = `
    <div class="stat-card-big">
      <span>TEMPO TOTAL DE JOGO</span>
      <strong>${formatPlaytime(totalSec)}</strong>
    </div>
    <div class="stat-card-big">
      <span>JOGOS EXPERIMENTADOS</span>
      <strong>${playedGames} de ${games.length}</strong>
    </div>
    <div class="stat-card-big">
      <span>CONQUISTAS DESBLOQUEADAS</span>
      <strong>${unlocked} 🏆</strong>
    </div>
    <div class="stat-card-big">
      <span>PONTOS RETRO (SCORE)</span>
      <strong>${totalPoints} PTS</strong>
    </div>
  `;

  const achGamesEl = document.getElementById('achievements-games-list');
  if (achGamesEl) {
    const gamesWithProgress = games
      .map(g => {
        const list = g.achievements || [];
        const uCount = list.filter(a => a.unlocked).length;
        const pts = list.filter(a => a.unlocked).reduce((s, a) => s + (a.points || 0), 0);
        const isOfficial = Array.isArray(g.raAchievements) && g.raAchievements.length > 0;
        return { game: g, total: list.length, unlocked: uCount, points: pts, isOfficial };
      })
      .filter(item => item.unlocked > 0 || item.isOfficial)
      .sort((a, b) => (b.unlocked - a.unlocked) || (b.total - a.total));

    if (gamesWithProgress.length === 0) {
      achGamesEl.innerHTML = `<div class="session-row"><span>Nenhum jogo com conquistas sincronizadas ou desbloqueadas ainda. Clique em "🔄 Sincronizar Conquistas (Hydra API)" acima ou abra os detalhes de um jogo!</span></div>`;
    } else {
      achGamesEl.innerHTML = gamesWithProgress.slice(0, 40).map(item => {
        const pct = item.total > 0 ? Math.round((item.unlocked / item.total) * 100) : 0;
        return `
          <div class="session-row" style="cursor:pointer;" onclick="window.openGameFromAchievements('${item.game.id.replace(/'/g, "\\'")}')">
            <div style="flex:1;">
              <strong>${item.game.title}</strong>
              <span style="margin-left:8px;font-size:11px;color:#9ca3af;">[${item.game.consoleId}] ${item.isOfficial ? '• Oficial Hydra / RA' : '• Marcos Clássicos'}</span>
              <div style="margin-top:6px;height:6px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;max-width:340px;">
                <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#10b981,#34d399);"></div>
              </div>
            </div>
            <div style="text-align:right;">
              <strong style="color:#10b981;">${item.unlocked} / ${item.total} (${pct}%)</strong>
              <div style="font-size:11px;color:#f59e0b;margin-top:2px;">+${item.points} PTS</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  const sList = document.getElementById('sessions-list');
  const sessions = appState.sessions || [];
  if (sessions.length === 0) {
    sList.innerHTML = `<div class="session-row"><span>Nenhuma sessão registrada ainda. Inicie qualquer jogo para contabilizar suas horas!</span></div>`;
  } else {
    sList.innerHTML = sessions.map(s => `
      <div class="session-row">
        <div>
          <strong>${s.title}</strong>
          <span style="margin-left:8px;font-size:12px;color:#9ca3af;">[${s.consoleId}] • ${formatDate(s.startedAt)}</span>
        </div>
        <strong style="color:#10b981;">+${formatPlaytime(s.durationSeconds)}</strong>
      </div>
    `).join('');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSettingsView() {
  const sidebar = document.getElementById('settings-sidebar');
  const panelTitle = document.getElementById('settings-panel-title');
  const panelContent = document.getElementById('settings-panel-content');
  const fallbackContainer = document.getElementById('settings-container');

  if (!sidebar && !fallbackContainer) return;

  const SETTINGS_CATEGORIES = [
    {
      id: 'general',
      label: 'Geral',
      icon: `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 0a8.2 8.2 0 0 0-.701.031C7.05.284 6.7 1.455 5.53 1.94c-.45.187-.935.244-1.424.167-.887-.138-1.748-.687-2.095-.595-.494.131-.95.344-1.36.626-.307.21-.295 1.042-.016 1.84.14.4.17.84.088 1.28-.212 1.135-.98 1.936-1.577 2.21-.42.193-.42.54-.42.54s0 .347.42.54c.597.274 1.365 1.075 1.577 2.21.082.44.052.88-.088 1.28-.279.798-.291 1.63.016 1.84.41.282.866.495 1.36.626.347.092 1.208-.457 2.095-.595.489-.077.974-.02 1.424.167 1.17.485 1.52 1.656 1.769 1.909.222.226.545.226.701.031.156-.195.509-1.367 1.679-1.852.45-.187.935-.244 1.424-.167.887.138 1.748.687 2.095.595.494-.131.95-.344 1.36-.626.307-.21.295-1.042.016-1.84-.14-.4-.17-.84-.088-1.28.212-1.135.98-1.936 1.577-2.21-.42-.193-.42-.54-.42-.54s0-.347-.42-.54c-.597-.274-1.365-1.075-1.577-2.21-.082-.44-.052-.88.088-1.28.279-.798.291-1.63-.016-1.84-.41-.282-.866-.495-1.36-.626-.347-.092-1.208.457-2.095.595-.489.077-.974.02-1.424-.167-1.17-.485-1.52-1.656-1.769-1.909C8.545.031 8.222.031 8 0Zm0 5.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"></path></svg>`
    },
    {
      id: 'downloads',
      label: 'Downloads',
      icon: `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z"></path><path d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z"></path></svg>`
    },
    {
      id: 'sources',
      label: 'Fontes de download',
      icon: `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-1.2 8.725-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 2.83 2.83l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"></path></svg>`
    },
    {
      id: 'folders',
      label: 'Pastas monitoradas',
      icon: `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"></path></svg>`
    },
    {
      id: 'integrations',
      label: 'Lojas & integrações',
      icon: `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M4.5 13a3.5 3.5 0 0 1-.5-6.964 5.5 5.5 0 0 1 10.457-1.396A4 4 0 0 1 13 13H4.5Z"></path></svg>`
    },
    {
      id: 'emulators',
      label: 'Emulação & saves',
      group: 'CLÁSSICOS & RETRÔ',
      icon: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="10" y1="12" y2="12"></line><line x1="8" x2="8" y1="10" y2="14"></line><line x1="15" x2="15.01" y1="13" y2="13"></line><line x1="18" x2="18.01" y1="11" y2="11"></line><rect width="20" height="12" x="2" y="6" rx="6"></rect></svg>`
    },
    {
      id: 'account',
      label: 'Conta & perfil',
      group: 'USUÁRIO',
      icon: `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 0c-.69 0-1.84.2-3.25.68A19.06 19.06 0 0 0 1.25 2.37a.75.75 0 0 0-.5.71c0 4.18 1.2 8.23 3.66 10.97A9.87 9.87 0 0 0 8 16a9.87 9.87 0 0 0 3.59-1.95c2.46-2.74 3.66-6.79 3.66-10.97a.75.75 0 0 0-.5-.71 19.06 19.06 0 0 0-3.5-1.69C9.84.2 8.69 0 8 0Zm0 1.55c.67 0 1.68.18 2.97.62a17.5 17.5 0 0 1 3.03 1.4c0 3.65-1.03 7.15-3.15 9.5A8.37 8.37 0 0 1 8 14.5a8.37 8.37 0 0 1-2.85-1.43c-2.12-2.35-3.15-5.85-3.15-9.5a17.5 17.5 0 0 1 3.03-1.4c1.29-.44 2.3-.62 2.97-.62Z"></path></svg>`
    }
  ];

  if (!currentSettingsSubTab) currentSettingsSubTab = 'general';
  if (currentSettingsSubTab === 'download_sources') currentSettingsSubTab = 'sources';

  // Render Sidebar
  if (sidebar) {
    let prevGroup = undefined;
    sidebar.innerHTML = SETTINGS_CATEGORIES.map(category => {
      let groupHtml = '';
      if (category.group && category.group !== prevGroup) {
        prevGroup = category.group;
        groupHtml = `
          <div class="settings__sidebar-group">
            <div class="settings__sidebar-divider"></div>
            <span class="settings__sidebar-group-label">${category.group}</span>
          </div>
        `;
      }
      const isActive = currentSettingsSubTab === category.id;
      return `
        ${groupHtml}
        <button type="button" class="settings__sidebar-button ${isActive ? 'settings__sidebar-button--active' : ''}" data-cat="${category.id}">
          <span class="settings__sidebar-button-icon">${category.icon}</span>
          <span class="settings__sidebar-button-label">${category.label}</span>
        </button>
      `;
    }).join('');

    sidebar.querySelectorAll('.settings__sidebar-button').forEach(btn => {
      btn.onclick = () => {
        currentSettingsSubTab = btn.dataset.cat;
        playSfx('nav');
        renderSettingsView();
      };
    });
  }

  const currentCategory = SETTINGS_CATEGORIES.find(c => c.id === currentSettingsSubTab) || SETTINGS_CATEGORIES[0];
  if (panelTitle) {
    panelTitle.textContent = currentCategory.label;
  }

  const cfg = appState.config || {};
  const dlCfg = cfg.downloadSettings || {
    downloadPath: 'D:\\HydraDownloads',
    maxDownloadSpeedKb: 0,
    maxUploadSpeedKb: 0,
    continueSeeding: true,
    autoExtract: true,
    deleteAfterExtract: false,
    createDesktopShortcut: true
  };

  let html = '';

  if (currentSettingsSubTab === 'general') {
    html = `
      <div class="settings-card">
        <h3>🖥️ Geral & Comportamento de Inicialização</h3>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">
          Configurações do aplicativo, integração com inicialização do Windows e bandeja do sistema.
        </p>

        <div class="field-row" style="align-items:center;">
          <label>Iniciar HydraRetro com o Windows:</label>
          <div class="field-input-group">
            <input type="checkbox" id="cfg-launch-startup" ${cfg.launchOnStartup ? 'checked' : ''} style="width:18px;height:18px;">
            <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">Inicia automaticamente ao ligar o computador (HKCU Run)</span>
          </div>
        </div>

        <div class="field-row" style="align-items:center;">
          <label>Iniciar Minimizado:</label>
          <div class="field-input-group">
            <input type="checkbox" id="cfg-launch-minimized" ${cfg.launchMinimized ? 'checked' : ''} style="width:18px;height:18px;">
            <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">Abre em segundo plano sem tomar foco</span>
          </div>
        </div>

        <div class="field-row" style="align-items:center;">
          <label>Minimizar para a Bandeja do Sistema (Tray):</label>
          <div class="field-input-group">
            <input type="checkbox" id="cfg-minimize-tray" ${cfg.minimizeToTray !== false ? 'checked' : ''} style="width:18px;height:18px;">
            <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">Mantém em execução na bandeja para downloads e foco ágil</span>
          </div>
        </div>

        <div class="field-row">
          <label>Idioma da Interface:</label>
          <div class="field-input-group">
            <select id="cfg-app-language" style="max-width:260px;">
              <option value="pt-BR" selected>Português do Brasil (pt-BR)</option>
              <option value="en-US">English (en-US)</option>
            </select>
          </div>
        </div>

        <div class="field-row">
          <label>Pasta Padrão de Downloads:</label>
          <div class="field-input-group">
            <input type="text" id="cfg-dl-path-general" value="${dlCfg.downloadPath || 'D:\\HydraDownloads'}">
            <button type="button" class="btn-secondary" onclick="window.openExplorer('${(dlCfg.downloadPath || 'D:\\HydraDownloads').replace(/\\/g, '\\\\')}')">📂 Abrir Pasta</button>
          </div>
        </div>

        <div style="margin-top:16px;display:flex;gap:10px;">
          <button type="button" class="play-btn-large" style="max-width:240px;" onclick="window.saveGeneralSettings()">💾 Salvar Preferências</button>
        </div>
      </div>

      <div class="settings-card">
        <h3>🔊 Áudio & Efeitos Sonoros de Interface (UI SFX)</h3>
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px;">
          Sons suaves e táteis de console gerados nativamente via Web Audio API para navegação por controle ou teclado.
        </p>
        <div style="display:flex;gap:12px;align-items:center;">
          <button class="btn-secondary" id="btn-toggle-sfx" onclick="window.toggleSfx()">
            ${sfxEnabled ? '🔊 Efeitos Sonoros: ATIVADOS' : '🔇 Efeitos Sonoros: DESATIVADOS'}
          </button>
          <button class="btn-secondary" onclick="playSfx('launch')">▶ Testar Som de Boot</button>
        </div>
      </div>
    `;
  } else if (currentSettingsSubTab === 'downloads') {
    html = `
      <div class="settings-card">
        <h3>⚡ Motor de Torrent, Downloads & Extração Automática</h3>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">
          O HydraRetro possui cliente BitTorrent nativo embutido via <strong>Libtorrent 2.x</strong> com suporte completo a Magnet links, arquivos .torrent e downloads diretos HTTP.
        </p>

        <div class="field-row">
          <label>Pasta Destino dos Downloads:</label>
          <div class="field-input-group">
            <input type="text" id="cfg-dl-path" value="${dlCfg.downloadPath || 'D:\\HydraDownloads'}">
            <button type="button" class="btn-secondary" onclick="window.openExplorer('${(dlCfg.downloadPath || 'D:\\HydraDownloads').replace(/\\/g, '\\\\')}')">📂 Abrir</button>
          </div>
        </div>

        <div class="field-row">
          <label>Limite de Download (KB/s):</label>
          <div class="field-input-group">
            <input type="number" id="cfg-dl-max-speed" value="${dlCfg.maxDownloadSpeedKb || 0}" style="max-width:180px;">
            <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">0 = Velocidade ilimitada máxima da sua conexão</span>
          </div>
        </div>

        <div class="field-row">
          <label>Limite de Upload / Seed (KB/s):</label>
          <div class="field-input-group">
            <input type="number" id="cfg-dl-upload-speed" value="${dlCfg.maxUploadSpeedKb || 0}" style="max-width:180px;">
            <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">0 = Velocidade ilimitada</span>
          </div>
        </div>

        <div class="field-row" style="align-items:center;">
          <label>Continuar Semeando (Seed):</label>
          <div class="field-input-group">
            <input type="checkbox" id="cfg-dl-seeding" ${dlCfg.continueSeeding !== false ? 'checked' : ''} style="width:18px;height:18px;">
            <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">Manter semeando torrents concluídos para ajudar a comunidade</span>
          </div>
        </div>

        <div class="field-row" style="align-items:center;">
          <label>Extração Automática de Compactados (.zip/.7z/.rar):</label>
          <div class="field-input-group">
            <input type="checkbox" id="cfg-dl-extract" ${dlCfg.autoExtract !== false ? 'checked' : ''} style="width:18px;height:18px;">
            <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">Extrai instaladores automaticamente após o término via 7-Zip portátil embutido</span>
          </div>
        </div>

        <div class="field-row" style="align-items:center;">
          <label>Excluir Arquivo Compactado Pós-Extração:</label>
          <div class="field-input-group">
            <input type="checkbox" id="cfg-dl-delete-archive" ${dlCfg.deleteAfterExtract ? 'checked' : ''} style="width:18px;height:18px;">
            <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">Economiza espaço em disco excluindo o arquivo .zip/.rar após extrair</span>
          </div>
        </div>

        <div class="field-row" style="align-items:center;">
          <label>Criar Atalho na Área de Trabalho:</label>
          <div class="field-input-group">
            <input type="checkbox" id="cfg-dl-shortcut" ${dlCfg.createDesktopShortcut !== false ? 'checked' : ''} style="width:18px;height:18px;">
            <span style="font-size:12px;color:var(--text-muted);margin-left:8px;">Cria atalho direto do jogo na Área de Trabalho do Windows</span>
          </div>
        </div>

        <div style="margin-top:16px;display:flex;gap:10px;">
          <button type="button" class="play-btn-large" style="max-width:240px;" onclick="window.saveDownloadConfig()">💾 Salvar Configurações de Download</button>
        </div>
      </div>
    `;
  } else if (currentSettingsSubTab === 'sources' || currentSettingsSubTab === 'download_sources') {
    const numberFormatter = new Intl.NumberFormat('pt-BR');
    let sources = window._cachedDownloadSources;
    if (!sources && cfg.downloadSources) {
      sources = cfg.downloadSources;
    }
    if (!sources) sources = [];

    html = `
      <p class="settings-download-sources__description">
        Hydra vai buscar links de download em todas as fontes habilitadas. A URL da fonte deve ser um link direto para um arquivo .json contendo uma lista de links.
      </p>

      <div class="settings-download-sources__header">
        <button type="button" class="button button--outline" id="btn-sync-sources" onclick="window.syncAllDownloadSourcesUI()">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" class="settings-icon-svg"><path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z"></path></svg>
          <span>Sincronizar</span>
        </button>

        <div class="settings-download-sources__buttons-container">
          <button type="button" class="button button--danger" id="btn-delete-all-sources" onclick="window.openDeleteAllSourcesModal()" ${sources.length === 0 ? 'disabled' : ''}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" class="settings-icon-svg"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a1.75 1.75 0 0 0 1.744 1.575h2.2c.904 0 1.66-.69 1.744-1.575l.66-6.6a.75.75 0 1 0-1.492-.15l-.66 6.6a.25.25 0 0 1-.249.225h-2.2a.25.25 0 0 1-.249-.225l-.66-6.6a.75.75 0 0 0-1.492.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"></path></svg>
            <span>Remover todas</span>
          </button>

          <button type="button" class="button button--outline" id="btn-open-add-source-modal" onclick="window.openAddSourceModal()">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" class="settings-icon-svg"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7.25-3.25v2.5h2.5a.75.75 0 0 1 0 1.5h-2.5v2.5a.75.75 0 0 1-1.5 0v-2.5h-2.5a.75.75 0 0 1 0-1.5h2.5v-2.5a.75.75 0 0 1 1.5 0Z"></path></svg>
            <span>Adicionar fonte</span>
          </button>
        </div>
      </div>

      <ul class="settings-download-sources__list" id="settings-download-sources-list">
        ${sources.length === 0 ? `
          <div style="background:#121215;border:1px dashed rgba(255,255,255,0.1);border-radius:8px;padding:36px 20px;text-align:center;color:#a1a1aa;">
            <p style="margin:0 0 12px 0;font-size:14px;">Nenhuma fonte de download cadastrada ainda.</p>
            <button type="button" class="button button--outline" onclick="window.openAddSourceModal()">
              ➕ Adicionar primeira fonte
            </button>
          </div>
        ` : sources.map(s => {
          const isMatching = s.status === 'MATCHING' || s.status === 'PENDING_MATCHING' || s.status === 'syncing';
          const isFailed = s.status === 'FAILED' || s.status === 'errored';
          const badgeClass = isMatching ? 'badge--matching' : (isFailed ? 'badge--failed' : 'badge--matched');
          const statusText = isMatching ? 'Sincronizando' : (isFailed ? 'Erro' : 'Sincronizada');
          const count = typeof s.downloadCount === 'number' ? s.downloadCount : (s.gamesCount || 0);

          return `
            <li class="settings-download-sources__item ${isMatching ? 'settings-download-sources__item--pending' : ''}">
              <div class="settings-download-sources__item-header">
                <div class="settings-download-sources__item-title-row">
                  <h2>${escapeHtml(s.name || 'Fonte Hydra')}</h2>
                  <span class="badge ${badgeClass}">
                    ${isMatching ? '<span class="settings-download-sources__spinner">⟳</span>' : ''}
                    ${statusText}
                  </span>
                </div>
                <div class="settings-download-sources__count-wrapper">
                  <small class="settings-download-sources__count">
                    ${isMatching ? 'Sem informações' : `${numberFormatter.format(count)} downloads`}
                  </small>
                </div>
              </div>

              <div class="text-field-container">
                <label class="text-field-container__label">URL da fonte</label>
                <div class="text-field-container__text-field">
                  <input type="text" class="text-field-container__text-field-input" value="${escapeHtml(s.url)}" readonly disabled>
                  <button type="button" class="button button--outline button--small button--danger-text" onclick="window.removeSingleDownloadSource('${s.id || s.url}')" title="Remover fonte">
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0ZM1.5 8a6.5 6.5 0 0 1 10.435-5.096L3.404 11.435A6.471 6.471 0 0 1 1.5 8Zm1.469 5.096 8.531-8.531A6.471 6.471 0 0 1 14.5 8a6.5 6.5 0 0 1-11.531 5.096Z"></path></svg>
                    <span>Remover</span>
                  </button>
                </div>
              </div>
            </li>
          `;
        }).join('')}
      </ul>
    `;
  } else if (currentSettingsSubTab === 'folders') {
    html = `
      <div class="settings-card">
        <h3>🖥️ Pastas Monitoradas de Jogos de PC (.EXE)</h3>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
          Adicione pastas onde você costuma instalar ou salvar jogos de PC. O HydraRetro monitora novos arquivos executáveis e sincroniza capas e metadados automaticamente.
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
          <button type="button" class="btn-secondary" style="color:var(--accent);border-color:var(--accent);" onclick="window.addPcExeGame()">
            ➕ Adicionar Executável (.EXE)
          </button>
          <button type="button" class="btn-secondary" style="color:#6ee7b7;border-color:rgba(16,185,129,0.4);" onclick="window.addPcFolder()">
            📁 Adicionar Pasta de Jogos de PC
          </button>
          <button type="button" class="btn-secondary" onclick="window.openExplorer('ROMS\\\\PC')">
            📂 Abrir Pasta ROMS\\PC
          </button>
        </div>
        <div id="pc-folders-container">
          <div style="font-size:12px;color:var(--text-dim);">Carregando pastas de PC...</div>
        </div>
      </div>

      <div class="settings-card">
        <h3>📁 Pastas de ROMs dos Consoles (Hot-Plug Automático)</h3>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
          Coloque qualquer ROM na pasta correspondente que o sistema indexa e busca capas em tempo real:
        </p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:10px;">
          ${Object.entries(cfg.consoles || {}).map(([cid, c]) => `
            <button type="button" class="btn-secondary" style="text-align:left;display:flex;align-items:center;justify-content:space-between;" onclick="window.openExplorer('${(c.romFolder || `ROMS\\\\${cid}`).replace(/\\/g, '\\\\')}')">
              <span>🎮 ${c.name} (${cid})</span>
              <span style="font-size:11px;color:var(--accent);">📂 Abrir</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  } else if (currentSettingsSubTab === 'integrations') {
    html = `
      <div class="settings-card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
          <div>
            <h3>🎮 Lojas Oficiais Integradas (Steam, Epic, GOG, Xbox / Game Pass)</h3>
            <p style="font-size:12px;color:var(--text-muted);">
              O HydraRetro detecta jogos instalados em todas as lojas oficiais do Windows com suporte a conquistas e execução nativa.
            </p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn-secondary" style="color:#10b981;border-color:rgba(16,185,129,0.4);" onclick="window.scanXboxGamePass()">
              🟢 Escanear Xbox Game Pass
            </button>
            <button type="button" class="btn-secondary" style="color:#6ee7b7;border-color:rgba(16,185,129,0.4);" onclick="window.addXboxFolder()">
              📁 Pasta Xbox
            </button>
            <button type="button" class="btn-secondary" style="color:#38bdf8;border-color:#38bdf8;" onclick="window.scanOfficialStores()">
              🔍 Re-escanear Todas as Lojas
            </button>
          </div>
        </div>

        <div id="steam-detected-accounts" style="margin-bottom:12px;">
          <div style="font-size:12px;color:var(--text-dim);">Detectando contas Steam no Windows...</div>
        </div>

        <div class="field-row">
          <label>SteamID64 da sua Conta:</label>
          <div class="field-input-group">
            <input type="text" id="cfg-steam-id" placeholder="Ex: 76561198000000000" value="${cfg.steamId64 || ''}">
            <button type="button" class="btn-secondary" style="color:#38bdf8;border-color:rgba(56,189,248,0.4);" onclick="window.syncSteamAccount()">
              🔄 Sincronizar Steam
            </button>
          </div>
        </div>

        <div class="field-row">
          <label>Steam Web API Key (Opcional):</label>
          <div class="field-input-group">
            <input type="password" id="cfg-steam-key" placeholder="Cole sua Steam Web API Key aqui (opcional)" value="${cfg.steamApiKey || ''}">
            <a href="https://steamcommunity.com/dev/apikey" target="_blank" class="btn-secondary" style="display:inline-flex;align-items:center;text-decoration:none;">🔑 Obter Chave Steam</a>
          </div>
        </div>

        <div id="epic-account-status" style="margin-top:12px;">
          <div style="font-size:12px;color:var(--text-dim);">Carregando status da Epic Games...</div>
        </div>
      </div>

      <div class="settings-card">
        <h3>🏆 Conquistas Oficiais (Hydra API, RetroAchievements.org & PC Local)</h3>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
          Conquistas integradas via Hydra API, RetroAchievements.org e emuladores locais de PC.
        </p>
        <div class="field-row">
          <label>Usuário RetroAchievements:</label>
          <div class="field-input-group">
            <input type="text" id="cfg-ra-user" placeholder="Seu usuário no RetroAchievements" value="${cfg.raUsername || ''}">
          </div>
        </div>
        <div class="field-row">
          <label>Senha RetroAchievements (para Token):</label>
          <div class="field-input-group">
            <input type="password" id="cfg-ra-pass" placeholder="${cfg.raToken ? 'Token já conectado (digite para renovar)' : 'Sua senha'}" value="">
          </div>
        </div>
        <div class="field-row">
          <label>Web API Key RetroAchievements:</label>
          <div class="field-input-group">
            <input type="password" id="cfg-ra-key" placeholder="Sua Web API Key (em Settings do site RetroAchievements.org)" value="${cfg.raWebApiKey || ''}">
          </div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;">
          <button type="button" class="btn-secondary" style="color:#10b981;border-color:rgba(16,185,129,0.45);" onclick="window.connectRetroAchievementsEmulators()">
            🔗 Conectar & Injetar nos Emuladores
          </button>
          <button type="button" class="btn-secondary" style="color:#38bdf8;border-color:rgba(56,189,248,0.45);" onclick="window.scanPcLocalAchievements()">
            🔍 Escanear Conquistas Locais de PC
          </button>
        </div>
      </div>
    `;
  } else if (currentSettingsSubTab === 'emulators') {
    html = `
      <div class="settings-card">
        <h3>💾 Gerenciador de Backup de Saves e Memory Cards (1 Clique)</h3>
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px;">
          Exporte todos os saves, memory cards e savestates dos seus emuladores (RetroArch, DuckStation, PCSX2, Dolphin, PPSSPP, RPCS3) em um único arquivo .ZIP consolidado.
        </p>
        <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
          <button class="btn-secondary" style="color:var(--accent);border-color:var(--accent);" onclick="window.exportSavesBackup()">📦 Criar Novo Backup Agora (.ZIP)</button>
          <button class="btn-secondary" onclick="window.openSavesFolder()">📂 Abrir Pasta de Backups</button>
          <button class="btn-secondary" onclick="window.loadBackupsList()">🔄 Atualizar Lista</button>
        </div>
        <div id="backups-list-container" class="backups-list-box">
          <div style="color:var(--text-muted);font-size:12px;">Carregando backups...</div>
        </div>
      </div>

      <div class="settings-card">
        <h3>🕹️ Mapeamento de Emuladores & Cores</h3>
        ${Object.entries(cfg.consoles || {}).map(([cid, c]) => `
          <div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
            <strong style="color:#fff;display:block;margin-bottom:4px;">${c.name} (${cid})</strong>
            <div style="font-size:11.5px;color:var(--text-muted);word-break:break-all;">
              <span>Executável: <code>${c.emulatorPath || 'Embutido'}</code></span>
              ${c.corePath ? `<br><span>Core: <code>${c.corePath}</code></span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (currentSettingsSubTab === 'account') {
    const prof = currentUserProfile || {};
    html = `
      <div class="settings-card">
        <h3>👤 Perfil do Jogador & Conta Hydra</h3>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">
          Configure suas informações visuais locais ou sincronize com sua conta oficial da Hydra Launcher Network.
        </p>
        <div style="display:flex;align-items:center;gap:18px;margin-bottom:20px;padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
          <img src="${prof.profileImageUrl || 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=100'}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2px solid #38bdf8;">
          <div>
            <h4 style="margin:0 0 4px 0;color:#fff;font-size:16px;">${prof.displayName || 'Gamer'} <span style="font-size:11px;color:var(--text-muted);font-weight:normal;">(@${prof.username || 'gamer'})</span></h4>
            <span style="font-size:12px;color:#10b981;font-weight:600;">${prof.subscription ? `Hydra ${prof.subscription}` : 'Modo Local / Conectado'}</span>
          </div>
          <div style="margin-left:auto;display:flex;gap:10px;">
            <button class="chip-btn primary" onclick="window.openEditProfileModal()">✏️ Editar Perfil</button>
            <button class="chip-btn" onclick="window.switchTab('PROFILE')">Ver Página de Perfil</button>
          </div>
        </div>

        <div style="padding:16px;background:rgba(2,132,199,0.08);border:1px solid rgba(2,132,199,0.3);border-radius:10px;">
          <strong style="color:#38bdf8;font-size:13px;display:block;margin-bottom:6px;">🔑 Conexão com API Oficial Hydra (Bearer Token)</strong>
          <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
            Ao conectar seu token da API do Hydra (<code>https://api.hydralauncher.gg</code>), seu karma, perfil em nuvem e histórico são sincronizados automaticamente.
          </p>
          <div style="display:flex;gap:10px;">
            <button class="chip-btn" style="background:#0284c7;color:#fff;border-color:#0284c7;" onclick="window.openEditProfileModal()">Gerenciar Token Hydra</button>
            <button class="chip-btn danger" onclick="window.logoutProfile()">Restaurar Perfil Padrão</button>
          </div>
        </div>
      </div>
    `;
  }

  if (panelContent) {
    panelContent.innerHTML = html;
  } else if (fallbackContainer) {
    fallbackContainer.innerHTML = html;
  }

  if (currentSettingsSubTab === 'emulators') window.loadBackupsList();
  if (currentSettingsSubTab === 'integrations') window.loadStoresStatus();
  if (currentSettingsSubTab === 'folders') window.loadPcFoldersList();
  if (currentSettingsSubTab === 'sources' || currentSettingsSubTab === 'download_sources') {
    if (!window._cachedDownloadSourcesLoaded) {
      window.loadDownloadSources(true);
    }
  }
}

window.connectRetroAchievementsEmulators = async () => {
  const username = document.getElementById('cfg-ra-user')?.value?.trim() || '';
  const password = document.getElementById('cfg-ra-pass')?.value || '';
  const webApiKey = document.getElementById('cfg-ra-key')?.value?.trim() || '';
  const hardcore = Boolean(document.getElementById('cfg-ra-hardcore')?.checked);

  if (!username) {
    showToast('Informe seu usuário do RetroAchievements.org!');
    return;
  }

  showToast('Conectando e injetando credenciais nos emuladores...');
  try {
    const res = await fetch('/api/achievements/ra-connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, webApiKey, hardcore })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      showToast(`Erro: ${data.error || 'Falha ao conectar'}`);
      return;
    }
    playSfx('fav');
    const emus = (data.injectedEmulators || []).join(', ') || 'Emuladores';
    showToast(`✅ Conta ${data.username} injetada em: ${emus}!`);
    await fetchState();
  } catch {
    showToast('Erro de comunicação com o servidor');
  }
};

window.scanPcLocalAchievements = async () => {
  showToast('🔍 Escaneando conquistas locais de PC (Steam, Goldberg, RUNE, CODEX, OnlineFix)...');
  playSfx('select');
  try {
    const res = await fetch('/api/achievements/pc-scan', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.ok) {
      playSfx('fav');
      showToast(`🏆 ${data.totalUnlocked} conquistas locais encontradas em ${data.gamesWithUnlocks} jogos de PC!`);
      await fetchState();
      if (currentTab === 'ACHIEVEMENTS') renderAchievementsView();
    } else {
      showToast('Falha ao escanear conquistas locais');
    }
  } catch {
    showToast('Erro ao escanear conquistas locais');
  }
};

window.syncAllGamesAchievements = async () => {
  showToast('🔄 Sincronizando catálogo oficial de conquistas via Hydra API...');
  playSfx('select');
  try {
    const res = await fetch('/api/achievements/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      playSfx('fav');
      showToast(`🏆 ${data.totalAchievements} conquistas oficiais sincronizadas em ${data.syncedGames} jogos!`);
      await fetchState();
      if (currentTab === 'ACHIEVEMENTS') renderAchievementsView();
    }
  } catch {
    showToast('Erro ao sincronizar conquistas');
  }
};

window.openGameFromAchievements = (gameId) => {
  const g = (appState.games || []).find(x => x.id === gameId);
  if (g) {
    playSfx('select');
    selectGame(g);
  }
};

window.addPcExeGame = async () => {
  showToast('Abrindo seletor de executável (.EXE)...');
  playSfx('select');
  try {
    const res = await fetch('/api/pc/pick-exe', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.ok && data.game) {
      playSfx('fav');
      showToast(`Jogo adicionado: ${data.game.title}!`);
      await fetchState();
      const added = appState.games?.find(g => g.id === data.game.id) || data.game;
      if (added) selectGame(added);
    } else if (data && data.error) {
      showToast(data.error);
    }
  } catch (err) {
    showToast('Erro ao abrir seletor de executável');
  }
};

window.addPcFolder = async () => {
  showToast('Abrindo seletor de pasta de jogos de PC...');
  playSfx('select');
  try {
    const res = await fetch('/api/pc/pick-folder', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.ok) {
      playSfx('fav');
      showToast('Pasta adicionada e escaneada com sucesso!');
      await fetchState();
      if (currentTab === 'SETTINGS') {
        renderSettingsView();
      }
    } else if (data && data.error) {
      showToast(data.error);
    }
  } catch (err) {
    showToast('Erro ao adicionar pasta de jogos');
  }
};

window.removePcFolder = async (folderPath) => {
  if (!folderPath) return;
  playSfx('select');
  try {
    const res = await fetch('/api/pc/remove-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      showToast('Pasta removida com sucesso!');
      await fetchState();
      if (currentTab === 'SETTINGS') {
        renderSettingsView();
      }
    } else {
      showToast(data.error || 'Erro ao remover pasta');
    }
  } catch (err) {
    showToast('Erro de comunicação ao remover pasta');
  }
};

window.syncSteamAccount = async (explicitSteamId) => {
  const steamIdInput = document.getElementById('cfg-steam-id');
  const steamKeyInput = document.getElementById('cfg-steam-key');
  const steamId64 = (explicitSteamId || steamIdInput?.value || '').trim();
  const apiKey = (steamKeyInput?.value || '').trim();

  showToast('Sincronizando biblioteca Steam...');
  playSfx('select');

  try {
    const res = await fetch('/api/steam/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steamId64, apiKey })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      const count = data.totalSynced ?? data.synced ?? data.gamesCount ?? 0;
      showToast(`Steam sincronizada! ${count} jogos encontrados.`);
      playSfx('fav');
      await fetchState();
      window.loadStoresStatus();
    } else {
      showToast(data.error || 'Erro ao sincronizar Steam');
    }
  } catch (err) {
    showToast('Erro de comunicação ao sincronizar Steam');
  }
};

window.openEpicAuthPage = () => {
  window.open('https://www.epicgames.com/id/api/redirect?clientId=34a02cf8f4414e29b15921876da36f9a&responseType=code', '_blank');
};

window.connectEpicWithCode = async () => {
  const codeInput = document.getElementById('cfg-epic-code');
  let raw = (codeInput?.value || '').trim();
  if (!raw) {
    showToast('Por favor, cole o código ou JSON da Epic Games no campo.');
    return;
  }
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.authorizationCode) raw = parsed.authorizationCode;
    } catch (_) {}
  }

  showToast('Autenticando conta Epic Games...');
  playSfx('select');

  try {
    const res = await fetch('/api/epic/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: raw })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      const count = data.totalSynced ?? data.synced ?? data.gamesCount ?? 0;
      showToast(`Epic Games conectada com sucesso! ${count} jogos importados.`);
      playSfx('fav');
      await fetchState();
      window.loadStoresStatus();
    } else {
      showToast(data.error || 'Falha na autenticação da Epic Games');
    }
  } catch (err) {
    showToast('Erro de comunicação ao autenticar Epic Games');
  }
};

window.syncEpicAccount = async () => {
  showToast('Sincronizando biblioteca Epic Games...');
  playSfx('select');

  try {
    const res = await fetch('/api/epic/sync', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.ok) {
      const count = data.totalSynced ?? data.synced ?? data.gamesCount ?? 0;
      showToast(`Epic Games sincronizada! ${count} jogos atualizados.`);
      playSfx('fav');
      await fetchState();
      window.loadStoresStatus();
    } else {
      showToast(data.error || 'Erro ao sincronizar Epic Games');
    }
  } catch (err) {
    showToast('Erro de comunicação ao sincronizar Epic Games');
  }
};

window.logoutEpicAccount = async () => {
  showToast('Desconectando conta Epic Games...');
  playSfx('select');

  try {
    const res = await fetch('/api/epic/logout', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.ok) {
      showToast('Conta Epic Games desconectada.');
      await fetchState();
      window.loadStoresStatus();
    } else {
      showToast(data.error || 'Erro ao desconectar da Epic Games');
    }
  } catch (err) {
    showToast('Erro de comunicação ao desconectar da Epic Games');
  }
};

window.loadStoresStatus = async () => {
  try {
    const res = await fetch('/api/stores/status');
    const data = await res.json();
    if (!res.ok || !data.ok) return;

    // 1. Contas Steam detectadas automaticamente no Windows
    const steamAccountsEl = document.getElementById('steam-detected-accounts');
    if (steamAccountsEl) {
      const users = data.steamUsers || data.detectedUsers || [];
      if (users.length > 0) {
        steamAccountsEl.innerHTML = `
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Contas Steam detectadas neste PC (Clique para preencher e sincronizar):</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${users.map(u => `
              <button type="button" class="action-chip" style="font-size:12px;padding:6px 10px;" onclick="document.getElementById('cfg-steam-id').value='${u.steamId64}'; window.syncSteamAccount('${u.steamId64}');" title="SteamID64: ${u.steamId64}">
                <span class="chip-icon">👤</span>
                <span>${u.personaName || u.accountName || u.steamId64}</span>
                <span style="font-size:10px;opacity:0.7;">(${u.steamId64.slice(-4)})</span>
              </button>
            `).join('')}
          </div>
        `;
      } else {
        steamAccountsEl.innerHTML = `<div style="font-size:12px;color:var(--text-dim);">Nenhuma conta Steam detectada automaticamente no Registro do Windows. Digite seu SteamID64 abaixo.</div>`;
      }
    }

    const steamIdInput = document.getElementById('cfg-steam-id');
    if (steamIdInput && !steamIdInput.value && data.steamId64) {
      steamIdInput.value = data.steamId64;
    }
    const steamKeyInput = document.getElementById('cfg-steam-key');
    if (steamKeyInput && !steamKeyInput.value && data.steamApiKey) {
      steamKeyInput.value = data.steamApiKey;
    }

    // 2. Status de login da Epic Games
    const epicStatusEl = document.getElementById('epic-account-status');
    if (epicStatusEl) {
      const epic = data.epic || {};
      if (epic.loggedIn) {
        epicStatusEl.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);border-radius:8px;flex-wrap:wrap;gap:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:20px;">✅</span>
              <div>
                <strong style="color:#6ee7b7;font-size:13px;">Conta Conectada: ${epic.displayName || epic.email || 'Usuário Epic'}</strong>
                <div style="font-size:11px;color:var(--text-muted);">Sincronização com Legendary e manifestos locais ativa</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;">
              <button type="button" class="btn-secondary" style="font-size:12px;padding:6px 12px;color:var(--accent);border-color:var(--accent);" onclick="window.syncEpicAccount()">🔄 Sincronizar Epic Games</button>
              <button type="button" class="btn-secondary" style="font-size:12px;padding:6px 12px;color:#f87171;border-color:rgba(239,68,68,0.4);" onclick="window.logoutEpicAccount()">🚪 Desconectar</button>
            </div>
          </div>
        `;
      } else {
        epicStatusEl.innerHTML = `
          <div style="padding:12px;background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);border-radius:8px;">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;line-height:1.5;">
              Para importar toda a sua biblioteca Epic Games com 1 clique (sem necessidade de senha):
            </div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
              <button type="button" class="btn-secondary" style="color:#38bdf8;border-color:rgba(56,189,248,0.4);" onclick="window.openEpicAuthPage()">
                🔑 1. Obter Código de Login Epic ↗
              </button>
              <span style="font-size:12px;color:var(--text-dim);">(abre a página oficial de autenticação da Epic Games)</span>
            </div>
            <div class="field-row">
              <label>Cole aqui o authorizationCode (ou o JSON copiado da página):</label>
              <div class="field-input-group">
                <input type="text" id="cfg-epic-code" placeholder="Ex: 3a7f8e... ou {'authorizationCode': '...'}">
                <button type="button" class="btn-secondary" style="color:var(--accent);border-color:var(--accent);" onclick="window.connectEpicWithCode()">
                  ⚡ 2. Conectar & Importar Jogos da Epic
                </button>
              </div>
            </div>
          </div>
        `;
      }
    }

    // 3. Lista de pastas extras de PC
    const pcFoldersEl = document.getElementById('pc-folders-container');
    if (pcFoldersEl) {
      const folders = data.pcGameFolders || appState.config?.pcGameFolders || [];
      if (folders.length > 0) {
        pcFoldersEl.innerHTML = `
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Pastas monitoradas de jogos de PC:</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${folders.map(f => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,0.04);border-radius:6px;font-size:13px;border:1px solid var(--border-subtle);">
                <span style="font-family:monospace;color:var(--text-main);">${f}</span>
                <button type="button" class="btn-secondary" style="font-size:11px;padding:4px 8px;color:#f87171;border-color:rgba(239,68,68,0.4);" onclick="window.removePcFolder('${f.replace(/\\/g, '\\\\')}')">✕ Remover</button>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        pcFoldersEl.innerHTML = `
          <div style="font-size:12px;color:var(--text-dim);">
            Nenhuma pasta externa monitorada. Use os botões acima para adicionar executáveis ou pastas de jogos de PC.
          </div>
        `;
      }
    }
  } catch (err) {
    console.error('Falha ao carregar status das lojas:', err);
  }
};

window.testScreenScraper = async () => {
  const statusEl = document.getElementById('ss-test-status');
  if (statusEl) statusEl.textContent = 'Testando conexão...';
  showToast('Testando credenciais no ScreenScraper.fr...');
  playSfx('select');

  const devId = (document.getElementById('cfg-ss-devid')?.value || '').trim();
  const devPass = (document.getElementById('cfg-ss-devpass')?.value || '').trim();
  const user = (document.getElementById('cfg-ss-user')?.value || '').trim();
  const pass = (document.getElementById('cfg-ss-pass')?.value || '').trim();

  try {
    const res = await fetch('/api/screenscraper/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ssDevId: devId,
        ssDevPassword: devPass,
        ssUsername: user,
        ssPassword: pass
      })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      const msg = `✅ Conectado! Nível: ${data.level} | Quota hoje: ${data.requestsToday || 0}/${data.maxRequestsPerDay || 'Ilimitado'} reqs | Threads: ${data.threads}`;
      showToast('ScreenScraper conectado com sucesso!');
      if (statusEl) {
        statusEl.style.color = '#10b981';
        statusEl.textContent = msg;
      }
      playSfx('fav');
    } else {
      const err = data.error || 'Credenciais inválidas no ScreenScraper';
      showToast(err);
      if (statusEl) {
        statusEl.style.color = '#ef4444';
        statusEl.textContent = `❌ ${err}`;
      }
    }
  } catch (e) {
    showToast('Erro de comunicação ao testar ScreenScraper');
    if (statusEl) {
      statusEl.style.color = '#ef4444';
      statusEl.textContent = '❌ Erro de comunicação com o servidor local';
    }
  }
};

// --- COVER SELECTOR MODAL ---
let currentCoverSource = 'all';
let currentSourcesConfigured = {};
const COVER_SOURCES = ['all', 'hydra', 'local', 'screenscraper', 'steamgriddb', 'thegamesdb', 'libretro'];

function switchCoverSourceFilter(delta) {
  let idx = COVER_SOURCES.indexOf(currentCoverSource);
  if (idx === -1) idx = 0;
  idx = (idx + delta + COVER_SOURCES.length) % COVER_SOURCES.length;
  currentCoverSource = COVER_SOURCES[idx];
  playSfx('nav');
  const game = appState.games.find(g => g.id === selectedGameId);
  if (game) {
    const searchInput = document.getElementById('cover-search-term');
    openCoverSelector(game.id, searchInput ? searchInput.value.trim() : null, currentCoverSource);
  }
}

async function openCoverSelector(gameId, customSearch = null, source = null) {
  const game = appState.games.find(g => g.id === gameId);
  if (!game) return;

  if (source !== null) {
    currentCoverSource = source;
  }

  const modal = document.getElementById('cover-modal');
  modal.classList.remove('hidden');
  activeZone = 'COVER_MODAL';
  playSfx('select');

  document.getElementById('cover-modal-title').textContent = `🖼️ Escolher Capa — ${game.title}`;
  document.getElementById('cover-modal-subtitle').textContent = `Console: ${game.consoleId} • Selecione ou copie imagens em media/covers/${game.consoleId.toLowerCase()}`;

  const searchInput = document.getElementById('cover-search-term');
  if (searchInput) {
    searchInput.value = customSearch !== null ? customSearch : (game.title || '');
    searchInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        openCoverSelector(game.id, searchInput.value.trim(), currentCoverSource);
      }
    };
  }

  // Bind Source Filter Chips
  document.querySelectorAll('.source-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.source === currentCoverSource);
    chip.onclick = () => {
      const src = chip.dataset.source || 'all';
      playSfx('select');
      openCoverSelector(game.id, searchInput ? searchInput.value.trim() : null, src);
    };
  });

  const btnSearch = document.getElementById('btn-search-covers');
  if (btnSearch) {
    btnSearch.onclick = () => {
      const term = searchInput ? searchInput.value.trim() : '';
      openCoverSelector(game.id, term, currentCoverSource);
    };
  }

  const fileInput = document.getElementById('cover-file-upload');
  if (fileInput) {
    fileInput.onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      showToast('Fazendo upload da imagem local...');
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await fetch('/api/covers/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gameId: game.id,
              base64Data: reader.result,
              extension: '.' + (file.name.split('.').pop() || 'png')
            })
          });
          const data = await res.json();
          if (res.ok && data.ok) {
            showToast('Imagem carregada com sucesso!');
            game.coverUrl = data.coverUrl;
            game.customCoverUrl = data.coverUrl;
            closeCoverModal();
            await fetchState();
            const updated = appState.games.find(g => g.id === game.id);
            if (updated) selectGame(updated);
          } else {
            showToast(data.error || 'Erro no upload da imagem');
          }
        } catch {
          showToast('Falha na comunicação ao enviar imagem');
        }
      };
      reader.readAsDataURL(file);
    };
  }

  const btnPaste = document.getElementById('btn-paste-cover-url');
  if (btnPaste) {
    btnPaste.onclick = async () => {
      const url = prompt('Cole o link direto da imagem (PNG, JPG, WebP):', '');
      if (!url || !url.trim()) return;
      await selectCoverFromModal(game, {
        url: url.trim(),
        type: 'custom_url',
        label: 'Link Personalizado'
      });
    };
  }

  const loading = document.getElementById('cover-modal-loading');
  const grid = document.getElementById('cover-modal-grid');
  loading.classList.remove('hidden');
  grid.innerHTML = '';
  currentCoverList = [];
  coverModalIndex = 0;

  // Open covers folder handler
  const btnOpenFolder = document.getElementById('btn-open-covers-folder');
  if (btnOpenFolder) {
    btnOpenFolder.onclick = async () => {
      playSfx('select');
      await fetch('/api/covers/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consoleId: game.consoleId })
      });
    };
  }

  const btnRefresh = document.getElementById('btn-refresh-covers');
  if (btnRefresh) btnRefresh.onclick = () => openCoverSelector(game.id, null, currentCoverSource);

  const btnClose = document.getElementById('close-cover-modal');
  if (btnClose) btnClose.onclick = closeCoverModal;

  const btnCancel = document.getElementById('btn-cancel-cover');
  if (btnCancel) btnCancel.onclick = closeCoverModal;

  try {
    let url = `/api/covers/list?gameId=${encodeURIComponent(game.id)}&source=${encodeURIComponent(currentCoverSource)}`;
    if (customSearch) {
      url += `&q=${encodeURIComponent(customSearch)}`;
    }
    const res = await fetch(url);
    const data = await res.json();
    loading.classList.add('hidden');

    currentSourcesConfigured = data.sourcesConfigured || {};

    if (!res.ok || !data.covers || data.covers.length === 0) {
      if (currentCoverSource === 'screenscraper' && !currentSourcesConfigured.screenscraper) {
        grid.innerHTML = `
          <div class="cover-not-configured-card">
            <div class="not-cfg-icon">🌐</div>
            <h3>ScreenScraper.fr (Fonte Primária) não configurado</h3>
            <p>Para buscar capas oficiais 2D/3D e metadados por hash, cadastre seu Usuário e Dev ID nas Configurações.</p>
            <div style="margin-top:14px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
              <button class="btn-primary" style="cursor:pointer;" onclick="closeCoverModal(); switchTab('SETTINGS');">⚙️ Abrir Configurações</button>
              <button class="btn-secondary" style="cursor:pointer;" onclick="openCoverSelector('${game.id}', '${customSearch || ''}', 'all');">Ver Todas as Fontes</button>
            </div>
          </div>
        `;
        return;
      }

      if (currentCoverSource === 'steamgriddb' && !currentSourcesConfigured.steamgriddb) {
        grid.innerHTML = `
          <div class="cover-not-configured-card">
            <div class="not-cfg-icon">🎨</div>
            <h3>SteamGridDB não configurado</h3>
            <p>Cadastre uma API Key gratuita do SteamGridDB nas Configurações para obter pôsteres verticais em alta resolução (600x900).</p>
            <div style="margin-top:14px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
              <button class="btn-primary" style="cursor:pointer;" onclick="closeCoverModal(); switchTab('SETTINGS');">⚙️ Abrir Configurações</button>
              <button class="btn-secondary" style="cursor:pointer;" onclick="openCoverSelector('${game.id}', '${customSearch || ''}', 'all');">Ver Todas as Fontes</button>
            </div>
          </div>
        `;
        return;
      }

      if (currentCoverSource === 'thegamesdb' && !currentSourcesConfigured.thegamesdb) {
        grid.innerHTML = `
          <div class="cover-not-configured-card">
            <div class="not-cfg-icon">🎮</div>
            <h3>TheGamesDB não configurado</h3>
            <p>Insira sua API Key gratuita do TheGamesDB nas Configurações para buscar boxarts oficiais da comunidade.</p>
            <div style="margin-top:14px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
              <button class="btn-primary" style="cursor:pointer;" onclick="closeCoverModal(); switchTab('SETTINGS');">⚙️ Abrir Configurações</button>
              <button class="btn-secondary" style="cursor:pointer;" onclick="openCoverSelector('${game.id}', '${customSearch || ''}', 'all');">Ver Todas as Fontes</button>
            </div>
          </div>
        `;
        return;
      }

      grid.innerHTML = '<div style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:40px 0;">Nenhuma capa encontrada para esta busca. Tente buscar por outro nome acima, enviar uma imagem do PC ou adicionar arquivos na pasta covers/!</div>';
      return;
    }

    currentCoverList = data.covers;
    renderCoverModalCards(game);
  } catch (e) {
    loading.classList.add('hidden');
    grid.innerHTML = '<div style="color:#ef4444;grid-column:1/-1;text-align:center;padding:40px 0;">Erro ao consultar capas alternativas.</div>';
  }
}

function renderCoverModalCards(game) {
  const grid = document.getElementById('cover-modal-grid');
  grid.innerHTML = '';
  currentCoverList.forEach((c, idx) => {
    const card = document.createElement('div');
    const isActive = (c.active || c.url === game.coverUrl || c.url === game.customCoverUrl);
    card.className = `cover-card ${isActive ? 'active-cover' : ''} ${idx === coverModalIndex ? 'gamepad-focused' : ''}`;
    card.dataset.index = idx;

    let sourceTagClass = 'local';
    let sourceTagText = 'LOCAL';

    if (isActive) {
      sourceTagClass = 'active';
      sourceTagText = 'ATIVA';
    } else if (c.type === 'hydra') {
      sourceTagClass = 'hydra';
      sourceTagText = 'HYDRA OFICIAL';
    } else if (c.type === 'steam_store') {
      sourceTagClass = 'steamgriddb';
      sourceTagText = 'STEAM STORE';
    } else if (c.type === 'screenscraper') {
      sourceTagClass = 'screenscraper';
      sourceTagText = 'SCREENSCRAPER';
    } else if (c.type === 'steamgriddb') {
      sourceTagClass = 'steamgriddb';
      sourceTagText = 'STEAMGRID';
    } else if (c.type === 'thegamesdb') {
      sourceTagClass = 'thegamesdb';
      sourceTagText = 'THEGAMESDB';
    } else if (c.type === 'libretro') {
      sourceTagClass = 'libretro';
      sourceTagText = 'LIBRETRO';
    }

    card.innerHTML = `
      <img src="${c.thumbUrl || c.url}" class="cover-card-art" loading="lazy" decoding="async" alt="Cover">
      <div class="cover-card-body">
        <div class="cover-badge-row">
          <span class="cover-source-tag ${sourceTagClass}">${sourceTagText}</span>
          ${isActive ? '<span style="color:#10b981;font-size:10px;font-weight:700;">★ Em Uso</span>' : ''}
        </div>
        <div class="cover-card-title" title="${c.label}">${c.label}</div>
      </div>
    `;

    // Guard against any broken image URL in the cover selector modal
    const imgEl = card.querySelector('.cover-card-art');
    if (imgEl) {
      imgEl.onerror = () => {
        card.remove();
      };
    }

    card.onclick = () => selectCoverFromModal(game, c);
    grid.appendChild(card);
  });
}

async function selectCoverFromModal(game, cover) {
  showToast('Aplicando e salvando capa no sistema...');
  playSfx('select');
  try {
    const res = await fetch('/api/covers/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId: game.id,
        coverUrl: cover.url,
        source: cover.type,
        label: cover.label
      })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      showToast('Capa salva e definida com sucesso!');
      game.coverUrl = data.coverUrl;
      game.customCoverUrl = data.coverUrl;
      closeCoverModal();
      await fetchState();
      const updated = appState.games.find(g => g.id === game.id);
      if (updated) selectGame(updated);
    } else {
      showToast(data.error || 'Erro ao definir capa');
    }
  } catch (e) {
    showToast('Erro de comunicação ao salvar capa');
  }
}

function closeCoverModal() {
  document.getElementById('cover-modal').classList.add('hidden');
  activeZone = selectedGameId ? 'DETAILS' : 'GRID';
  playSfx('back');
}
window.closeCoverModal = closeCoverModal;
window.switchTab = switchTab;
window.openCoverSelector = openCoverSelector;

// --- SAVES BACKUP & EXPORT ---
window.exportSavesBackup = async () => {
  showToast('Compactando saves e memory cards de todos os emuladores...');
  playSfx('select');
  try {
    const res = await fetch('/api/saves/export', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.ok) {
      showToast(`Backup criado com sucesso: ${data.backup.fileName} (${formatSize(data.backup.sizeBytes)})!`);
      playSfx('fav');
      window.loadBackupsList();
    } else {
      showToast(data.error || 'Erro ao gerar backup de saves');
    }
  } catch {
    showToast('Falha ao comunicar com o servidor de backups');
  }
};

window.openSavesFolder = async () => {
  playSfx('select');
  await fetch('/api/saves/open-folder', { method: 'POST' });
};

window.loadBackupsList = async () => {
  const container = document.getElementById('backups-list-container');
  if (!container) return;
  try {
    const res = await fetch('/api/saves/list');
    const data = await res.json();
    if (data.backups && data.backups.length > 0) {
      container.innerHTML = data.backups.map(b => `
        <div class="backup-row">
          <div class="backup-info">
            <span class="backup-filename">📦 ${b.fileName}</span>
            <span class="backup-meta">${formatDate(b.createdDate)} • ${formatSize(b.sizeBytes)}</span>
          </div>
          <a href="${b.downloadUrl}" class="btn-secondary" style="color:var(--accent);border-color:var(--accent);text-decoration:none;" download>📥 Baixar ZIP</a>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:8px 0;">Nenhum arquivo de backup gerado ainda. Clique em "Criar Novo Backup Agora" para gerar uma cópia dos seus saves!</div>';
    }
  } catch {}
};

window.openExplorer = async (folderPath) => {
  await fetch('/api/open-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderPath })
  });
};

window.syncAllSteamGrid = async () => {
  const key = document.getElementById('cfg-steamgrid-key')?.value.trim() || appState.config?.steamGridDbApiKey;
  if (!key) {
    showToast('Informe a chave da API do SteamGridDB primeiro!');
    return;
  }
  showToast('Iniciando sincronização de artes em HD no SteamGridDB...');
  try {
    const res = await fetch('/api/steamgrid/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Erro na sincronização');
    } else {
      showToast(`Sucesso! ${data.updatedCount} jogos foram atualizados com artes do SteamGridDB!`);
      await fetchState();
    }
  } catch {
    showToast('Erro de conexão com o SteamGridDB');
  }
};

// --- SETTINGS ACTIONS & CONFIG SYNC ---
window.saveGeneralSettings = async () => {
  const launchStartup = Boolean(document.getElementById('cfg-launch-startup')?.checked);
  const launchMin = Boolean(document.getElementById('cfg-launch-minimized')?.checked);
  const minTray = Boolean(document.getElementById('cfg-minimize-tray')?.checked);
  const dlPath = document.getElementById('cfg-dl-path-general')?.value?.trim();

  try {
    await fetch('/api/config/startup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ launchOnStartup: launchStartup, launchMinimized: launchMin })
    });

    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        launchOnStartup: launchStartup,
        launchMinimized: launchMin,
        minimizeToTray: minTray,
        downloadSettings: {
          ...(appState.config?.downloadSettings || {}),
          ...(dlPath ? { downloadPath: dlPath } : {})
        }
      })
    });
    if (res.ok) {
      showToast('Preferências gerais salvas com sucesso!');
      playSfx('fav');
      await fetchState();
    }
  } catch {
    showToast('Erro ao salvar preferências gerais');
  }
};

window.saveDownloadConfig = async () => {
  const path = document.getElementById('cfg-dl-path')?.value?.trim() || 'D:\\HydraDownloads';
  const maxDl = parseInt(document.getElementById('cfg-dl-max-speed')?.value || '0', 10);
  const maxUp = parseInt(document.getElementById('cfg-dl-upload-speed')?.value || '0', 10);
  const seed = Boolean(document.getElementById('cfg-dl-seeding')?.checked);
  const extract = Boolean(document.getElementById('cfg-dl-extract')?.checked);
  const delArchive = Boolean(document.getElementById('cfg-dl-delete-archive')?.checked);
  const shortcut = Boolean(document.getElementById('cfg-dl-shortcut')?.checked);

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        downloadSettings: {
          downloadPath: path,
          maxDownloadSpeedKb: maxDl,
          maxUploadSpeedKb: maxUp,
          continueSeeding: seed,
          autoExtract: extract,
          deleteAfterExtract: delArchive,
          createDesktopShortcut: shortcut
        }
      })
    });
    if (res.ok) {
      showToast('⚡ Configurações de download e torrent salvas!');
      playSfx('fav');
      await fetchState();
    }
  } catch {
    showToast('Erro ao salvar opções de download');
  }
};

window.loadDownloadSources = async (rerender = false) => {
  try {
    const res = await fetch('/api/downloads/sources');
    if (res.ok) {
      const data = await res.json();
      window._cachedDownloadSources = data.sources || [];
      window._cachedDownloadSourcesLoaded = true;
      if (rerender && (currentSettingsSubTab === 'sources' || currentSettingsSubTab === 'download_sources')) {
        renderSettingsView();
      }
    }
  } catch (err) {
    console.warn('[HydraRetro] Erro ao carregar fontes:', err);
  }
};

window.openAddSourceModal = () => {
  const modal = document.getElementById('modal-add-download-source');
  const input = document.getElementById('input-add-source-url');
  const errorEl = document.getElementById('add-source-error');
  const spinner = document.getElementById('add-source-spinner');
  const btnText = document.getElementById('add-source-btn-text');
  const submitBtn = document.getElementById('btn-submit-add-source');

  if (input) input.value = '';
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }
  if (spinner) spinner.classList.add('hidden');
  if (btnText) btnText.textContent = 'Adicionar fonte';
  if (submitBtn) submitBtn.disabled = false;

  modal?.classList.remove('hidden');
  input?.focus();
};

window.closeAddSourceModal = () => {
  document.getElementById('modal-add-download-source')?.classList.add('hidden');
};

window.submitAddDownloadSource = async () => {
  const input = document.getElementById('input-add-source-url');
  const errorEl = document.getElementById('add-source-error');
  const spinner = document.getElementById('add-source-spinner');
  const btnText = document.getElementById('add-source-btn-text');
  const submitBtn = document.getElementById('btn-submit-add-source');

  const url = input?.value?.trim();
  if (!url) {
    if (errorEl) {
      errorEl.textContent = 'Por favor, insira uma URL válida.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  // Set loading state
  if (spinner) spinner.classList.remove('hidden');
  if (btnText) btnText.textContent = 'Adicionando...';
  if (submitBtn) submitBtn.disabled = true;
  if (errorEl) errorEl.classList.add('hidden');

  try {
    const res = await fetch('/api/downloads/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      window.closeAddSourceModal();
      showToast('Fonte de download adicionada com sucesso!');
      playSfx('fav');
      await window.loadDownloadSources();
      await fetchState();
      renderSettingsView();
    } else {
      if (errorEl) {
        errorEl.textContent = data.error || 'Falha ao adicionar fonte de download. Tente novamente.';
        errorEl.classList.remove('hidden');
      }
    }
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = 'Falha de comunicação com o servidor local.';
      errorEl.classList.remove('hidden');
    }
  } finally {
    if (spinner) spinner.classList.add('hidden');
    if (btnText) btnText.textContent = 'Adicionar fonte';
    if (submitBtn) submitBtn.disabled = false;
  }
};

window.openDeleteAllSourcesModal = () => {
  document.getElementById('modal-delete-all-sources')?.classList.remove('hidden');
};

window.closeDeleteAllSourcesModal = () => {
  document.getElementById('modal-delete-all-sources')?.classList.add('hidden');
};

window.confirmDeleteAllSources = async () => {
  window.closeDeleteAllSourcesModal();
  try {
    const res = await fetch('/api/downloads/sources/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeAll: true })
    });
    if (res.ok) {
      showToast('Todas as fontes de download removidas');
      playSfx('select');
      window._cachedDownloadSources = [];
      await window.loadDownloadSources();
      await fetchState();
      renderSettingsView();
    }
  } catch (err) {
    showToast('Erro ao remover fontes');
  }
};

window.removeSingleDownloadSource = async (sourceId) => {
  try {
    const res = await fetch('/api/downloads/sources/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId })
    });
    if (res.ok) {
      showToast('Fonte removida');
      playSfx('select');
      await window.loadDownloadSources();
      await fetchState();
      renderSettingsView();
    }
  } catch (err) {
    showToast('Erro ao remover fonte');
  }
};

window.syncAllDownloadSourcesUI = async () => {
  showToast('Sincronizando fontes de download...');
  playSfx('select');
  try {
    const res = await fetch('/api/downloads/sources/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (res.ok) {
      showToast('Fontes de download sincronizadas com sucesso');
      playSfx('fav');
      await window.loadDownloadSources();
      await fetchState();
      renderSettingsView();
    } else {
      showToast('Erro ao sincronizar fontes');
    }
  } catch (err) {
    showToast('Falha na comunicação ao sincronizar');
  }
};

// Aliases for compatibility
window.addNewDownloadSource = window.openAddSourceModal;
window.removeSourceByUrl = window.removeSingleDownloadSource;
window.syncAllSourcesNow = window.syncAllDownloadSourcesUI;

window.scanOfficialStores = async () => {
  showToast('🔍 Escaneando lojas oficiais (Steam, Epic, GOG, Xbox / Game Pass)...');
  playSfx('select');
  try {
    const res = await fetch('/api/integrations/scan-stores', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.ok) {
      showToast(`Varredura concluída! ${data.totalDiscovered || 0} jogos instalados localizados.`);
      playSfx('fav');
      await fetchState();
      renderCatalogue();
    } else {
      showToast('Erro ao escanear lojas');
    }
  } catch {
    showToast('Falha de conexão com o scanner');
  }
};

window.scanXboxGamePass = async () => {
  showToast('🟢 Escaneando jogos do Xbox Game Pass em todos os discos...');
  playSfx('select');
  try {
    const res = await fetch('/api/xbox/scan', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.ok) {
      showToast(`🎮 ${data.totalXboxGames} jogos do Xbox Game Pass encontrados (${data.newlyAdded} novos)!`);
      playSfx('fav');
      await fetchState();
      switchTab('XBOX');
    } else {
      showToast('Erro ao escanear Xbox Game Pass');
    }
  } catch {
    showToast('Falha na comunicação ao escanear Xbox');
  }
};

window.addXboxFolder = async () => {
  showToast('Selecione a pasta onde seus jogos do Xbox estão instalados...');
  playSfx('select');
  try {
    const res = await fetch('/api/xbox/add-folder', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.ok) {
      showToast(`Pasta adicionada! ${data.totalDiscovered} jogos encontrados.`);
      playSfx('fav');
      await fetchState();
      switchTab('XBOX');
    } else if (data.message) {
      showToast(data.message);
    }
  } catch {
    showToast('Falha ao adicionar pasta do Xbox');
  }
};

// --- HOME / STORE VIEW ENGINE (HYDRA ORIGINAL STYLE) ---
let homeSearchDebounceTimer = null;
let currentHomeGenre = '';
let currentHomeSort = 'popularity:desc';
let homeCurrentPage = 0;
let homePageSize = 30;
let homeTotalCount = 0;
let homeTotalPages = 1;

async function renderHomeView() {
  setupHomeControls();
  await triggerHomeCatalogueLoad();
}

function setupHomeControls() {
  document.querySelectorAll('.home-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === currentHomeCategory);
    btn.onclick = () => {
      currentHomeCategory = btn.dataset.category;
      homeCurrentPage = 0;
      playSfx('nav');
      document.querySelectorAll('.home-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      const searchInput = document.getElementById('home-search-input');
      if (searchInput) searchInput.value = '';
      document.getElementById('home-clear-search')?.classList.add('hidden');
      triggerHomeCatalogueLoad(false);
    };
  });

  const searchInput = document.getElementById('home-search-input');
  const clearBtn = document.getElementById('home-clear-search');
  if (searchInput && !searchInput._hasHomeHandler) {
    searchInput._hasHomeHandler = true;
    searchInput.oninput = (e) => {
      const q = e.target.value.trim();
      if (clearBtn) clearBtn.classList.toggle('hidden', !q);
      homeCurrentPage = 0;
      clearTimeout(homeSearchDebounceTimer);
      homeSearchDebounceTimer = setTimeout(() => {
        triggerHomeCatalogueLoad(false);
      }, 350);
    };
  }

  if (clearBtn && !clearBtn._hasClearHandler) {
    clearBtn._hasClearHandler = true;
    clearBtn.onclick = () => {
      if (searchInput) searchInput.value = '';
      clearBtn.classList.add('hidden');
      homeCurrentPage = 0;
      triggerHomeCatalogueLoad(false);
    };
  }

  const genreSelect = document.getElementById('home-genre-select');
  if (genreSelect && !genreSelect._hasGenreHandler) {
    genreSelect._hasGenreHandler = true;
    genreSelect.onchange = (e) => {
      currentHomeGenre = e.target.value;
      homeCurrentPage = 0;
      playSfx('nav');
      triggerHomeCatalogueLoad(false);
    };
  }

  const sortSelect = document.getElementById('home-sort-select');
  if (sortSelect && !sortSelect._hasSortHandler) {
    sortSelect._hasSortHandler = true;
    sortSelect.onchange = (e) => {
      currentHomeSort = e.target.value;
      homeCurrentPage = 0;
      playSfx('nav');
      triggerHomeCatalogueLoad(false);
    };
  }

  const btnSurprise = document.getElementById('btn-surprise-me');
  if (btnSurprise) {
    btnSurprise.onclick = () => surpriseMe();
  }

  const btnFirst = document.getElementById('btn-home-first');
  const btnPrev = document.getElementById('btn-home-prev');
  const btnNext = document.getElementById('btn-home-next');
  const btnLast = document.getElementById('btn-home-last');

  if (btnFirst && !btnFirst._hasHandler) {
    btnFirst._hasHandler = true;
    btnFirst.onclick = () => {
      if (homeCurrentPage > 0) changeHomePage(0);
    };
  }
  if (btnPrev && !btnPrev._hasHandler) {
    btnPrev._hasHandler = true;
    btnPrev.onclick = () => {
      if (homeCurrentPage > 0) changeHomePage(homeCurrentPage - 1);
    };
  }
  if (btnNext && !btnNext._hasHandler) {
    btnNext._hasHandler = true;
    btnNext.onclick = () => {
      if (homeCurrentPage < homeTotalPages - 1) changeHomePage(homeCurrentPage + 1);
    };
  }
  if (btnLast && !btnLast._hasHandler) {
    btnLast._hasHandler = true;
    btnLast.onclick = () => {
      if (homeCurrentPage < homeTotalPages - 1) changeHomePage(homeTotalPages - 1);
    };
  }
}

function changeHomePage(newPage) {
  if (newPage < 0) newPage = 0;
  if (newPage >= homeTotalPages) newPage = Math.max(0, homeTotalPages - 1);
  if (newPage === homeCurrentPage) return;
  homeCurrentPage = newPage;
  playSfx('nav');
  triggerHomeCatalogueLoad(true);
}

async function triggerHomeCatalogueLoad(scrollToTop = false) {
  const searchInput = document.getElementById('home-search-input');
  const query = searchInput ? searchInput.value.trim() : '';
  const paginationBar = document.getElementById('home-pagination');
  const loading = document.getElementById('home-grid-loading');

  if (loading) loading.classList.remove('hidden');

  const isFullCatalogue = (currentHomeCategory === 'all' || currentHomeCategory === 'catalogue');
  const hasCustomFilters = Boolean(query || currentHomeGenre || currentHomeSort !== 'popularity:desc');

  try {
    if (isFullCatalogue || hasCustomFilters) {
      // Full Hydra Catalogue (213,000+ games) with pagination, search, genre and ordering
      const url = `/api/home/search?q=${encodeURIComponent(query)}&genre=${encodeURIComponent(currentHomeGenre)}&order=${encodeURIComponent(currentHomeSort)}&page=${homeCurrentPage}&take=${homePageSize}`;
      const res = await fetch(url);
      const data = await res.json();
      homeGamesCache = data.games || data.items || [];
      homeTotalCount = typeof data.count === 'number' ? data.count : homeGamesCache.length;
      homeTotalPages = Math.max(1, Math.ceil(homeTotalCount / homePageSize));

      if (homeGamesCache.length > 0 && homeCurrentPage === 0 && !query) {
        updateHomeHero(homeGamesCache[0]);
      }
      renderHomeGrid(homeGamesCache);
      renderHomePagination();
      if (paginationBar) paginationBar.classList.remove('hidden');
    } else {
      // Curated categories: hot, weekly, achievements
      const res = await fetch(`/api/home/catalogue?category=${currentHomeCategory}`);
      const data = await res.json();
      homeGamesCache = data.games || data.items || [];
      homeTotalCount = homeGamesCache.length;
      homeTotalPages = 1;
      homeCurrentPage = 0;

      if (homeGamesCache.length > 0) updateHomeHero(homeGamesCache[0]);
      renderHomeGrid(homeGamesCache);
      if (paginationBar) paginationBar.classList.add('hidden');
    }

    if (scrollToTop) {
      const vHome = document.getElementById('view-home');
      if (vHome) vHome.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } catch (err) {
    console.error('Erro ao carregar catálogo Hydra:', err);
    showToast('Erro ao consultar catálogo Hydra');
  } finally {
    if (loading) loading.classList.add('hidden');
  }
}

function renderHomePagination() {
  const paginationBar = document.getElementById('home-pagination');
  if (!paginationBar) return;

  const curPageElem = document.getElementById('home-current-page');
  const totalPagesElem = document.getElementById('home-total-pages');
  const totalCountElem = document.getElementById('home-total-count');
  const btnFirst = document.getElementById('btn-home-first');
  const btnPrev = document.getElementById('btn-home-prev');
  const btnNext = document.getElementById('btn-home-next');
  const btnLast = document.getElementById('btn-home-last');
  const numbersWrap = document.getElementById('home-page-numbers');

  if (curPageElem) curPageElem.textContent = String(homeCurrentPage + 1);
  if (totalPagesElem) totalPagesElem.textContent = Number(homeTotalPages).toLocaleString('pt-BR');
  if (totalCountElem) totalCountElem.textContent = Number(homeTotalCount).toLocaleString('pt-BR');

  if (btnFirst) btnFirst.disabled = (homeCurrentPage === 0);
  if (btnPrev) btnPrev.disabled = (homeCurrentPage === 0);
  if (btnNext) btnNext.disabled = (homeCurrentPage >= homeTotalPages - 1);
  if (btnLast) btnLast.disabled = (homeCurrentPage >= homeTotalPages - 1);

  if (numbersWrap) {
    numbersWrap.innerHTML = '';
    const visibleRadius = 2;
    let startPage = Math.max(0, homeCurrentPage - visibleRadius);
    let endPage = Math.min(homeTotalPages - 1, homeCurrentPage + visibleRadius);

    if (startPage > 0) {
      const p1Btn = document.createElement('button');
      p1Btn.type = 'button';
      p1Btn.className = 'pagination-number-btn';
      p1Btn.textContent = '1';
      p1Btn.onclick = () => changeHomePage(0);
      numbersWrap.appendChild(p1Btn);

      if (startPage > 1) {
        const dots = document.createElement('span');
        dots.className = 'pagination-ellipsis';
        dots.textContent = '...';
        numbersWrap.appendChild(dots);
      }
    }

    for (let p = startPage; p <= endPage; p++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `pagination-number-btn ${p === homeCurrentPage ? 'active' : ''}`;
      btn.textContent = String(p + 1);
      btn.onclick = () => changeHomePage(p);
      numbersWrap.appendChild(btn);
    }

    if (endPage < homeTotalPages - 1) {
      if (endPage < homeTotalPages - 2) {
        const dots = document.createElement('span');
        dots.className = 'pagination-ellipsis';
        dots.textContent = '...';
        numbersWrap.appendChild(dots);
      }
      const pLastBtn = document.createElement('button');
      pLastBtn.type = 'button';
      pLastBtn.className = 'pagination-number-btn';
      pLastBtn.textContent = String(homeTotalPages);
      pLastBtn.onclick = () => changeHomePage(homeTotalPages - 1);
      numbersWrap.appendChild(pLastBtn);
    }
  }
}

async function loadHomeCategory(category) {
  currentHomeCategory = category;
  homeCurrentPage = 0;
  await triggerHomeCatalogueLoad();
}

function updateHomeHero(game) {
  if (!game) return;
  const bg = document.getElementById('home-hero-backdrop');
  const title = document.getElementById('home-hero-title');
  const desc = document.getElementById('home-hero-desc');
  const btnPlay = document.getElementById('btn-hero-play');

  if (title) title.textContent = game.title || 'Destaque Hydra';
  if (desc) desc.textContent = game.description || 'Explore e jogue instantaneamente com metadados e conquistas automáticas.';
  const heroImg = game.heroUrl || game.coverUrl || '';
  if (bg && heroImg) {
    bg.style.backgroundImage = `url("${heroImg}")`;
  }

  if (btnPlay) {
    btnPlay.onclick = () => {
      playSfx('select');
      const local = (appState.games || []).find(g => g.title?.toLowerCase() === game.title?.toLowerCase());
      if (local) {
        selectGame(local);
      } else {
        const virtualGame = {
          id: `hydra_cat_${encodeURIComponent(game.title)}`,
          title: game.title,
          fileName: `${game.title}.exe`,
          consoleId: 'PC',
          isInstalled: false,
          coverUrl: game.coverUrl,
          heroUrl: game.heroUrl || game.coverUrl,
          description: game.description,
          developer: game.developer || 'Hydra Catalogue',
          publisher: game.publisher || 'Acervo Oficial',
          releaseYear: game.releaseYear || '2024',
          rating: game.rating || 4.8,
          genres: game.genres || ['Ação', 'Aventura']
        };
        selectGame(virtualGame);
      }
    };
  }
}

function surpriseMe() {
  playSfx('fav');
  const pool = homeGamesCache.length > 0 ? homeGamesCache : (appState.games || []);
  if (pool.length === 0) return;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  updateHomeHero(pick);
  showToast(`✨ Surpresa: ${pick.title}!`);
  const local = (appState.games || []).find(g => g.title?.toLowerCase() === pick.title?.toLowerCase());
  if (local) {
    selectGame(local);
  } else {
    const virtualGame = {
      id: `hydra_cat_${encodeURIComponent(pick.title)}`,
      title: pick.title,
      fileName: `${pick.title}.exe`,
      consoleId: 'PC',
      isInstalled: false,
      coverUrl: pick.coverUrl,
      heroUrl: pick.heroUrl || pick.coverUrl,
      description: pick.description,
      developer: pick.developer || 'Hydra Catalogue',
      publisher: pick.publisher || 'Acervo Oficial',
      releaseYear: pick.releaseYear || '2024',
      rating: pick.rating || 4.8,
      genres: pick.genres || ['Ação', 'Aventura']
    };
    selectGame(virtualGame);
  }
}

function renderHomeGrid(games) {
  const grid = document.getElementById('home-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (games.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted);">Nenhum título encontrado com os filtros aplicados.</div>`;
    return;
  }

  games.forEach(g => {
    const card = document.createElement('div');
    card.className = 'game-card';
    const isLocal = (appState.games || []).some(lg => lg.title?.toLowerCase() === g.title?.toLowerCase() && lg.isInstalled !== false);

    card.innerHTML = `
      <div class="card-art-wrap">
        <img src="${g.coverUrl || ''}" class="card-art loaded" loading="lazy" alt="${g.title}" onerror="this.onerror=null;this.src='data:image/svg+xml;charset=UTF-8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'200\\' height=\\'260\\' viewBox=\\'0 0 200 260\\'><rect width=\\'200\\' height=\\'260\\' fill=\\'%23161c28\\'/><text x=\\'50%\\' y=\\'50%\\' fill=\\'%23475569\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' font-family=\\'sans-serif\\' font-size=\\'13\\'>Sem Capa</text></svg>'">
        <div class="card-top-badges">
          <div class="card-badges-left">
            <span class="card-console-tag ${isLocal ? 'pc' : 'steam'}">${isLocal ? 'INSTALADO' : 'CATÁLOGO'}</span>
            ${g.rating ? `<span class="card-rating-tag">★ ${(g.rating).toFixed(1)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="card-info">
        <div class="card-title" title="${g.title}">${g.title}</div>
        <div class="card-meta">
          <span>${g.releaseYear || (isLocal ? 'Pronto para Jogar' : 'Disponível')}</span>
          <span style="color:#10b981;font-weight:700;">${isLocal ? '▶ Jogar' : '📥 Baixar'}</span>
        </div>
      </div>
    `;

    card.onclick = () => {
      playSfx('select');
      const local = (appState.games || []).find(lg => lg.title?.toLowerCase() === g.title?.toLowerCase());
      if (local) {
        selectGame(local);
      } else {
        const virtualGame = {
          id: `hydra_cat_${encodeURIComponent(g.title)}`,
          title: g.title,
          fileName: `${g.title}.exe`,
          consoleId: 'PC',
          isInstalled: Boolean(isLocal),
          coverUrl: g.coverUrl,
          heroUrl: g.heroUrl || g.coverUrl,
          description: g.description || 'Título oficial do catálogo Hydra disponível para download e execução direta.',
          developer: g.developer || 'Hydra Official',
          publisher: g.publisher || 'Steam / Hydra',
          releaseYear: g.releaseYear || '2024',
          rating: g.rating || 4.8,
          genres: g.genres || ['Ação', 'Aventura'],
          objectId: g.objectId,
          steamAppId: g.shop === 'steam' ? g.objectId : null,
          hydraObjectId: g.objectId,
          shop: g.shop || 'steam'
        };
        selectGame(virtualGame);
      }
    };

    grid.appendChild(card);
  });
}

// --- DOWNLOADS MANAGER ENGINE ---
function startDownloadsPolling() {
  stopDownloadsPolling();
  pollDownloads();
  downloadsPollingInterval = setInterval(pollDownloads, 1200);
}

function stopDownloadsPolling() {
  if (downloadsPollingInterval) {
    clearInterval(downloadsPollingInterval);
    downloadsPollingInterval = null;
  }
}

async function pollDownloads() {
  try {
    const res = await fetch('/api/downloads/list');
    const data = await res.json();
    updateDownloadsUI(data);
  } catch (e) {
    console.error('Downloads poll error:', e);
  }
}

function updateDownloadsUI(data) {
  const downloads = data.downloads || [];
  const activeDl = data.activeCount || 0;

  const spdEl = document.getElementById('dl-global-speed');
  if (spdEl) spdEl.textContent = formatBytesPerSec(data.globalDownloadSpeedBytes || 0);

  const upEl = document.getElementById('dl-upload-speed');
  if (upEl) upEl.textContent = formatBytesPerSec(data.globalUploadSpeedBytes || 0);

  const countEl = document.getElementById('dl-active-count');
  if (countEl) countEl.textContent = activeDl;

  const badge = document.getElementById('badge-downloads');
  if (badge) badge.textContent = activeDl;

  const emptyState = document.getElementById('downloads-empty-state');
  const listEl = document.getElementById('downloads-list');

  if (downloads.length === 0) {
    emptyState?.classList.remove('hidden');
    if (listEl) listEl.innerHTML = '';
    return;
  }

  emptyState?.classList.add('hidden');
  if (!listEl) return;

  listEl.innerHTML = downloads.map(d => {
    const progress = Math.min(100, Math.max(0, d.progress || 0));
    const speedStr = formatBytesPerSec(d.downloadSpeedBytes || 0);
    const downloadedStr = formatSize(d.downloadedBytes || 0);
    const totalStr = formatSize(d.totalBytes || 0);
    const statusClass = d.status || 'downloading';

    let statusText = 'Baixando';
    if (d.status === 'seeding') statusText = 'Semeando (Seed)';
    else if (d.status === 'extracting') statusText = 'Extraindo (7-Zip)...';
    else if (d.status === 'completed') statusText = 'Concluído';
    else if (d.status === 'paused') statusText = 'Pausado';

    return `
      <div class="download-card">
        <div class="dl-card-icon">
          ${d.status === 'completed' ? '✅' : (d.status === 'extracting' ? '📦' : '📥')}
        </div>
        <div class="dl-card-info">
          <div class="dl-card-title-row">
            <span class="dl-card-title" title="${d.title}">${d.title}</span>
            <span class="dl-card-status-pill ${statusClass}">${statusText}</span>
          </div>
          <div class="dl-card-progress-bar">
            <div class="dl-card-progress-fill" style="width:${progress.toFixed(1)}%;"></div>
          </div>
          <div class="dl-card-meta-row">
            <span><strong>${progress.toFixed(1)}%</strong> (${downloadedStr} de ${totalStr})</span>
            ${d.status === 'downloading' ? `<span>⚡ ${speedStr}</span>` : ''}
            ${d.peersCount ? `<span>👥 ${d.peersCount} peers</span>` : ''}
          </div>
        </div>
        <div class="dl-card-actions">
          ${d.status === 'paused' ? `
            <button type="button" class="dl-btn" onclick="window.resumeDownload('${d.id}')">▶ Retomar</button>
          ` : (d.status === 'downloading' ? `
            <button type="button" class="dl-btn" onclick="window.pauseDownload('${d.id}')">⏸ Pausar</button>
          ` : '')}
          <button type="button" class="dl-btn" onclick="window.openDownloadTargetFolder('${d.id}')">📂 Pasta</button>
          <button type="button" class="dl-btn danger" onclick="window.cancelDownload('${d.id}')">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function formatBytesPerSec(bytes) {
  if (!bytes || bytes <= 0) return '0.0 MB/s';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB/s`;
}

function renderDownloadsView() {
  setupDownloadsControls();
  pollDownloads();
}

let currentTorrentFile = null;
let currentTorrentBase64 = null;
let addDownloadHandlersInitialized = false;

function setupDownloadsControls() {
  const btnAdd = document.getElementById('btn-open-add-dl-modal');
  if (btnAdd) btnAdd.onclick = () => openAddDownloadModal();

  const btnOpenFolder = document.getElementById('btn-open-downloads-folder');
  if (btnOpenFolder) {
    btnOpenFolder.onclick = () => fetch('/api/downloads/open-folder', { method: 'POST' });
  }

  const btnGotoSettings = document.getElementById('btn-goto-dl-settings');
  if (btnGotoSettings) {
    btnGotoSettings.onclick = () => {
      currentSettingsSubTab = 'downloads';
      switchTab('SETTINGS');
    };
  }

  const closeAddModal = document.getElementById('close-add-dl-modal');
  if (closeAddModal) closeAddModal.onclick = () => closeAddDownloadModal();

  const cancelAdd = document.getElementById('btn-cancel-add-dl');
  if (cancelAdd) cancelAdd.onclick = () => closeAddDownloadModal();

  const confirmAdd = document.getElementById('btn-confirm-add-dl');
  if (confirmAdd) confirmAdd.onclick = () => confirmAddDownload();

  setupAddDownloadModalHandlers();
}

function setupAddDownloadModalHandlers() {
  if (addDownloadHandlersInitialized) return;
  addDownloadHandlersInitialized = true;

  const dropzone = document.getElementById('torrent-dropzone');
  const fileInput = document.getElementById('torrent-file-browser');
  const btnBrowse = document.getElementById('btn-browse-torrent-file');
  const btnRemove = document.getElementById('btn-remove-selected-torrent');
  const uriTextarea = document.getElementById('add-dl-uri');
  const changePathBtn = document.getElementById('btn-change-dl-path');

  if (btnBrowse && fileInput) {
    btnBrowse.onclick = (e) => {
      e.stopPropagation();
      fileInput.click();
    };
  }

  if (dropzone && fileInput) {
    dropzone.onclick = (e) => {
      if (e.target.closest('#btn-remove-selected-torrent')) return;
      if (!currentTorrentFile) fileInput.click();
    };

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });

    dropzone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');

      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.name.toLowerCase().endsWith('.torrent')) {
          handleTorrentFileSelect(file);
        } else {
          showToast('Por favor, arraste um arquivo com extensão .torrent');
        }
      } else if (e.dataTransfer) {
        const text = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
        if (text) {
          handleMagnetOrUriInput(text);
        }
      }
    });
  }

  if (fileInput) {
    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        handleTorrentFileSelect(e.target.files[0]);
      }
    };
  }

  if (btnRemove) {
    btnRemove.onclick = (e) => {
      e.stopPropagation();
      clearSelectedTorrent();
    };
  }

  if (uriTextarea) {
    uriTextarea.oninput = (e) => {
      const val = e.target.value.trim();
      extractTitleFromMagnet(val);
    };

    uriTextarea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uriTextarea.classList.add('drag-over');
    });

    uriTextarea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      uriTextarea.classList.remove('drag-over');
    });

    uriTextarea.addEventListener('drop', (e) => {
      e.preventDefault();
      uriTextarea.classList.remove('drag-over');
      const text = e.dataTransfer?.getData('text/plain') || e.dataTransfer?.getData('text/uri-list');
      if (text) {
        handleMagnetOrUriInput(text);
      }
    });
  }

  if (changePathBtn) {
    changePathBtn.onclick = () => {
      closeAddDownloadModal();
      currentSettingsSubTab = 'downloads';
      switchTab('SETTINGS');
    };
  }
}

function handleTorrentFileSelect(file) {
  playSfx('select');
  currentTorrentFile = file;
  const reader = new FileReader();
  reader.onload = () => {
    currentTorrentBase64 = reader.result;
    document.getElementById('dropzone-idle-content')?.classList.add('hidden');
    const selectedEl = document.getElementById('dropzone-selected-content');
    if (selectedEl) selectedEl.classList.remove('hidden');
    document.getElementById('selected-torrent-name').textContent = file.name;
    document.getElementById('selected-torrent-size').textContent = `${(file.size / 1024).toFixed(1)} KB`;

    const titleInput = document.getElementById('add-dl-title');
    if (titleInput && (!titleInput.value || titleInput.value.trim() === '')) {
      const cleanName = file.name.replace(/\.torrent$/i, '').replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
      titleInput.value = cleanName;
    }
  };
  reader.readAsDataURL(file);
}

function clearSelectedTorrent() {
  currentTorrentFile = null;
  currentTorrentBase64 = null;
  const fileInput = document.getElementById('torrent-file-browser');
  if (fileInput) fileInput.value = '';
  document.getElementById('dropzone-idle-content')?.classList.remove('hidden');
  document.getElementById('dropzone-selected-content')?.classList.add('hidden');
  playSfx('back');
}

function handleMagnetOrUriInput(text) {
  const uriTextarea = document.getElementById('add-dl-uri');
  if (uriTextarea) {
    uriTextarea.value = text.trim();
    extractTitleFromMagnet(text.trim());
    playSfx('nav');
  }
}

function extractTitleFromMagnet(uri) {
  if (!uri || !uri.startsWith('magnet:')) return;
  const match = uri.match(/[?&]dn=([^&]+)/i);
  if (match && match[1]) {
    try {
      const decoded = decodeURIComponent(match[1].replace(/\+/g, ' '));
      const titleInput = document.getElementById('add-dl-title');
      if (titleInput && (!titleInput.value || titleInput.value.trim() === '')) {
        titleInput.value = decoded.replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
      }
    } catch {}
  }
}

function openAddDownloadModal() {
  playSfx('select');
  clearSelectedTorrent();
  const modal = document.getElementById('add-download-modal');
  if (modal) modal.classList.remove('hidden');

  const dlPath = appState.config?.downloadSettings?.downloadPath || 'D:\\HydraDownloads';
  const pathEl = document.getElementById('add-dl-save-path');
  if (pathEl) pathEl.textContent = dlPath;

  const uriEl = document.getElementById('add-dl-uri');
  if (uriEl) uriEl.value = '';
  const titleEl = document.getElementById('add-dl-title');
  if (titleEl) {
    titleEl.value = '';
    titleEl.focus();
  }
}

function closeAddDownloadModal() {
  playSfx('back');
  clearSelectedTorrent();
  document.getElementById('add-download-modal')?.classList.add('hidden');
}

async function confirmAddDownload() {
  const title = document.getElementById('add-dl-title')?.value?.trim();
  const uri = document.getElementById('add-dl-uri')?.value?.trim();

  if (!currentTorrentBase64 && !uri) {
    showToast('Selecione um arquivo .torrent ou informe um link magnet');
    return;
  }

  showToast('Iniciando download via Libtorrent...');
  playSfx('launch');

  const savePath = appState.config?.downloadSettings?.downloadPath || '';

  try {
    const payload = {
      title: title || (currentTorrentFile ? currentTorrentFile.name.replace(/\.torrent$/i, '') : 'Download Torrent'),
      savePath
    };

    if (currentTorrentBase64) {
      payload.torrentBase64 = currentTorrentBase64;
      payload.torrentFileName = currentTorrentFile?.name || 'game.torrent';
    } else {
      payload.uri = uri;
      payload.uris = [uri];
    }

    const res = await fetch('/api/downloads/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      showToast('Download adicionado com sucesso!');
      closeAddDownloadModal();
      switchTab('DOWNLOADS');
      pollDownloads();
    } else {
      showToast(data.error || 'Erro ao iniciar download');
    }
  } catch {
    showToast('Falha na comunicação');
  }
}

window.pauseDownload = async (id) => {
  playSfx('nav');
  await fetch('/api/downloads/pause', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  pollDownloads();
};

window.resumeDownload = async (id) => {
  playSfx('select');
  await fetch('/api/downloads/resume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  pollDownloads();
};

window.cancelDownload = async (id) => {
  if (!confirm('Deseja realmente cancelar este download?')) return;
  playSfx('back');
  await fetch('/api/downloads/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, deleteFiles: false })
  });
  showToast('Download cancelado');
  pollDownloads();
};

window.openDownloadTargetFolder = async (id) => {
  playSfx('select');
  await fetch('/api/downloads/open-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
};

// --- REPACKS & DOWNLOAD SOURCES MODAL ---
async function openRepacksModal(gameTitle, options = {}) {
  playSfx('select');
  const modal = document.getElementById('repacks-modal');
  const titleEl = document.getElementById('repacks-modal-title');
  const listEl = document.getElementById('repacks-list');
  const loading = document.getElementById('repacks-modal-loading');

  if (titleEl) titleEl.textContent = `📦 Opções de Download: ${gameTitle}`;
  if (listEl) listEl.innerHTML = '';
  modal?.classList.remove('hidden');
  loading?.classList.remove('hidden');

  const closeBtn = document.getElementById('close-repacks-modal');
  if (closeBtn) closeBtn.onclick = () => closeRepacksModal();
  const closeBtn2 = document.getElementById('btn-close-repacks');
  if (closeBtn2) closeBtn2.onclick = () => closeRepacksModal();

  try {
    const objectId = options.objectId || '';
    const shop = options.shop || 'steam';
    const queryParams = new URLSearchParams({ title: gameTitle });
    if (objectId) queryParams.set('objectId', objectId);
    if (shop) queryParams.set('shop', shop);

    const res = await fetch(`/api/downloads/repacks?${queryParams.toString()}`);
    const data = await res.json();
    const repacks = data.repacks || [];

    if (repacks.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:30px;color:var(--text-muted);">
          <p>Nenhum repack encontrado diretamente para este título nas fontes cadastradas.</p>
          <button type="button" class="btn-secondary" style="margin-top:12px;color:var(--accent);border-color:var(--accent);" onclick="closeRepacksModal(); openAddDownloadModal();">
            ➕ Adicionar Magnet Manual
          </button>
        </div>
      `;
    } else {
      listEl.innerHTML = repacks.map(r => `
        <div class="repack-card">
          <div class="repack-info">
            <span class="repack-title">${escapeHtml(r.title)}</span>
            <div class="repack-meta">
              <span class="repack-source-pill">${escapeHtml(r.sourceName || r.source || 'Fonte')}</span>
              <span>${r.fileSize || (r.fileSizeBytes ? formatSize(r.fileSizeBytes) : 'N/D')}</span>
              <span>${r.uris?.length || 1} links</span>
            </div>
          </div>
          <button type="button" class="chip-btn primary" style="background:#10b981;border-color:#10b981;" onclick="window.startDownloadFromRepack('${encodeURIComponent(r.title)}', '${encodeURIComponent(JSON.stringify(r.uris || []))}')">
            🚀 Baixar Agora
          </button>
        </div>
      `).join('');
    }
  } catch {
    if (listEl) listEl.innerHTML = `<div style="color:#f87171;padding:20px;">Falha ao consultar fontes de repacks.</div>`;
  } finally {
    loading?.classList.add('hidden');
  }
}

function closeRepacksModal() {
  playSfx('back');
  document.getElementById('repacks-modal')?.classList.add('hidden');
}

window.startDownloadFromRepack = async (encodedTitle, encodedUris) => {
  const title = decodeURIComponent(encodedTitle);
  const uris = JSON.parse(decodeURIComponent(encodedUris));
  closeRepacksModal();
  showToast(`Iniciando download de ${title}...`);
  playSfx('launch');
  try {
    const res = await fetch('/api/downloads/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, uris })
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      showToast('Download adicionado à fila!');
      switchTab('DOWNLOADS');
    } else {
      showToast(data.error || 'Erro ao iniciar download');
    }
  } catch {
    showToast('Falha na comunicação ao iniciar download');
  }
};
window.openRepacksModal = openRepacksModal;

window.saveSettings = async () => {
  const consolesPatch = {};
  for (const cid of Object.keys(appState.config?.consoles || {})) {
    consolesPatch[cid] = {
      romFolder: document.getElementById(`cfg-rom-${cid}`)?.value,
      emulatorPath: document.getElementById(`cfg-emu-${cid}`)?.value
    };
    const coreEl = document.getElementById(`cfg-core-${cid}`);
    if (coreEl) consolesPatch[cid].corePath = coreEl.value;
  }

  const res = await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      steamId64: document.getElementById('cfg-steam-id')?.value || '',
      steamApiKey: document.getElementById('cfg-steam-key')?.value || '',
      raUsername: document.getElementById('cfg-ra-user')?.value || '',
      raWebApiKey: document.getElementById('cfg-ra-key')?.value || '',
      steamGridDbApiKey: document.getElementById('cfg-steamgrid-key')?.value || '',
      theGamesDbApiKey: document.getElementById('cfg-tgdb-key')?.value || '',
      ssUsername: document.getElementById('cfg-ss-user')?.value || '',
      ssPassword: document.getElementById('cfg-ss-pass')?.value || '',
      ssDevId: document.getElementById('cfg-ss-devid')?.value || '',
      ssDevPassword: document.getElementById('cfg-ss-devpass')?.value || '',
      consoles: consolesPatch
    })
  });
  if (res.ok) {
    showToast('Configurações salvas e biblioteca sincronizada!');
    await fetchState();
  }
};

function switchTab(tab) {
  closeGameContextMenu();
  selectedGameId = null;
  currentTab = tab;
  activeZone = (tab === 'ACHIEVEMENTS' || tab === 'SETTINGS' || tab === 'DOWNLOADS') ? 'SIDEBAR' : 'GRID';
  playSfx('nav');
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  const mainArea = document.querySelector('.main-area');
  if (mainArea && mainArea.scrollTop !== 0) mainArea.scrollTop = 0;
  if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
  if (document.documentElement.scrollTop !== 0) document.documentElement.scrollTop = 0;
  if (document.body.scrollTop !== 0) document.body.scrollTop = 0;

  const panel = document.getElementById('details-panel');
  if (panel) panel.classList.add('hidden');
  const video = document.getElementById('details-video');
  if (video) video.pause();
  const galVideo = document.getElementById('gallery-active-video');
  if (galVideo) galVideo.pause();

  const vCat = document.getElementById('view-catalogue');
  const vAch = document.getElementById('view-achievements');
  const vSet = document.getElementById('view-settings');
  const vHome = document.getElementById('view-home');
  const vDl = document.getElementById('view-downloads');
  const vProf = document.getElementById('view-profile');
  const azBar = document.getElementById('az-bar');

  vCat?.classList.add('hidden');
  vAch?.classList.add('hidden');
  vSet?.classList.add('hidden');
  vHome?.classList.add('hidden');
  vDl?.classList.add('hidden');
  vProf?.classList.add('hidden');
  document.getElementById('sidebar-profile-card')?.classList.toggle('active', tab === 'PROFILE');

  if (vHome) vHome.scrollTop = 0;
  if (vCat) vCat.scrollTop = 0;
  if (vDl) vDl.scrollTop = 0;
  if (vAch) vAch.scrollTop = 0;
  if (vSet) vSet.scrollTop = 0;
  if (vProf) vProf.scrollTop = 0;

  if (tab === 'DOWNLOADS') {
    startDownloadsPolling();
  } else {
    stopDownloadsPolling();
  }

  if (tab === 'PROFILE') {
    azBar?.classList.add('hidden');
    vProf?.classList.remove('hidden');
    renderProfileView();
  } else if (tab === 'HOME') {
    azBar?.classList.add('hidden');
    vHome?.classList.remove('hidden');
    renderHomeView();
  } else if (tab === 'DOWNLOADS') {
    azBar?.classList.add('hidden');
    vDl?.classList.remove('hidden');
    renderDownloadsView();
  } else if (tab === 'ACHIEVEMENTS') {
    azBar?.classList.add('hidden');
    vAch?.classList.remove('hidden');
    renderAchievementsView();
  } else if (tab === 'SETTINGS') {
    azBar?.classList.add('hidden');
    vSet?.classList.remove('hidden');
    renderSettingsView();
  } else {
    azBar?.classList.remove('hidden');
    vCat?.classList.remove('hidden');
    renderCatalogue(true);
  }
}

// --- GAMEPAD & KEYBOARD NAVIGATION ENGINE (HYDRA EXACT ORDER) ---
const TABS_ORDER = [
  'HOME', 'ALL', 'DOWNLOADS', 'ACHIEVEMENTS', 'SETTINGS',
  'FAVORITES', 'RECENT', 'PC', 'STEAM', 'EPIC', 'GOG', 'XBOX',
  'PS1', 'PS2', 'PS3', 'PSP', 'SNES', 'N64', 'GC', 'WII', 'SWITCH',
  'GB', 'GBC', 'GBA', 'GENESIS', 'MAME'
];

let lastGamepadState = {};
let lastStickTime = 0;

function handleGamepadDirection(dirX, dirY) {
  if (activeZone === 'GRID') {
    if (currentCatalogueList.length === 0) return;
    const viewSection = document.getElementById('view-catalogue');
    const { cols, rowHeight } = getGridDimensions();

    let newIndex = gamepadGridIndex;
    if (dirX === 1) newIndex += 1;
    if (dirX === -1) newIndex -= 1;
    if (dirY === 1) newIndex += cols;
    if (dirY === -1) newIndex -= cols;

    if (newIndex < 0) newIndex = 0;
    if (newIndex >= currentCatalogueList.length) newIndex = currentCatalogueList.length - 1;

    if (newIndex !== gamepadGridIndex) {
      gamepadGridIndex = newIndex;
      playSfx('nav');

      const targetRow = Math.floor(gamepadGridIndex / cols);
      const targetTop = targetRow * rowHeight;
      const targetBottom = targetTop + rowHeight;
      const currentScrollTop = viewSection.scrollTop;
      const viewHeight = viewSection.clientHeight;

      let didScroll = false;
      if (targetTop < currentScrollTop + 20) {
        viewSection.scrollTop = Math.max(0, targetTop - 20);
        didScroll = true;
      } else if (targetBottom > currentScrollTop + viewHeight - 60) {
        viewSection.scrollTop = targetBottom - viewHeight + 70;
        didScroll = true;
      }

      updateGamepadGridFocus();
      if (didScroll) {
        updateVirtualGrid();
      }
    }
  } else if (activeZone === 'COVER_MODAL') {
    if (currentCoverList.length === 0) return;
    let newIndex = coverModalIndex;
    if (dirX === 1) newIndex += 1;
    if (dirX === -1) newIndex -= 1;
    if (dirY === 1) newIndex += 4;
    if (dirY === -1) newIndex -= 4;

    if (newIndex < 0) newIndex = 0;
    if (newIndex >= currentCoverList.length) newIndex = currentCoverList.length - 1;

    if (newIndex !== coverModalIndex) {
      coverModalIndex = newIndex;
      playSfx('nav');
      const game = appState.games.find(g => g.id === selectedGameId);
      if (game) renderCoverModalCards(game);
      const focusedCard = document.querySelector(`.cover-card[data-index="${coverModalIndex}"]`);
      if (focusedCard) focusedCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
}

function handleGamepadButtonA() {
  if (activeZone === 'GRID') {
    const game = currentCatalogueList[gamepadGridIndex];
    if (!game) return;
    playSfx('select');
    selectGame(game);
  } else if (activeZone === 'DETAILS') {
    const discSelect = document.getElementById('disc-select');
    const discIdx = parseInt(discSelect?.value || '0', 10);
    playSfx('launch');
    launchSelectedGame(selectedGameId, discIdx);
  } else if (activeZone === 'COVER_MODAL') {
    const cover = currentCoverList[coverModalIndex];
    const game = appState.games.find(g => g.id === selectedGameId);
    if (cover && game) {
      selectCoverFromModal(game, cover);
    }
  }
}

function handleGamepadButtonB() {
  const sideMenu = document.getElementById('sidebar-context-menu');
  if (sideMenu && !sideMenu.classList.contains('hidden')) {
    closeSidebarContextMenu();
    return;
  }
  const ctxMenu = document.getElementById('game-context-menu');
  if (ctxMenu && !ctxMenu.classList.contains('hidden')) {
    closeGameContextMenu();
    return;
  }
  const removeModal = document.getElementById('remove-game-modal');
  if (removeModal && !removeModal.classList.contains('hidden')) {
    removeModal.classList.add('hidden');
    playSfx('back');
    return;
  }
  if (activeZone === 'COVER_MODAL') {
    closeCoverModal();
  } else if (activeZone === 'DETAILS') {
    closeGameDetails();
  } else if (activeZone === 'GRID') {
    playSfx('back');
  }
}

function handleGamepadButtonX() {
  if (activeZone === 'GRID') {
    const game = currentCatalogueList[gamepadGridIndex];
    if (game) {
      playSfx('launch');
      selectGame(game);
      launchSelectedGame(game.id, 0);
    }
  }
}

function handleGamepadButtonY() {
  const targetId = (activeZone === 'DETAILS' && selectedGameId)
    ? selectedGameId
    : currentCatalogueList[gamepadGridIndex]?.id;
  if (targetId) {
    playSfx('fav');
    toggleFavorite(targetId);
  }
}

function handleGamepadShoulder(delta) {
  if (activeZone === 'COVER_MODAL') {
    switchCoverSourceFilter(delta);
    return;
  }
  let idx = TABS_ORDER.indexOf(currentTab);
  if (idx === -1) idx = 0;
  idx = (idx + delta + TABS_ORDER.length) % TABS_ORDER.length;
  playSfx('select');
  switchTab(TABS_ORDER[idx]);
}

function handleGamepadSelect() {
  const targetId = selectedGameId || currentCatalogueList[gamepadGridIndex]?.id;
  if (targetId) {
    openCoverSelector(targetId);
  }
}

function handleGamepadStart() {
  const targetId = selectedGameId || currentCatalogueList[gamepadGridIndex]?.id;
  if (targetId) {
    playSfx('launch');
    launchSelectedGame(targetId, 0);
  }
}

function handlePageJump(delta) {
  if (currentTab === 'HOME') {
    const isFullCatalogue = (currentHomeCategory === 'all' || currentHomeCategory === 'catalogue');
    const searchInput = document.getElementById('home-search-input');
    const hasSearch = Boolean(searchInput && searchInput.value.trim());
    if (isFullCatalogue || hasSearch || currentHomeGenre) {
      changeHomePage(homeCurrentPage + delta);
      return;
    }
  }
  if (activeZone !== 'GRID' || currentCatalogueList.length === 0) return;
  const viewSection = document.getElementById('view-catalogue');
  if (!viewSection) return;

  const { cols, rowHeight } = getGridDimensions();
  const viewHeight = viewSection.clientHeight || 800;
  const rowsPerPage = Math.max(2, Math.floor(viewHeight / rowHeight));
  const jumpCount = rowsPerPage * cols;

  let newIndex = gamepadGridIndex + delta * jumpCount;
  if (newIndex < 0) newIndex = 0;
  if (newIndex >= currentCatalogueList.length) newIndex = currentCatalogueList.length - 1;

  if (newIndex !== gamepadGridIndex) {
    gamepadGridIndex = newIndex;
    playSfx('nav');

    const targetRow = Math.floor(gamepadGridIndex / cols);
    const targetTop = targetRow * rowHeight;
    viewSection.scrollTo({ top: Math.max(0, targetTop - 20), behavior: 'smooth' });

    updateGamepadGridFocus();
    updateVirtualGrid();
  }
}

function gamepadLoop() {
  requestAnimationFrame(gamepadLoop);

  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (let i = 0; i < gamepads.length; i++) {
    if (gamepads[i] && gamepads[i].connected) {
      gp = gamepads[i];
      break;
    }
  }
  if (!gp) return;

  const now = performance.now();

  const isButtonPressed = (bIdx) => {
    const btn = gp.buttons[bIdx];
    const isDown = btn && (btn.pressed || btn.value > 0.5);
    const wasDown = Boolean(lastGamepadState[`b_${bIdx}`]);
    lastGamepadState[`b_${bIdx}`] = isDown;
    return isDown && !wasDown;
  };

  let dirX = 0;
  let dirY = 0;

  if (gp.buttons[12]?.pressed) dirY = -1; // Up
  if (gp.buttons[13]?.pressed) dirY = 1;  // Down
  if (gp.buttons[14]?.pressed) dirX = -1; // Left
  if (gp.buttons[15]?.pressed) dirX = 1;  // Right

  const axisX = gp.axes[0] || 0;
  const axisY = gp.axes[1] || 0;
  if (Math.abs(axisX) > 0.38) dirX = axisX > 0 ? 1 : -1;
  if (Math.abs(axisY) > 0.38) dirY = axisY > 0 ? 1 : -1;

  if (dirX !== 0 || dirY !== 0) {
    if (now - lastStickTime > 180) {
      lastStickTime = now;
      handleGamepadDirection(dirX, dirY);
    }
  } else {
    lastStickTime = 0;
  }

  if (isButtonPressed(0)) handleGamepadButtonA();
  if (isButtonPressed(1)) handleGamepadButtonB();
  if (isButtonPressed(2)) handleGamepadButtonX();
  if (isButtonPressed(3)) handleGamepadButtonY();
  if (isButtonPressed(4)) handleGamepadShoulder(-1);
  if (isButtonPressed(5)) handleGamepadShoulder(1);
  if (isButtonPressed(6)) handlePageJump(-1); // LT (Page Up)
  if (isButtonPressed(7)) handlePageJump(1);  // RT (Page Down)
  if (isButtonPressed(8)) handleGamepadSelect();
  if (isButtonPressed(9)) handleGamepadStart();
}

// --- USER PROFILE & HYDRA ACCOUNT ENGINE (HYDRA LAUNCHER COMPATIBLE) ---
let currentUserProfile = null;

async function loadUserProfile() {
  try {
    const res = await fetch('/api/profile');
    if (res.ok) {
      currentUserProfile = await res.json();
      updateProfileUI();
    }
  } catch (e) {
    console.warn('Erro ao carregar perfil do usuário:', e);
  }
}
window.loadUserProfile = loadUserProfile;

function openHydraAuth() {
  playSfx('select');
  if (window.hydraAuth && typeof window.hydraAuth.openAuthWindow === 'function') {
    window.hydraAuth.openAuthWindow();
    showToast('Abrindo janela de login oficial do Hydra...');
  } else {
    // Fallback para navegador ou ambiente fora do Electron
    window.open('https://auth.hydra.losbroxas.org/?lng=pt-BR', '_blank');
    openEditProfileModal();
    showToast('Faça login na aba aberta e cole a URL de redirecionamento ou token nas opções avançadas.');
  }
}
window.openHydraAuth = openHydraAuth;

function updateProfileUI() {
  const isLoggedIn = Boolean(currentUserProfile && currentUserProfile.isLoggedInHydra);
  const nameEl = document.getElementById('sidebar-profile-name');
  const statusEl = document.getElementById('sidebar-profile-status');
  const avatarEl = document.getElementById('sidebar-avatar');
  const avatarPlaceholder = document.getElementById('sidebar-avatar-placeholder');
  const statusIndicator = document.getElementById('sidebar-status-indicator');

  if (isLoggedIn) {
    if (nameEl) nameEl.textContent = currentUserProfile.displayName || currentUserProfile.username || 'Gamer';
    if (statusEl) {
      statusEl.classList.remove('hidden');
      statusEl.textContent = currentUserProfile.subscription
        ? `Hydra ${currentUserProfile.subscription}`
        : 'Conectado (Hydra)';
    }
    if (avatarEl && currentUserProfile.profileImageUrl) {
      avatarEl.src = currentUserProfile.profileImageUrl;
      avatarEl.classList.remove('hidden');
      avatarPlaceholder?.classList.add('hidden');
    } else {
      avatarEl?.classList.add('hidden');
      avatarPlaceholder?.classList.remove('hidden');
    }
    if (statusIndicator) {
      statusIndicator.classList.remove('hidden');
      statusIndicator.className = 'profile-status-indicator online';
    }
  } else {
    // Modo Deslogado — Idêntico ao Hydra Launcher original (Sem perfil fake)
    if (nameEl) nameEl.textContent = 'Entrar';
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.classList.add('hidden');
    }
    if (avatarEl) {
      avatarEl.src = '';
      avatarEl.classList.add('hidden');
    }
    if (avatarPlaceholder) {
      avatarPlaceholder.classList.remove('hidden');
    }
    if (statusIndicator) {
      statusIndicator.classList.add('hidden');
    }
  }

  if (currentTab === 'PROFILE') {
    renderProfileView();
  }
}

function renderProfileView() {
  const prof = currentUserProfile || {};
  const isLoggedIn = Boolean(prof.isLoggedInHydra);
  const loggedOutState = document.getElementById('profile-logged-out-state');
  const loggedInContent = document.getElementById('profile-logged-in-content');

  if (!isLoggedIn) {
    if (loggedOutState) loggedOutState.classList.remove('hidden');
    if (loggedInContent) loggedInContent.classList.add('hidden');
    const btnPageSignIn = document.getElementById('btn-login-profile-page');
    if (btnPageSignIn) btnPageSignIn.onclick = () => openHydraAuth();
    return;
  }

  if (loggedOutState) loggedOutState.classList.add('hidden');
  if (loggedInContent) loggedInContent.classList.remove('hidden');

  const bannerBg = document.getElementById('profile-banner-bg');
  const avatarLarge = document.getElementById('profile-avatar-large');
  const nameDisplay = document.getElementById('profile-name-display');
  const usernameTag = document.getElementById('profile-username-tag');
  const bioText = document.getElementById('profile-bio-text');
  const badgeSub = document.getElementById('profile-badge-sub');

  if (bannerBg) {
    bannerBg.style.backgroundImage = prof.backgroundImageUrl ? `url("${prof.backgroundImageUrl}")` : 'none';
  }
  if (avatarLarge) {
    avatarLarge.src = prof.profileImageUrl || '';
    avatarLarge.style.display = prof.profileImageUrl ? 'block' : 'none';
  }
  if (nameDisplay) {
    nameDisplay.textContent = prof.displayName || prof.username || 'Gamer';
  }
  if (usernameTag) {
    usernameTag.textContent = prof.username ? `@${prof.username}` : '';
  }
  if (bioText) {
    bioText.textContent = prof.bio || '';
  }
  if (badgeSub) {
    badgeSub.textContent = prof.subscription ? `Hydra ${prof.subscription}` : 'Hydra Oficial';
  }

  // Stats
  const playtimeEl = document.getElementById('prof-stat-playtime');
  const achEl = document.getElementById('prof-stat-achievements');
  const gamesEl = document.getElementById('prof-stat-games');
  const karmaEl = document.getElementById('prof-stat-karma');

  const totalSec = prof.stats?.totalPlayTimeSeconds || appState.stats?.totalPlayTimeSeconds || 0;
  if (playtimeEl) playtimeEl.textContent = formatPlaytime(totalSec);
  if (achEl) achEl.textContent = prof.stats?.totalAchievements || 0;
  if (gamesEl) gamesEl.textContent = appState.games?.length || 0;
  if (karmaEl) karmaEl.textContent = prof.karma || 0;

  // Render Top Played Games
  const topList = prof.topPlayedGames || (appState.games || []).filter(g => (g.playTimeSeconds || 0) > 0).sort((a, b) => (b.playTimeSeconds || 0) - (a.playTimeSeconds || 0)).slice(0, 6);
  const topGrid = document.getElementById('profile-top-games');
  if (topGrid) {
    topGrid.innerHTML = '';
    if (topList.length === 0) {
      topGrid.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:12px 0;">Nenhum jogo com tempo registrado ainda. Inicie uma partida para acumular estatísticas!</div>`;
    } else {
      topList.forEach(g => {
        const item = document.createElement('div');
        item.className = 'similar-game-card';
        item.innerHTML = `
          <img src="${g.coverUrl || ''}" class="similar-game-art" alt="${g.title}">
          <div class="similar-game-info">
            <span class="similar-game-title">${g.title}</span>
            <span class="similar-game-meta">⏱️ ${formatPlaytime(g.playTimeSeconds || 0)}</span>
          </div>
        `;
        item.onclick = () => selectGame(g);
        topGrid.appendChild(item);
      });
    }
  }

  // Bind Buttons
  const btnEdit = document.getElementById('btn-edit-profile');
  if (btnEdit) btnEdit.onclick = () => openEditProfileModal();
  const btnSignOut = document.getElementById('btn-signout-profile');
  if (btnSignOut) btnSignOut.onclick = () => openSignOutModal();
}

function openEditProfileModal() {
  playSfx('select');
  const modal = document.getElementById('profile-edit-modal');
  if (!modal) return;
  const prof = currentUserProfile || {};
  const isLoggedIn = Boolean(prof.isLoggedInHydra);

  document.getElementById('edit-profile-name').value = prof.displayName || '';
  document.getElementById('edit-profile-bio').value = prof.bio || '';
  document.getElementById('edit-profile-avatar').value = prof.profileImageUrl || '';
  document.getElementById('edit-profile-banner').value = prof.backgroundImageUrl || '';
  const tokenInput = document.getElementById('edit-profile-token');
  if (tokenInput) tokenInput.value = '';

  const statusTitle = document.getElementById('modal-hydra-status-title');
  const statusSub = document.getElementById('modal-hydra-status-sub');
  const btnAuth = document.getElementById('btn-modal-hydra-auth');

  if (statusTitle && statusSub && btnAuth) {
    if (isLoggedIn) {
      statusTitle.textContent = `Conectado como @${prof.username || 'gamer'}`;
      statusSub.textContent = `Karma: ${prof.karma || 0} • Status: ${prof.subscription || 'Membro Oficial'}`;
      btnAuth.className = 'chip-btn danger';
      btnAuth.innerHTML = '<span>Desconectar</span>';
      btnAuth.onclick = () => {
        closeEditProfileModal();
        openSignOutModal();
      };
    } else {
      statusTitle.textContent = 'Conta Convidado (Offline)';
      statusSub.textContent = 'Conecte sua conta oficial Hydra para sincronizar perfil, karma e conquistas.';
      btnAuth.className = 'chip-btn primary';
      btnAuth.innerHTML = '<span>Conectar</span>';
      btnAuth.onclick = () => {
        closeEditProfileModal();
        openHydraAuth();
      };
    }
  }

  modal.classList.remove('hidden');

  document.getElementById('close-profile-modal').onclick = () => closeEditProfileModal();
  document.getElementById('btn-cancel-profile').onclick = () => closeEditProfileModal();
  document.getElementById('btn-save-profile').onclick = () => saveProfile();
  const btnLoginToken = document.getElementById('btn-login-hydra-token');
  if (btnLoginToken) btnLoginToken.onclick = () => loginHydraAccount();
}
window.openEditProfileModal = openEditProfileModal;

function closeEditProfileModal() {
  document.getElementById('profile-edit-modal')?.classList.add('hidden');
  playSfx('back');
}

function openSignOutModal() {
  playSfx('select');
  const modal = document.getElementById('signout-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  document.getElementById('close-signout-modal').onclick = () => closeSignOutModal();
  document.getElementById('btn-cancel-signout').onclick = () => closeSignOutModal();
  document.getElementById('btn-confirm-signout').onclick = () => confirmSignOut();
}
window.openSignOutModal = openSignOutModal;

function closeSignOutModal() {
  document.getElementById('signout-modal')?.classList.add('hidden');
  playSfx('back');
}

async function confirmSignOut() {
  playSfx('select');
  try {
    const res = await fetch('/api/profile/logout', { method: 'POST' });
    if (res.ok) {
      showToast('Você saiu da sua conta oficial Hydra.');
      await loadUserProfile();
      closeSignOutModal();
    } else {
      showToast('Erro ao encerrar sessão Hydra.');
    }
  } catch {
    showToast('Falha na comunicação com o servidor.');
  }
}

async function saveProfile() {
  playSfx('select');
  const displayName = document.getElementById('edit-profile-name').value.trim();
  const bio = document.getElementById('edit-profile-bio').value.trim();
  const profileImageUrl = document.getElementById('edit-profile-avatar').value.trim();
  const backgroundImageUrl = document.getElementById('edit-profile-banner').value.trim();

  try {
    const res = await fetch('/api/profile/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, bio, profileImageUrl, backgroundImageUrl })
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Perfil atualizado com sucesso!');
      await loadUserProfile();
      closeEditProfileModal();
    } else {
      showToast(data.error || 'Erro ao salvar perfil');
    }
  } catch {
    showToast('Falha na comunicação com o servidor');
  }
}

async function loginHydraAccount() {
  playSfx('select');
  const token = document.getElementById('edit-profile-token').value.trim();
  if (!token) {
    showToast('Por favor, insira a URL de autenticação ou Token');
    return;
  }
  showToast('Autenticando com a API oficial do Hydra...');
  try {
    const res = await fetch('/api/profile/login-hydra', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: token, token })
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Bem-vindo, ${data.profile?.displayName || data.profile?.username}! Conta Hydra conectada!`);
      await loadUserProfile();
      closeEditProfileModal();
    } else {
      showToast(data.error || 'Credenciais inválidas ou falha de autenticação');
    }
  } catch {
    showToast('Falha ao conectar com a API do Hydra');
  }
}

// Init Events
document.addEventListener('DOMContentLoaded', () => {
  buildAzBar();
  fetchState();
  loadUserProfile();
  // Fallback safety timeout if scanning is complete or not triggered
  setTimeout(() => {
    if (!appState.isScanning) dismissBootSplash();
  }, 6000);
  requestAnimationFrame(gamepadLoop);

  window.addEventListener('click', initAudio, { passive: true });
  window.addEventListener('keydown', initAudio, { passive: true });

  setInterval(() => {
    const now = new Date();
    document.getElementById('clock-widget').textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }, 1000);

  // Poll live playtime every 3 seconds
  setInterval(fetchState, 3000);

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
    btn.addEventListener('contextmenu', (e) => {
      openSidebarContextMenu(e, btn.dataset.tab);
    });
  });

  const profileCard = document.getElementById('sidebar-profile-card');
  if (profileCard) {
    profileCard.onclick = () => {
      if (!currentUserProfile?.isLoggedInHydra) {
        openHydraAuth();
      } else {
        switchTab('PROFILE');
      }
    };
  }

  if (window.hydraAuth && typeof window.hydraAuth.onProfileUpdated === 'function') {
    window.hydraAuth.onProfileUpdated(() => {
      showToast('Conta Hydra conectada com sucesso!');
      loadUserProfile();
    });
  }

  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('clear-search');
  searchInput.oninput = (e) => {
    searchQuery = e.target.value;
    clearBtn.classList.toggle('hidden', !searchQuery);
    renderCatalogue();
  };
  clearBtn.onclick = () => {
    searchQuery = '';
    searchInput.value = '';
    clearBtn.classList.add('hidden');
    renderCatalogue();
  };

  document.getElementById('sort-select').onchange = (e) => {
    sortMode = e.target.value;
    renderCatalogue();
  };

  const btnToggleInstalled = document.getElementById('btn-toggle-installed');
  if (btnToggleInstalled) {
    btnToggleInstalled.onclick = () => {
      showInstalledOnly = !showInstalledOnly;
      btnToggleInstalled.classList.toggle('active', showInstalledOnly);
      const label = document.getElementById('label-toggle-installed');
      if (label) label.textContent = showInstalledOnly ? '⚡ Apenas Instalados' : 'Instalados & Nuvem';
      playSfx('select');
      renderCatalogue(true);
    };
  }

  // Unified All-in-One Scan Button
  const btnScanAll = document.getElementById('btn-scan-all');
  if (btnScanAll) {
    btnScanAll.onclick = () => scanAllLibraryUnified();
  }

  document.getElementById('btn-stop-game').onclick = async () => {
    await fetch('/api/stop', { method: 'POST' });
    await fetchState();
    showToast('Emulador encerrado.');
  };

  document.getElementById('close-details').onclick = () => {
    closeGameDetails();
  };

  window.addEventListener('click', (e) => {
    const menu = document.getElementById('game-context-menu');
    if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target)) {
      closeGameContextMenu();
    }
    const sideMenu = document.getElementById('sidebar-context-menu');
    if (sideMenu && !sideMenu.classList.contains('hidden') && !sideMenu.contains(e.target)) {
      closeSidebarContextMenu();
    }
  });

  document.getElementById('btn-exit-app').onclick = async () => {
    await fetch('/api/quit', { method: 'POST' }).catch(() => {});
    window.close();
  };

  const viewSection = document.getElementById('view-catalogue');
  if (viewSection) {
    viewSection.addEventListener('scroll', () => {
      if (virtualScrollRaf) cancelAnimationFrame(virtualScrollRaf);
      virtualScrollRaf = requestAnimationFrame(() => updateVirtualGrid());
    }, { passive: true });
  }

  window.addEventListener('resize', () => {
    if (virtualScrollRaf) cancelAnimationFrame(virtualScrollRaf);
    virtualScrollRaf = requestAnimationFrame(() => updateVirtualGrid(true));
  });

  window.addEventListener('keydown', (e) => {
    initAudio();
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
      if (e.key === 'Escape') {
        e.target.blur();
      }
      return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      searchInput.focus();
      return;
    }

    if (e.key === 'ArrowUp') { e.preventDefault(); handleGamepadDirection(0, -1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); handleGamepadDirection(0, 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); handleGamepadDirection(-1, 0); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); handleGamepadDirection(1, 0); }
    else if (e.key === 'PageUp') { e.preventDefault(); handlePageJump(-1); }
    else if (e.key === 'PageDown') { e.preventDefault(); handlePageJump(1); }
    else if (e.key === 'Enter') { e.preventDefault(); handleGamepadButtonA(); }
    else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); handleGamepadButtonB(); }
    else if (e.key.toLowerCase() === 'f') { e.preventDefault(); handleGamepadButtonY(); }
    else if (e.key.toLowerCase() === 'c') { e.preventDefault(); handleGamepadSelect(); }
    else if (e.key.toLowerCase() === 'q') { e.preventDefault(); handleGamepadShoulder(-1); }
    else if (e.key.toLowerCase() === 'e') { e.preventDefault(); handleGamepadShoulder(1); }
  });
});
