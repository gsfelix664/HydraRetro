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
  document.getElementById('badge-all').textContent = games.length;
  document.getElementById('badge-fav').textContent = games.filter(g => g.favorite).length;
  document.getElementById('badge-recent').textContent = games.filter(g => g.lastPlayedAt).length;
  document.getElementById('badge-ps1').textContent = games.filter(g => g.consoleId === 'PS1').length;
  document.getElementById('badge-genesis').textContent = games.filter(g => g.consoleId === 'GENESIS').length;

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
  } else if (currentTab === 'PS1' || currentTab === 'GENESIS') {
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
  } else if (sortMode === 'PLAYTIME') {
    list.sort((a, b) => (b.playTimeSeconds || 0) - (a.playTimeSeconds || 0) || a.title.localeCompare(b.title));
  } else if (sortMode === 'RECENT') {
    list.sort((a, b) => new Date(b.lastPlayedAt || 0) - new Date(a.lastPlayedAt || 0) || a.title.localeCompare(b.title));
  }

  return list;
}

function renderCatalogue() {
  const grid = document.getElementById('games-grid');
  const filtered = getFilteredGames();

  const titlesMap = {
    ALL: ['Todos os Jogos', `${filtered.length} jogos prontos para iniciar com 1 clique`],
    FAVORITES: ['⭐ Meus Favoritos', `${filtered.length} clássicos marcados como favoritos`],
    RECENT: ['🕒 Últimos Jogados', `${filtered.length} jogos com histórico recente`],
    PS1: ['PlayStation 1 (DuckStation)', `${filtered.length} jogos em alta definição • Capas Oficiais Hydra`],
    GENESIS: ['Sega Mega Drive (Genesis Plus GX)', `${filtered.length} jogos clássicos 16-bits • Capas Oficiais`]
  };

  const [hTitle, hSub] = titlesMap[currentTab] || ['Catálogo', ''];
  document.getElementById('current-view-title').textContent = hTitle;
  document.getElementById('current-view-subtitle').textContent = hSub;

  grid.innerHTML = '';
  const frag = document.createDocumentFragment();

  for (const game of filtered) {
    const card = document.createElement('div');
    card.className = `game-card ${selectedGameId === game.id ? 'selected' : ''}`;
    card.dataset.id = game.id;

    const artWrap = document.createElement('div');
    artWrap.className = 'card-art-wrap';

    const img = document.createElement('img');
    img.className = 'card-art';
    img.loading = 'lazy';
    img.alt = game.title;
    img.src = game.coverUrl || game.fallbackCoverUrl || '';
    img.onerror = () => {
      if (game.fallbackCoverUrl && img.src !== window.location.origin + game.fallbackCoverUrl) {
        img.src = game.fallbackCoverUrl;
      } else {
        img.style.display = 'none';
      }
    };
    artWrap.appendChild(img);

    const badges = document.createElement('div');
    badges.className = 'card-top-badges';
    badges.innerHTML = `
      <span class="card-console-tag ${game.consoleId}">${game.consoleId === 'GENESIS' ? 'MD' : game.consoleId}</span>
      ${game.favorite ? '<span class="card-fav-star">★</span>' : ''}
    `;
    artWrap.appendChild(badges);

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
        <span>${game.consoleId === 'PS1' ? 'PlayStation' : 'Mega Drive'}</span>
        <span class="${game.playTimeSeconds > 0 ? 'card-playtime' : ''}">${ptText}</span>
      </div>
    `;

    card.appendChild(artWrap);
    card.appendChild(info);

    card.onclick = () => selectGame(game);
    card.ondblclick = () => launchSelectedGame(game.id, 0);

    frag.appendChild(card);
  }

  grid.appendChild(frag);
}

function selectGame(game) {
  selectedGameId = game.id;
  document.querySelectorAll('.game-card').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === game.id);
  });

  const panel = document.getElementById('details-panel');
  panel.classList.remove('hidden');

  const backdrop = document.getElementById('hero-backdrop');
  backdrop.style.backgroundImage = `url("${game.heroUrl || game.coverUrl || game.fallbackCoverUrl || ''}")`;

  const hero = document.getElementById('details-hero');
  hero.style.backgroundImage = `url("${game.heroUrl || game.coverUrl || game.fallbackCoverUrl || ''}")`;

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
    logo.onerror = () => {
      if (game.fallbackLogoUrl && logo.src !== window.location.origin + game.fallbackLogoUrl) {
        logo.src = game.fallbackLogoUrl;
      } else {
        logo.classList.add('hidden');
      }
    };
  } else {
    logo.classList.add('hidden');
  }

  document.getElementById('details-console-badge').textContent = game.consoleId === 'PS1' ? 'PLAYSTATION 1' : 'SEGA MEGA DRIVE';
  document.getElementById('details-size-badge').textContent = formatSize(game.sizeBytes);
  document.getElementById('details-title').textContent = game.title;
  document.getElementById('details-filename').textContent = game.fileName;

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

function updateDetailsLiveStats(game) {
  document.getElementById('details-playtime').textContent = formatPlaytime(game.playTimeSeconds);
  document.getElementById('details-lastplayed').textContent = formatDate(game.lastPlayedAt);
  const favBtn = document.getElementById('btn-fav-toggle');
  favBtn.textContent = game.favorite ? '★' : '☆';

  const achList = document.getElementById('details-ach-list');
  const achs = game.achievements || [];
  const unlockedCount = achs.filter(a => a.unlocked).length;
  document.getElementById('details-ach-Summary').textContent = `${unlockedCount} / ${achs.length} desbloqueadas`;

  achList.innerHTML = achs.map(a => `
    <div class="ach-item ${a.unlocked ? 'unlocked' : ''}">
      <span class="ach-icon">${a.icon}</span>
      <div class="ach-info">
        <div class="ach-title">${a.title}</div>
        <div class="ach-desc">${a.description}</div>
      </div>
      <span class="ach-pts">+${a.points} PTS</span>
    </div>
  `).join('');
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
    renderCatalogue();
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

  window.addEventListener('beforeunload', () => {
    try {
      navigator.sendBeacon('/api/window-closed', '{}');
    } catch {}
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
