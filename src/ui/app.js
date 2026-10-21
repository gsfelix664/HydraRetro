let appState = {
  config: {},
  games: [],
  sessions: [],
  activeSession: null,
  stats: {}
};

let currentTab = 'ALL'; // ALL, FAVORITES, RECENT, PS1, GENESIS, ACHIEVEMENTS, SETTINGS
let currentLetter = 'ALL';
let searchQuery = '';
let sortMode = 'ALPHA_ASC';
let selectedGameId = null;

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

async function fetchState() {
  try {
    const res = await fetch('/api/state');
    appState = await res.json();
    updateSidebarStats();
    updateRunningBanner();
    if (currentTab === 'ACHIEVEMENTS') {
      renderAchievementsView();
    } else if (currentTab === 'SETTINGS') {
      // Don't overwrite input focus if already on settings
    } else {
      renderCatalogue();
    }
    if (selectedGameId) {
      const updated = appState.games.find(g => g.id === selectedGameId);
      if (updated) updateDetailsLiveStats(updated);
    }
  } catch (e) {
    console.error('Error fetching state:', e);
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
  setBadge('badge-ps1', games.filter(g => g.consoleId === 'PS1').length);
  setBadge('badge-genesis', games.filter(g => g.consoleId === 'GENESIS').length);
  setBadge('badge-snes', games.filter(g => g.consoleId === 'SNES').length);
  setBadge('badge-mame', games.filter(g => g.consoleId === 'MAME').length);
  setBadge('badge-ps2', games.filter(g => g.consoleId === 'PS2').length);
  setBadge('badge-wii', games.filter(g => g.consoleId === 'WII').length);
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

  if (currentTab === 'FAVORITES') {
    list = list.filter(g => g.favorite);
  } else if (currentTab === 'RECENT') {
    list = list.filter(g => Boolean(g.lastPlayedAt));
  } else if (currentTab !== 'ALL' && currentTab !== 'ACHIEVEMENTS' && currentTab !== 'SETTINGS') {
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

  if (currentTab === 'RECENT' && sortMode === 'ALPHA_ASC') {
    list.sort((a, b) => new Date(b.lastPlayedAt || 0) - new Date(a.lastPlayedAt || 0));
  } else if (sortMode === 'ALPHA_ASC') {
    list.sort((a, b) => (a.sortTitle || a.title).localeCompare(b.sortTitle || b.title, 'pt-BR', { numeric: true }));
  } else if (sortMode === 'ALPHA_DESC') {
    list.sort((a, b) => (b.sortTitle || b.title).localeCompare(a.sortTitle || a.title, 'pt-BR', { numeric: true }));
  } else if (sortMode === 'RATING_DESC') {
    list.sort((a, b) => {
      const diff = (b.rating || 0) - (a.rating || 0);
      if (Math.abs(diff) > 0.001) return diff;
      return (a.sortTitle || a.title).localeCompare(b.sortTitle || b.title, 'pt-BR', { numeric: true });
    });
  } else if (sortMode === 'RATING_ASC') {
    list.sort((a, b) => {
      const diff = (a.rating || 0) - (b.rating || 0);
      if (Math.abs(diff) > 0.001) return diff;
      return (a.sortTitle || a.title).localeCompare(b.sortTitle || b.title, 'pt-BR', { numeric: true });
    });
  } else if (sortMode === 'PLAYTIME') {
    list.sort((a, b) => (b.playTimeSeconds || 0) - (a.playTimeSeconds || 0) || a.title.localeCompare(b.title));
  } else if (sortMode === 'RECENT') {
    list.sort((a, b) => new Date(b.lastPlayedAt || 0) - new Date(a.lastPlayedAt || 0) || a.title.localeCompare(b.title));
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
    PS1: ['PlayStation 1 (DuckStation)', `${filtered.length} jogos em alta definição • DuckStation`],
    GENESIS: ['Sega Mega Drive (Genesis Plus GX)', `${filtered.length} jogos clássicos 16-bits • Genesis Plus GX`],
    SNES: ['Super Nintendo (Snes9x)', `${filtered.length} jogos clássicos 16-bits • Snes9x`],
    MAME: ['Arcade / MAME (FBNeo)', `${filtered.length} sucessos de fliperama • FBNeo`],
    PS2: ['PlayStation 2 (PCSX2)', `${filtered.length} sucessos em 3D • PCSX2 Qt`],
    WII: ['Nintendo Wii (Dolphin)', `${filtered.length} clássicos Nintendo • Dolphin Emulator`],
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

  const availableWidth = grid.clientWidth || (viewSection.clientWidth - 56) || 1000;
  const minColWidth = 175;
  const gap = 20;
  const cols = Math.max(1, Math.floor((availableWidth + gap) / (minColWidth + gap)));
  const cardWidth = Math.floor((availableWidth - (cols - 1) * gap) / cols);
  const cardHeight = Math.round(cardWidth * 1.38 + 62);
  const rowHeight = cardHeight + gap;
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

  grid.innerHTML = '';
  const frag = document.createDocumentFragment();

  for (let i = startIndex; i < endIndex; i++) {
    const game = currentCatalogueList[i];
    const row = Math.floor(i / cols);
    const col = i % cols;
    const posX = col * (cardWidth + gap);
    const posY = row * rowHeight;

    const card = createGameCardElement(game, cardWidth, cardHeight, posX, posY);
    frag.appendChild(card);
  }

  grid.appendChild(frag);
}

function createGameCardElement(game, cardWidth, cardHeight, posX, posY) {
  const card = document.createElement('div');
  card.className = `game-card ${selectedGameId === game.id ? 'selected' : ''}`;
  card.dataset.id = game.id;
  card.style.position = 'absolute';
  card.style.left = `${posX}px`;
  card.style.top = `${posY}px`;
  card.style.width = `${cardWidth}px`;
  card.style.height = `${cardHeight}px`;

  const artWrap = document.createElement('div');
  artWrap.className = 'card-art-wrap';

  // Shimmer skeleton placeholder
  const shimmer = document.createElement('div');
  shimmer.className = 'card-placeholder-shimmer';
  artWrap.appendChild(shimmer);

  const img = document.createElement('img');
  img.className = 'card-art loading';
  img.loading = 'lazy';
  img.alt = game.title;
  img.src = game.thumbUrl || game.coverUrl || game.fallbackCoverUrl || '';
  let candIdx = 0;
  img.onerror = () => {
    while (game.coverCandidates && candIdx < game.coverCandidates.length) {
      const next = game.coverCandidates[candIdx++];
      if (next && next !== img.src) {
        img.src = next;
        return;
      }
    }
    if (game.fallbackCoverUrl && img.src !== window.location.origin + game.fallbackCoverUrl) {
      img.src = game.fallbackCoverUrl;
    } else {
      img.style.display = 'none';
      shimmer.style.display = 'none';
    }
  };
  img.onload = () => {
    img.className = 'card-art loaded';
    shimmer.style.display = 'none';
    game.coverUrl = img.src;
  };
  artWrap.appendChild(img);

  const badges = document.createElement('div');
  badges.className = 'card-top-badges';
  const ratingVal = (typeof game.rating === 'number' ? game.rating : 4.8).toFixed(1);
  badges.innerHTML = `
    <div class="card-badges-left">
      <span class="card-console-tag ${game.consoleId}">${game.consoleId === 'GENESIS' ? 'MD' : (game.consoleId === 'MAME' ? 'ARC' : game.consoleId)}</span>
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

  const overlay = document.createElement('div');
  overlay.className = 'card-play-overlay';
  const playBtn = document.createElement('button');
  playBtn.className = 'quick-play-circle';
  playBtn.innerHTML = '▶';
  playBtn.title = `Jogar ${game.title} agora`;
  playBtn.onclick = (e) => {
    e.stopPropagation();
    selectGame(game);
    launchSelectedGame(game.id, 0);
  };
  overlay.appendChild(playBtn);
  artWrap.appendChild(overlay);

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

  card.onclick = () => selectGame(game);
  card.ondblclick = () => launchSelectedGame(game.id, 0);

  return card;
}

function selectGame(game) {
  selectedGameId = game.id;
  document.querySelectorAll('.game-card').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === game.id);
  });

  const panel = document.getElementById('details-panel');
  panel.classList.remove('hidden');

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

  // SteamGridDB Button Handler
  const sgBtn = document.getElementById('btn-steamgrid-game');
  sgBtn.onclick = async () => {
    const key = appState.config?.steamGridDbApiKey;
    if (!key) {
      showToast('Insira sua chave gratuita do SteamGridDB nas Configurações!');
      switchTab('SETTINGS');
      return;
    }
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
        showToast(data.error || 'Erro ao consultar SteamGridDB');
      } else {
        showToast('Artes HD aplicadas com sucesso do SteamGridDB!');
        await fetchState();
        const updated = appState.games.find(g => g.id === game.id);
        if (updated) selectGame(updated);
      }
    } catch {
      showToast('Falha na comunicação com SteamGridDB');
    } finally {
      sgBtn.disabled = false;
    }
  };

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

  document.getElementById('btn-play-main').onclick = () => {
    const discIdx = parseInt(discSelect.value || '0', 10);
    launchSelectedGame(game.id, discIdx);
  };

  document.getElementById('btn-fav-toggle').onclick = () => toggleFavorite(game.id);
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
    mainEl.textContent = data.mainTime || '--';
    extraEl.textContent = data.mainExtraTime || '--';
    compEl.textContent = data.completionistTime || '--';
    if (data.url) linkEl.href = data.url;
    if (data.reviewScore) scoreEl.textContent = `⭐ Avaliação da Comunidade: ${data.reviewScore}%`;
    if (data.name) matchedEl.textContent = `Correspondência: ${data.name}`;
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
        Sem conquistas pré-fabricadas.<br>
        Conecte seu usuário e Web API Key do <strong>RetroAchievements.org</strong> nas <em>Configurações</em> para sincronizar troféus oficiais.
      </div>
    `;
  } else {
    const unlockedCount = achs.filter(a => a.unlocked).length;
    achSummary.textContent = `${unlockedCount} / ${achs.length} desbloqueadas`;
    achList.innerHTML = achs.map(a => `
      <div class="ach-item ${a.unlocked ? 'unlocked' : ''}">
        <span class="ach-icon">${a.icon ? `<img src="${a.icon}" width="28" height="28" style="border-radius:4px;">` : '🏆'}</span>
        <div class="ach-info">
          <div class="ach-title">${a.title}</div>
          <div class="ach-desc">${a.description}</div>
        </div>
        <span class="ach-pts">+${a.points || 0} PTS</span>
      </div>
    `).join('');
  }
}
async function launchSelectedGame(gameId, discIndex = 0) {
  try {
    showToast('Iniciando jogo em tela cheia...');
    const res = await fetch('/api/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, discIndex })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(`Erro: ${data.error}`);
      return;
    }
    await fetchState();
  } catch (e) {
    showToast('Falha ao iniciar o jogo');
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

function renderSettingsView() {
  const container = document.getElementById('settings-container');
  const consoles = appState.config?.consoles || {};

  let html = '';
  for (const [cid, c] of Object.entries(consoles)) {
    html += `
      <div class="settings-card">
        <h3>🎮 ${c.name} (${cid})</h3>
        <div class="field-row">
          <label>Pasta de ROMs (Monitoramento Automático):</label>
          <div class="field-input-group">
            <input type="text" id="cfg-rom-${cid}" value="${c.romFolder || ''}">
            <button class="btn-secondary" onclick="openExplorer('${(c.romFolder || '').replace(/\\/g, '\\\\')}')">📂 Abrir Pasta de ROMs</button>
          </div>
        </div>
        <div class="field-row">
          <label>Executável do Emulador Pré-configurado:</label>
          <div class="field-input-group">
            <input type="text" id="cfg-emu-${cid}" value="${c.emulatorPath || ''}">
          </div>
        </div>
        ${c.corePath ? `
        <div class="field-row">
          <label>Núcleo (Core Libretro):</label>
          <div class="field-input-group">
            <input type="text" id="cfg-core-${cid}" value="${c.corePath || ''}">
          </div>
        </div>` : ''}
      </div>
    `;
  }

  html += `
    <div class="settings-card">
      <h3>🎨 SteamGridDB — Capas, Banners & Logos em Alta Definição</h3>
      <p style="font-size:12px;color:#9ca3af;margin-bottom:12px;">
        Conecte com a API do SteamGridDB para obter pôsteres em alta resolução (600x900), banners panorâmicos e logos transparentes.
      </p>
      <div class="field-row">
        <label>Chave da API SteamGridDB (API Key):</label>
        <div class="field-input-group">
          <input type="password" id="cfg-steamgrid-key" placeholder="Cole sua API Key aqui (ex: 8a7f9b...)" value="${appState.config?.steamGridDbApiKey || ''}">
          <a href="https://www.steamgriddb.com/profile/preferences/api" target="_blank" class="btn-secondary" style="display:inline-flex;align-items:center;text-decoration:none;">🔑 Gerar Chave Gratuita</a>
        </div>
      </div>
      <div style="margin-top:10px;display:flex;gap:10px;">
        <button class="btn-secondary" style="color:var(--accent);border-color:var(--accent);" onclick="syncAllSteamGrid()">⚡ Baixar Artes em HD para Todos os Jogos</button>
      </div>
    </div>
  `;

  html += `
    <div class="settings-card">
      <h3>🌐 Metadados e Sinopses Automáticas (Wikipedia & Web)</h3>
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px;">
        O HydraRetro pesquisa e preenche automaticamente o enredo original, ano de lançamento, desenvolvedora e publicadora dos seus jogos sem precisar de nenhuma chave ou configuração adicional.
      </p>
      <div style="display:flex;gap:10px;">
        <button class="btn-secondary" style="color:#38bdf8;border-color:#38bdf8;" onclick="syncAllMetadata()">⚡ Sincronizar Sinopses e Metadados Online Agora</button>
      </div>
    </div>
  `;

  html += `
    <div class="settings-card">
      <h3>🏆 Integração Opcional RetroAchievements.org</h3>
      <div class="field-row">
        <label>Usuário RetroAchievements:</label>
        <div class="field-input-group">
          <input type="text" id="cfg-ra-user" placeholder="Seu usuário no RetroAchievements" value="${appState.config?.raUsername || ''}">
        </div>
      </div>
      <div class="field-row">
        <label>Web API Key RetroAchievements:</label>
        <div class="field-input-group">
          <input type="password" id="cfg-ra-key" placeholder="Sua Web API Key" value="${appState.config?.raWebApiKey || ''}">
        </div>
      </div>
      <div style="margin-top:8px;">
        <button class="play-btn-large" style="max-width:260px;" onclick="saveSettings()">💾 Salvar & Re-escanear Biblioteca</button>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

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

window.syncAllMetadata = async () => {
  showToast('Iniciando busca automática de sinopses e metadados na web...');
  try {
    const res = await fetch('/api/metadata/sync-all', { method: 'POST' });
    const data = await res.json();
    showToast(data.message || 'Sincronização iniciada em segundo plano!');
    setTimeout(fetchState, 3000);
  } catch (e) {
    showToast('Erro ao iniciar sincronização.');
  }
};

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
      raUsername: document.getElementById('cfg-ra-user')?.value || '',
      raWebApiKey: document.getElementById('cfg-ra-key')?.value || '',
      steamGridDbApiKey: document.getElementById('cfg-steamgrid-key')?.value || '',
      consoles: consolesPatch
    })
  });
  if (res.ok) {
    showToast('Configurações salvas e biblioteca sincronizada!');
    await fetchState();
  }
};

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  const vCat = document.getElementById('view-catalogue');
  const vAch = document.getElementById('view-achievements');
  const vSet = document.getElementById('view-settings');
  const azBar = document.getElementById('az-bar');

  vCat.classList.add('hidden');
  vAch.classList.add('hidden');
  vSet.classList.add('hidden');

  if (tab === 'ACHIEVEMENTS') {
    azBar.classList.add('hidden');
    vAch.classList.remove('hidden');
    renderAchievementsView();
  } else if (tab === 'SETTINGS') {
    azBar.classList.add('hidden');
    vSet.classList.remove('hidden');
    renderSettingsView();
  } else {
    azBar.classList.remove('hidden');
    vCat.classList.remove('hidden');
    renderCatalogue(true);
  }
}

// Init Events
document.addEventListener('DOMContentLoaded', () => {
  buildAzBar();
  fetchState();

  setInterval(() => {
    const now = new Date();
    document.getElementById('clock-widget').textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }, 1000);

  // Poll live playtime every 3 seconds
  setInterval(fetchState, 3000);

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });

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

  document.getElementById('btn-quick-scan').onclick = async () => {
    showToast('Escaneando pastas de ROMs...');
    const res = await fetch('/api/scan', { method: 'POST' });
    const data = await res.json();
    await fetchState();
    showToast(`Biblioteca sincronizada: ${data.totalGames} jogos (${data.newGamesCount} novos)!`);
  };

  document.getElementById('btn-stop-game').onclick = async () => {
    await fetch('/api/stop', { method: 'POST' });
    await fetchState();
    showToast('Emulador encerrado.');
  };

  document.getElementById('close-details').onclick = () => {
    selectedGameId = null;
    document.getElementById('details-panel').classList.add('hidden');
    document.getElementById('details-video').pause();
  };

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
    if ((e.ctrlKey && e.key.toLowerCase() === 'f')) {
      e.preventDefault();
      searchInput.focus();
    } else if (e.key === 'Escape') {
      const panel = document.getElementById('details-panel');
      if (!panel.classList.contains('hidden')) {
        panel.classList.add('hidden');
        document.getElementById('details-video').pause();
      }
    }
  });
});
