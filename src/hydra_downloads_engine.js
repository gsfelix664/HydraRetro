const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn, execFile } = require('child_process');

const HYDRA_API_BASE = 'https://hydra-api-us-east-1.losbroxas.org';

const DEFAULT_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'http://tracker.opentrackr.org:1337/announce',
  'udp://open.tracker.cl:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.theoks.net:6969/announce'
];

class HydraDownloadsEngine {
  constructor({ rootDir, dataDir, getDb, saveDb, onDownloadCompleted }) {
    this.rootDir = rootDir;
    this.dataDir = dataDir;
    this.getDb = getDb;
    this.saveDb = saveDb;
    this.onDownloadCompleted = onDownloadCompleted;

    this.nativeDir = path.join(rootDir, 'emulators', 'hydra-native');
    this.sevenZipExe = path.join(this.nativeDir, '7z.exe');
    this.sourcesCachePath = path.join(dataDir, 'download_sources_cache.json');
    this.downloadsStatePath = path.join(dataDir, 'downloads_queue.json');

    this.nativeAddon = null;
    this.torrentInitialized = false;
    this.activeHttpRequest = null;
    this.activeDownloadId = null;

    this.downloads = this.loadDownloadsQueue();
    this.sourcesCache = this.loadSourcesCache();
    this.homeCatalogueCache = {};

    this.initNativeTorrent();
    this.startPollingLoop();
    this.autoResumeOnStartup();
  }

  initNativeTorrent() {
    try {
      const addonPath = path.join(this.nativeDir, 'hydra-native.node');
      if (fs.existsSync(addonPath)) {
        if (!process.env.PATH.includes(this.nativeDir)) {
          process.env.PATH = `${this.nativeDir};${process.env.PATH}`;
        }
        const prevCwd = process.cwd();
        try {
          process.chdir(this.nativeDir);
          this.nativeAddon = require(addonPath);
        } finally {
          try { process.chdir(prevCwd); } catch {}
        }
        console.log('[HydraDownloads] Motor C++ Libtorrent (hydra-native.node) carregado com sucesso.');
      }
    } catch (err) {
      console.warn('[HydraDownloads] Aviso ao carregar hydra-native.node:', err.message);
    }
  }

  async ensureTorrentReady() {
    if (!this.nativeAddon) return false;
    if (this.torrentInitialized) return true;
    try {
      const port = 5881 + Math.floor(Math.random() * 200);
      await this.nativeAddon.torrentInitialize(port);
      this.torrentInitialized = true;
      await this.applySpeedLimit();
      return true;
    } catch (err) {
      console.warn('[HydraDownloads] Falha ao inicializar porta Libtorrent:', err.message);
      return false;
    }
  }

  async torrentCall(method, params = {}) {
    const ready = await this.ensureTorrentReady();
    if (!ready) throw new Error('Motor Libtorrent não disponível');
    const raw = await this.nativeAddon.torrentRequest(method, JSON.stringify(params));
    const parsed = JSON.parse(raw);
    if (parsed && parsed.error) {
      throw new Error(parsed.error.message || parsed.error.code || 'Erro no Libtorrent');
    }
    return parsed ? parsed.result : null;
  }

  loadDownloadsQueue() {
    try {
      if (fs.existsSync(this.downloadsStatePath)) {
        const list = JSON.parse(fs.readFileSync(this.downloadsStatePath, 'utf8'));
        if (Array.isArray(list)) {
          for (const d of list) {
            if (d.status === 'downloading' || d.status === 'checking' || d.status === 'extracting') {
              // Converte downloads ativos interrompidos para fila para retomada suave
              d.status = 'queued';
              d.downloadSpeed = 0;
              d.uploadSpeed = 0;
              d.statusDetail = 'Aguardando inicialização...';
            }
          }
          return list;
        }
      }
    } catch {}
    return [];
  }

  autoResumeOnStartup() {
    setTimeout(async () => {
      try {
        const hasQueued = this.downloads.some(d => d.status === 'queued');
        if (hasQueued) {
          console.log('[HydraDownloads] Retomando downloads pendentes na inicialização...');
          await this.processQueue();
        }
      } catch (err) {
        console.warn('[HydraDownloads] Erro no autoResumeOnStartup:', err.message);
      }
    }, 1500);
  }

  getDownloadsStatusSummary() {
    let globalDownloadSpeedBytes = 0;
    let globalUploadSpeedBytes = 0;
    let activeCount = 0;

    const list = this.downloads.map(item => {
      const isActive = ['downloading', 'checking', 'extracting', 'queued'].includes(item.status);
      if (isActive) {
        activeCount++;
        globalDownloadSpeedBytes += (item.downloadSpeed || 0);
        globalUploadSpeedBytes += (item.uploadSpeed || 0);
      }

      let progressPct = 0;
      if (typeof item.progress === 'number') {
        progressPct = item.progress <= 1 && item.progress > 0 ? item.progress * 100 : item.progress;
      }
      if (item.status === 'completed') {
        progressPct = 100;
      }

      return {
        ...item,
        progress: Math.min(100, Math.max(0, progressPct)),
        downloadSpeedBytes: item.downloadSpeed || 0,
        uploadSpeedBytes: item.uploadSpeed || 0,
        downloadedBytes: item.bytesDownloaded || 0,
        totalBytes: item.fileSize || 0,
        peersCount: item.numPeers || 0,
        seedsCount: item.numSeeds || 0,
        statusDetail: item.statusDetail || (item.status === 'checking' ? 'Obtendo metadados do torrent...' : null)
      };
    });

    return {
      ok: true,
      downloads: list,
      activeCount,
      globalDownloadSpeedBytes,
      globalUploadSpeedBytes
    };
  }

  saveDownloadsQueue() {
    try {
      fs.writeFileSync(this.downloadsStatePath, JSON.stringify(this.downloads, null, 2), 'utf8');
    } catch {}
  }

  loadSourcesCache() {
    try {
      if (fs.existsSync(this.sourcesCachePath)) {
        return JSON.parse(fs.readFileSync(this.sourcesCachePath, 'utf8'));
      }
    } catch {}
    return { sources: [], itemsBySource: {} };
  }

  saveSourcesCache() {
    try {
      fs.writeFileSync(this.sourcesCachePath, JSON.stringify(this.sourcesCache, null, 2), 'utf8');
    } catch {}
  }

  normalizeTitle(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  // ============================================================================
  // 1. DOWNLOAD SOURCES (JSON REPACK SOURCES LIKE HYDRA ORIGINAL)
  // ============================================================================

  getDownloadSources() {
    return this.sourcesCache.sources || [];
  }

  async addDownloadSource(url, customName = '') {
    const cleanUrl = String(url || '').trim();
    if (!cleanUrl) throw new Error('Informe uma URL válida (.json)');

    const existing = (this.sourcesCache.sources || []).find(s => s.url === cleanUrl);
    if (existing) {
      return await this.syncDownloadSource(existing.id);
    }

    // 1. Official Hydra API endpoint POST /download-sources (Identical to Hydra Launcher)
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 15000);
      const apiRes = await fetch(`${HYDRA_API_BASE}/download-sources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Hydra Launcher v3.0.0',
          Accept: 'application/json'
        },
        body: JSON.stringify({ url: cleanUrl }),
        signal: controller.signal
      });
      clearTimeout(t);

      if (apiRes.ok) {
        const hydraSource = await apiRes.json();
        const sourceEntry = {
          id: hydraSource.id || ('src_' + Date.now()),
          hydraApiId: hydraSource.id || null,
          name: hydraSource.name || customName || cleanUrl.split('/').pop().replace(/\.json$/i, '') || 'Fonte Hydra',
          url: cleanUrl,
          fingerprint: hydraSource.fingerprint || '',
          downloadCount: typeof hydraSource.downloadCount === 'number' ? hydraSource.downloadCount : 0,
          status: hydraSource.status || 'MATCHED',
          isRemote: true,
          enabled: true,
          gamesCount: typeof hydraSource.downloadCount === 'number' ? hydraSource.downloadCount : 0,
          addedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString()
        };

        if (!Array.isArray(this.sourcesCache.sources)) this.sourcesCache.sources = [];
        this.sourcesCache.sources.unshift(sourceEntry);
        this.saveSourcesCache();
        return sourceEntry;
      }
    } catch (err) {
      console.warn('[HydraDownloads] Aviso ao adicionar via Hydra API, tentando fallback direto:', err.message);
    }

    // 2. Fallback: Direct JSON download for local / custom sources (e.g. GitHub raw, local servers)
    const id = 'src_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const sourceEntry = {
      id,
      hydraApiId: null,
      name: customName || cleanUrl.split('/').pop().replace(/\.json$/i, '') || 'Fonte Custom',
      url: cleanUrl,
      fingerprint: '',
      downloadCount: 0,
      enabled: true,
      gamesCount: 0,
      status: 'MATCHING',
      addedAt: new Date().toISOString(),
      lastSyncedAt: null
    };

    if (!Array.isArray(this.sourcesCache.sources)) this.sourcesCache.sources = [];
    this.sourcesCache.sources.unshift(sourceEntry);
    this.saveSourcesCache();

    return await this.syncDownloadSource(id);
  }

  async syncDownloadSource(sourceId) {
    const src = (this.sourcesCache.sources || []).find(s => s.id === sourceId || s.hydraApiId === sourceId);
    if (!src) throw new Error('Fonte não encontrada');

    // If source is registered via Hydra API, sync with official Hydra backend
    if (src.hydraApiId || (src.id && src.id.length <= 12 && !src.id.startsWith('src_'))) {
      try {
        const hydraId = src.hydraApiId || src.id;
        const res = await fetch(`${HYDRA_API_BASE}/download-sources/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'Hydra Launcher v3.0.0' },
          body: JSON.stringify({ ids: [hydraId] })
        });
        if (res.ok) {
          const list = await res.json();
          const match = Array.isArray(list) ? list.find(s => s.id === hydraId) : null;
          if (match) {
            src.name = match.name || src.name;
            src.downloadCount = typeof match.downloadCount === 'number' ? match.downloadCount : src.downloadCount;
            src.gamesCount = src.downloadCount;
            src.status = match.status || 'MATCHED';
            src.fingerprint = match.fingerprint || src.fingerprint;
            src.lastSyncedAt = new Date().toISOString();
            this.saveSourcesCache();
            return src;
          }
        }
      } catch (err) {
        console.warn('[HydraDownloads] Falha ao sincronizar via Hydra API:', err.message);
      }
    }

    // Direct JSON sync fallback
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(src.url, {
        headers: { 'User-Agent': 'Hydra Launcher v3.0.0', Accept: 'application/json' },
        signal: controller.signal
      });
      clearTimeout(t);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (json.name && typeof json.name === 'string') {
        src.name = json.name;
      }

      const rawDownloads = Array.isArray(json.downloads)
        ? json.downloads
        : (Array.isArray(json.games) ? json.games : (Array.isArray(json) ? json : []));

      const normalizedItems = [];
      for (const item of rawDownloads) {
        if (!item || !item.title) continue;
        const uris = Array.isArray(item.uris)
          ? item.uris
          : (item.uri ? [item.uri] : (item.magnet ? [item.magnet] : []));
        if (uris.length === 0) continue;
        normalizedItems.push({
          title: String(item.title),
          normTitle: this.normalizeTitle(item.title),
          uris: uris.map(u => (typeof u === 'string' ? u : u?.uri || u?.url || '')).filter(Boolean),
          uriGroups: item.uriGroups || [],
          fileSize: item.fileSize || item.size || 'N/D',
          uploadDate: item.uploadDate || item.date || null,
          sourceName: src.name,
          sourceId: src.id
        });
      }

      if (!this.sourcesCache.itemsBySource) this.sourcesCache.itemsBySource = {};
      this.sourcesCache.itemsBySource[src.id] = normalizedItems;

      src.gamesCount = normalizedItems.length;
      src.downloadCount = normalizedItems.length;
      src.status = 'MATCHED';
      src.lastSyncedAt = new Date().toISOString();
      this.saveSourcesCache();
      return src;
    } catch (err) {
      src.status = 'FAILED';
      src.lastError = err.message;
      this.saveSourcesCache();
      throw new Error(`Falha ao sincronizar fonte "${src.name}": ${err.message}`);
    }
  }

  async syncAllDownloadSources() {
    const hydraIds = (this.sourcesCache.sources || [])
      .filter(s => s.hydraApiId || (s.id && s.id.length <= 12 && !s.id.startsWith('src_')))
      .map(s => s.hydraApiId || s.id);

    if (hydraIds.length > 0) {
      try {
        const res = await fetch(`${HYDRA_API_BASE}/download-sources/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'Hydra Launcher v3.0.0' },
          body: JSON.stringify({ ids: hydraIds })
        });
        if (res.ok) {
          const list = await res.json();
          if (Array.isArray(list)) {
            for (const item of list) {
              const src = this.sourcesCache.sources.find(s => (s.hydraApiId || s.id) === item.id);
              if (src) {
                src.name = item.name || src.name;
                src.downloadCount = typeof item.downloadCount === 'number' ? item.downloadCount : src.downloadCount;
                src.gamesCount = src.downloadCount;
                src.status = item.status || 'MATCHED';
                src.fingerprint = item.fingerprint || src.fingerprint;
                src.lastSyncedAt = new Date().toISOString();
              }
            }
            this.saveSourcesCache();
          }
        }
      } catch (e) {
        console.warn('[HydraDownloads] Erro em syncAllDownloadSources via API:', e.message);
      }
    }

    // Direct JSON sync for any local/custom sources
    for (const src of (this.sourcesCache.sources || [])) {
      if (!src.hydraApiId && (src.id.startsWith('src_') || src.id.length > 12)) {
        try {
          await this.syncDownloadSource(src.id);
        } catch {}
      }
    }

    return this.sourcesCache.sources || [];
  }

  removeDownloadSource(sourceId) {
    this.sourcesCache.sources = (this.sourcesCache.sources || []).filter(s => s.id !== sourceId && s.url !== sourceId && s.hydraApiId !== sourceId);
    if (this.sourcesCache.itemsBySource) {
      delete this.sourcesCache.itemsBySource[sourceId];
    }
    this.saveSourcesCache();
  }

  removeAllDownloadSources() {
    this.sourcesCache.sources = [];
    this.sourcesCache.itemsBySource = {};
    this.saveSourcesCache();
    return true;
  }

  toggleDownloadSource(sourceId, enabled) {
    const src = (this.sourcesCache.sources || []).find(s => s.id === sourceId || s.hydraApiId === sourceId);
    if (src) {
      src.enabled = Boolean(enabled);
      this.saveSourcesCache();
    }
    return src;
  }

  async searchRepacksForGame(gameTitle, options = {}) {
    const objectId = options.objectId || '';
    const shop = options.shop || 'steam';
    const repacks = [];

    // 1. Query official Hydra API download-sources endpoint with active source IDs
    const activeSources = (this.sourcesCache.sources || []).filter(s => s.enabled !== false);
    const apiSourceIds = activeSources
      .map(s => s.hydraApiId || s.id)
      .filter(id => id && id.length <= 12 && !id.startsWith('src_'));

    if (objectId && apiSourceIds.length > 0) {
      try {
        const queryParams = apiSourceIds.map(id => `downloadSourceIds[]=${encodeURIComponent(id)}`).join('&');
        const url = `${HYDRA_API_BASE}/games/${shop}/${objectId}/download-sources?${queryParams}&take=100&skip=0`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Hydra Launcher v3.0.0', Accept: 'application/json' }
        });
        if (res.ok) {
          const apiRepacks = await res.json();
          if (Array.isArray(apiRepacks)) {
            for (const r of apiRepacks) {
              repacks.push({
                id: r.id || ('rep_' + Math.random().toString(36).slice(2, 8)),
                title: r.title,
                fileSize: (r.fileSize || '').trim() || 'N/D',
                uris: r.uris || [],
                uriGroups: r.uriGroups || [],
                uploadDate: r.uploadDate || null,
                sourceName: r.downloadSourceName || 'Hydra Official Source',
                sourceId: r.downloadSourceId || ''
              });
            }
          }
        }
      } catch (err) {
        console.warn('[HydraDownloads] Falha ao buscar repacks na Hydra API:', err.message);
      }
    }

    // 2. Also search local itemsBySource for any custom parsed sources
    const qNorm = this.normalizeTitle(gameTitle);
    if (qNorm) {
      const words = qNorm.split(' ').filter(w => w.length >= 2);
      for (const src of activeSources) {
        const items = this.sourcesCache.itemsBySource?.[src.id] || [];
        for (const item of items) {
          if (!item.normTitle) continue;
          if (item.normTitle.includes(qNorm) || qNorm.includes(item.normTitle) || (words.length >= 2 && words.every(w => item.normTitle.includes(w)))) {
            if (!repacks.some(r => r.title === item.title)) {
              repacks.push(item);
            }
          }
        }
      }
    }

    return repacks;
  }

  // ============================================================================
  // 2. DOWNLOAD & TORRENT QUEUE MANAGER
  // ============================================================================

  getDefaultDownloadPath() {
    const db = this.getDb();
    const configured = db?.config?.downloadSettings?.downloadPath;
    if (configured) {
      try { fs.mkdirSync(configured, { recursive: true }); } catch {}
      return configured;
    }
    const fallback = path.join(this.rootDir, 'Downloads');
    try { fs.mkdirSync(fallback, { recursive: true }); } catch {}
    return fallback;
  }

  async applySpeedLimit() {
    const db = this.getDb();
    const limitKBps = Number(db?.config?.downloadSettings?.maxDownloadSpeedKBps || 0);
    const bytesPerSec = limitKBps > 0 ? limitKBps * 1024 : 0;
    if (this.torrentInitialized) {
      await this.torrentCall('action', {
        action: 'set_download_limit',
        max_download_speed_bytes_per_second: bytesPerSec
      }).catch(() => {});
    }
  }

  async startDownload({ title, uri, uris, torrentBase64, torrentFileName, consoleId = 'PC', coverUrl = '', savePath = '', shop = 'steam', objectId = '' }) {
    let cleanUri = String(uri || (Array.isArray(uris) ? uris[0] : '')).trim();

    if (torrentBase64) {
      try {
        const torrentsDir = path.join(this.rootDir, 'data', 'torrents');
        fs.mkdirSync(torrentsDir, { recursive: true });
        const safeName = (torrentFileName || `download_${Date.now()}.torrent`).replace(/[^a-zA-Z0-9._-]/g, '_');
        const torrentFilePath = path.join(torrentsDir, safeName);
        const buf = Buffer.from(torrentBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
        fs.writeFileSync(torrentFilePath, buf);
        cleanUri = torrentFilePath;
      } catch (err) {
        console.error('[HydraDownloads] Erro ao salvar arquivo .torrent:', err);
      }
    }

    if (!cleanUri) throw new Error('Link magnet ou arquivo .torrent não fornecido');

    const targetDir = savePath && savePath.trim() ? savePath.trim() : this.getDefaultDownloadPath();
    try { fs.mkdirSync(targetDir, { recursive: true }); } catch {}

    const isTorrent =
      cleanUri.startsWith('magnet:') ||
      cleanUri.toLowerCase().endsWith('.torrent') ||
      fs.existsSync(cleanUri);

    // Se o mesmo download já estiver na fila, retoma se estiver pausado ou retorna existente
    const existing = this.downloads.find(d => d.uri === cleanUri);
    if (existing) {
      if (existing.status === 'paused' || existing.status === 'error') {
        await this.resumeDownload(existing.id);
      }
      return existing;
    }

    const id = 'dl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const entry = {
      id,
      title: title || 'Download HydraRetro',
      uri: cleanUri,
      downloader: isTorrent ? 'torrent' : 'http',
      consoleId: consoleId || 'PC',
      shop: shop || 'steam',
      objectId: objectId || '',
      coverUrl: coverUrl || '',
      savePath: targetDir,
      folderName: '',
      status: 'queued', // queued, checking, downloading, seeding, extracting, completed, paused, error
      statusDetail: 'Na fila...',
      progress: 0,
      bytesDownloaded: 0,
      fileSize: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      numPeers: 0,
      numSeeds: 0,
      etaSeconds: -1,
      createdAt: new Date().toISOString(),
      completedAt: null,
      error: null
    };

    this.downloads.unshift(entry);
    this.saveDownloadsQueue();
    await this.processQueue();
    return entry;
  }

  async processQueue() {
    if (this.activeDownloadId) {
      const current = this.downloads.find(d => d.id === this.activeDownloadId);
      if (current && (current.status === 'downloading' || current.status === 'checking' || current.status === 'extracting')) {
        return;
      }
      this.activeDownloadId = null;
    }

    const next = this.downloads.find(d => d.status === 'queued');
    if (!next) return;

    this.activeDownloadId = next.id;
    next.status = 'checking';
    next.statusDetail = next.downloader === 'torrent' ? 'Conectando aos trackers e obtendo metadados...' : 'Iniciando download...';
    next.error = null;
    this.saveDownloadsQueue();

    if (next.downloader === 'torrent') {
      try {
        await this.ensureTorrentReady();
        await this.applySpeedLimit();
        await this.torrentCall('action', {
          action: 'start',
          game_id: next.id,
          url: next.uri,
          save_path: next.savePath,
          trackers: DEFAULT_TRACKERS
        });
        this.saveDownloadsQueue();
      } catch (err) {
        console.error('[HydraDownloads] Falha ao iniciar torrent:', err.message);
        next.status = 'error';
        next.error = err.message;
        next.statusDetail = `Erro: ${err.message}`;
        this.activeDownloadId = null;
        this.saveDownloadsQueue();
        setTimeout(() => this.processQueue(), 1000);
      }
    } else {
      this.startHttpDirectDownload(next);
    }
  }

  startHttpDirectDownload(item) {
    try {
      const parsedUrl = new URL(item.uri);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      const rawName = decodeURIComponent(path.basename(parsedUrl.pathname) || '') || `${item.title.replace(/[<>:"/\\|?*]/g, '_')}.zip`;
      const destFile = path.join(item.savePath, rawName);
      item.folderName = rawName;
      item.status = 'downloading';

      const fileStream = fs.createWriteStream(destFile);
      let downloaded = 0;
      let lastTickTime = Date.now();
      let lastTickBytes = 0;

      const req = client.get(item.uri, { headers: { 'User-Agent': 'HydraLauncher/3.0' } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          fileStream.close();
          item.uri = new URL(res.headers.location, item.uri).toString();
          this.startHttpDirectDownload(item);
          return;
        }
        if (res.statusCode !== 200 && res.statusCode !== 206) {
          fileStream.close();
          item.status = 'error';
          item.error = `HTTP ${res.statusCode}`;
          this.activeDownloadId = null;
          this.saveDownloadsQueue();
          this.processQueue();
          return;
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        if (total > 0) item.fileSize = total;

        res.on('data', (chunk) => {
          downloaded += chunk.length;
          item.bytesDownloaded = downloaded;
          if (item.fileSize > 0) {
            item.progress = Math.min(0.999, downloaded / item.fileSize);
          }
          const now = Date.now();
          const elapsedSec = (now - lastTickTime) / 1000;
          if (elapsedSec >= 0.8) {
            item.downloadSpeed = Math.round((downloaded - lastTickBytes) / elapsedSec);
            if (item.fileSize > downloaded && item.downloadSpeed > 0) {
              item.etaSeconds = Math.round((item.fileSize - downloaded) / item.downloadSpeed);
            }
            lastTickTime = now;
            lastTickBytes = downloaded;
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(async () => {
            this.activeHttpRequest = null;
            await this.finalizeCompletedDownload(item);
          });
        });
      });

      this.activeHttpRequest = req;
      req.on('error', (err) => {
        try { fileStream.close(); } catch {}
        this.activeHttpRequest = null;
        if (item.status !== 'paused' && item.status !== 'cancelled') {
          item.status = 'error';
          item.error = err.message;
          this.activeDownloadId = null;
          this.saveDownloadsQueue();
          this.processQueue();
        }
      });
    } catch (err) {
      item.status = 'error';
      item.error = err.message;
      this.activeDownloadId = null;
      this.saveDownloadsQueue();
      this.processQueue();
    }
  }

  startPollingLoop() {
    let saveTick = 0;
    setInterval(async () => {
      if (!this.activeDownloadId || !this.torrentInitialized) return;
      const item = this.downloads.find(d => d.id === this.activeDownloadId);
      if (!item || item.downloader !== 'torrent') return;

      try {
        const st = await this.torrentCall('status');
        if (!st) return;

        item.progress = typeof st.progress === 'number' ? st.progress : item.progress;
        item.numPeers = st.numPeers || 0;
        item.numSeeds = st.numSeeds || 0;
        item.downloadSpeed = st.downloadSpeed || 0;
        item.uploadSpeed = st.uploadSpeed || 0;
        item.bytesDownloaded = st.bytesDownloaded || item.bytesDownloaded;
        if (st.fileSize > 0) item.fileSize = st.fileSize;
        if (st.folderName) item.folderName = st.folderName;

        if (item.fileSize > item.bytesDownloaded && item.downloadSpeed > 0) {
          item.etaSeconds = Math.round((item.fileSize - item.bytesDownloaded) / item.downloadSpeed);
        } else {
          item.etaSeconds = -1;
        }

        // LibtorrentStatus: 1=CheckingFiles, 2=DownloadingMetadata, 3=Downloading, 4=Finished, 5=Seeding, 7=CheckingResumeData
        if (st.status === 1 || st.status === 7) {
          item.status = 'checking';
          item.statusDetail = 'Verificando integridade dos arquivos...';
        } else if (st.status === 2) {
          item.status = 'checking';
          item.statusDetail = 'Obtendo metadados do torrent...';
        } else if (st.status === 3) {
          item.status = 'downloading';
          item.statusDetail = null;
        }

        if (st.status === 4 || st.status === 5 || (st.progress >= 1 && item.fileSize > 0)) {
          await this.finalizeCompletedDownload(item);
        } else {
          saveTick++;
          if (saveTick >= 5) {
            saveTick = 0;
            this.saveDownloadsQueue();
          }
        }
      } catch {}
    }, 1000);
  }

  async finalizeCompletedDownload(item) {
    if (item.status === 'completed' || item.status === 'seeding' || item.status === 'extracting') return;

    const db = this.getDb();
    const dlCfg = db?.config?.downloadSettings || {};

    item.progress = 1;
    item.downloadSpeed = 0;
    item.etaSeconds = 0;

    const targetPath = item.folderName ? path.join(item.savePath, item.folderName) : item.savePath;

    // 1. Auto-extract archives (.zip, .7z, .rar) if enabled
    if (dlCfg.extractByDefault !== false && fs.existsSync(targetPath)) {
      const archiveFiles = [];
      try {
        const stat = fs.statSync(targetPath);
        if (stat.isFile() && /\.(zip|7z|rar)$/i.test(targetPath)) {
          archiveFiles.push(targetPath);
        } else if (stat.isDirectory()) {
          const entries = fs.readdirSync(targetPath);
          for (const e of entries) {
            if (/\.(zip|7z|rar)$/i.test(e)) {
              archiveFiles.push(path.join(targetPath, e));
            }
          }
        }
      } catch {}

      if (archiveFiles.length > 0 && fs.existsSync(this.sevenZipExe)) {
        item.status = 'extracting';
        this.saveDownloadsQueue();

        for (const arch of archiveFiles) {
          const outDir = path.dirname(arch);
          await new Promise((resolve) => {
            execFile(this.sevenZipExe, ['x', arch, `-o${outDir}`, '-y'], { windowsHide: true }, (err) => {
              if (!err && dlCfg.deleteAfterExtract) {
                try { fs.unlinkSync(arch); } catch {}
              }
              resolve();
            });
          });
        }
      }
    }

    // 2. Keep Seeding or Stop Seeding for Torrents
    if (item.downloader === 'torrent') {
      if (dlCfg.seedAfterDownload) {
        item.status = 'seeding';
      } else {
        await this.torrentCall('action', { action: 'pause_seeding', game_id: item.id }).catch(() => {});
        await this.torrentCall('action', { action: 'cancel', game_id: item.id }).catch(() => {});
        item.status = 'completed';
      }
    } else {
      item.status = 'completed';
    }

    item.completedAt = new Date().toISOString();
    this.activeDownloadId = null;
    this.saveDownloadsQueue();

    if (typeof this.onDownloadCompleted === 'function') {
      try {
        await this.onDownloadCompleted(item, targetPath);
      } catch {}
    }

    this.processQueue();
  }

  async pauseDownload(downloadId) {
    if (!downloadId) return null;
    const item = this.downloads.find(d => d.id === downloadId);
    if (!item) return null;

    if (item.downloader === 'torrent' && this.torrentInitialized) {
      if (item.status === 'seeding') {
        await this.torrentCall('action', { action: 'pause_seeding', game_id: item.id }).catch(() => {});
        item.status = 'completed';
        item.statusDetail = 'Concluído';
      } else {
        await this.torrentCall('action', { action: 'pause', game_id: item.id }).catch(() => {});
        item.status = 'paused';
        item.statusDetail = 'Download pausado';
      }
    } else if (this.activeHttpRequest && this.activeDownloadId === downloadId) {
      try { this.activeHttpRequest.destroy(); } catch {}
      this.activeHttpRequest = null;
      item.status = 'paused';
      item.statusDetail = 'Download pausado';
    } else {
      item.status = 'paused';
      item.statusDetail = 'Download pausado';
    }

    item.downloadSpeed = 0;
    item.uploadSpeed = 0;
    if (this.activeDownloadId === downloadId) {
      this.activeDownloadId = null;
    }
    this.saveDownloadsQueue();
    this.processQueue();
    return item;
  }

  async resumeDownload(downloadId) {
    if (!downloadId) return null;
    const item = this.downloads.find(d => d.id === downloadId);
    if (!item) return null;

    if (item.status === 'completed' && item.downloader === 'torrent') {
      await this.ensureTorrentReady();
      await this.torrentCall('action', {
        action: 'resume_seeding',
        game_id: item.id,
        url: item.uri,
        save_path: item.savePath,
        trackers: DEFAULT_TRACKERS
      }).catch(() => {});
      item.status = 'seeding';
      item.statusDetail = 'Semeando (Seed)';
      this.saveDownloadsQueue();
      return item;
    }

    item.status = 'queued';
    item.statusDetail = 'Na fila...';
    item.error = null;
    this.saveDownloadsQueue();
    await this.processQueue();
    return item;
  }

  async cancelDownload(downloadId, deleteFiles = false) {
    if (!downloadId) return false;
    const item = this.downloads.find(d => d.id === downloadId);
    if (!item) return false;

    if (item.downloader === 'torrent' && this.torrentInitialized) {
      await this.torrentCall('action', { action: 'cancel', game_id: item.id }).catch(() => {});
    } else if (this.activeHttpRequest && this.activeDownloadId === downloadId) {
      try { this.activeHttpRequest.destroy(); } catch {}
      this.activeHttpRequest = null;
    }

    if (this.activeDownloadId === downloadId) {
      this.activeDownloadId = null;
    }

    if (deleteFiles && item.folderName) {
      const target = path.join(item.savePath, item.folderName);
      try {
        if (fs.existsSync(target)) {
          fs.rmSync(target, { recursive: true, force: true });
        }
      } catch {}
    }

    this.downloads = this.downloads.filter(d => d.id !== downloadId);
    this.saveDownloadsQueue();
    this.processQueue();
    return true;
  }

  openDownloadFolder(downloadId) {
    let target = this.getDefaultDownloadPath();
    if (downloadId) {
      const item = this.downloads.find(d => d.id === downloadId);
      if (item) {
        if (item.folderName) {
          const itemPath = path.join(item.savePath, item.folderName);
          if (fs.existsSync(itemPath)) {
            target = itemPath;
          } else if (fs.existsSync(item.savePath)) {
            target = item.savePath;
          }
        } else if (item.savePath && fs.existsSync(item.savePath)) {
          target = item.savePath;
        }
      }
    }
    try {
      spawn('explorer.exe', [target], { detached: true, stdio: 'ignore' }).unref();
    } catch {}
    return target;
  }

  // ============================================================================
  // 3. HYDRA HOME & STORE CATALOGUE (HOT NOW, WEEKLY, GAMES TO BEAT, SEARCH)
  // ============================================================================

  async fetchHomeCatalogue(category = 'hot', options = {}) {
    const validCategories = ['hot', 'weekly', 'achievements', 'featured', 'all', 'catalogue'];
    const cat = validCategories.includes(category) ? category : 'hot';

    if (cat === 'all' || cat === 'catalogue') {
      return await this.searchStoreCatalogue('', options);
    }

    const cached = this.homeCatalogueCache[cat];
    if (cached && Date.now() - cached.at < 5 * 60 * 1000) {
      const items = this.enrichStoreItemsWithLocalState(cached.items);
      return { count: items.length, items };
    }

    try {
      const url = cat === 'featured'
        ? `${HYDRA_API_BASE}/catalogue/featured`
        : `${HYDRA_API_BASE}/catalogue/${cat}?take=18&skip=0`;

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        headers: { 'User-Agent': 'HydraLauncher/3.0', Accept: 'application/json' },
        signal: controller.signal
      });
      clearTimeout(t);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);

      const items = list.map(entry => {
        const objectId = String(entry.objectId || entry.id || '');
        const shop = entry.shop || 'steam';
        const coverUrl =
          entry.coverImageUrl ||
          entry.libraryImageUrl ||
          (shop === 'steam' && objectId
            ? `https://shared.steamstatic.com/store_item_assets/steam/apps/${objectId}/library_600x900.jpg`
            : '');
        const heroUrl =
          entry.libraryHeroImageUrl ||
          entry.backgroundImageUrl ||
          (shop === 'steam' && objectId
            ? `https://shared.steamstatic.com/store_item_assets/steam/apps/${objectId}/library_hero.jpg`
            : coverUrl);

        return {
          objectId,
          shop,
          title: entry.title || 'Jogo Hydra',
          coverUrl,
          heroUrl,
          logoUrl: entry.logoImageUrl || null,
          genres: entry.genres || [],
          publisher: entry.publisher || '',
          developer: entry.developer || '',
          releaseYear: entry.releaseDate ? new Date(entry.releaseDate).getFullYear() : null,
          rating: entry.rating || null
        };
      });

      this.homeCatalogueCache[cat] = { at: Date.now(), items };
      const enriched = this.enrichStoreItemsWithLocalState(items);
      return { count: enriched.length, items: enriched };
    } catch (err) {
      console.warn(`[HydraHome] Falha ao buscar /catalogue/${cat}:`, err.message);
      return { count: 0, items: [] };
    }
  }

  async searchStoreCatalogue(query, options = {}) {
    const q = String(query || '').trim();
    const take = Math.max(5, Math.min(100, parseInt(options.take || '30', 10)));
    const skip = Math.max(0, parseInt(options.skip !== undefined ? options.skip : (parseInt(options.page || '0', 10) * take), 10));
    const payload = {
      title: q,
      take,
      skip
    };
    if (options.genre && options.genre !== 'all') {
      payload.genres = [options.genre];
    } else if (Array.isArray(options.genres) && options.genres.length > 0) {
      payload.genres = options.genres;
    }
    if (options.order) {
      payload.order = options.order;
    }

    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${HYDRA_API_BASE}/catalogue/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'HydraLauncher/3.0',
          Accept: 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(t);

      if (!res.ok) return { count: 0, items: [] };
      const data = await res.json();
      const list = Array.isArray(data) ? data : (Array.isArray(data?.edges) ? data.edges : []);
      const count = typeof data?.count === 'number' ? data.count : list.length;

      const items = list.map(entry => {
        const objectId = String(entry.objectId || entry.id || '');
        const shop = entry.shop || 'steam';
        return {
          objectId,
          shop,
          title: entry.title || '',
          coverUrl:
            entry.coverImageUrl ||
            entry.libraryImageUrl ||
            (shop === 'steam' && objectId
              ? `https://shared.steamstatic.com/store_item_assets/steam/apps/${objectId}/library_600x900.jpg`
              : ''),
          heroUrl:
            entry.libraryHeroImageUrl ||
            (shop === 'steam' && objectId
              ? `https://shared.steamstatic.com/store_item_assets/steam/apps/${objectId}/library_hero.jpg`
              : ''),
          logoUrl: entry.logoImageUrl || null,
          genres: entry.genres || [],
          releaseYear: entry.releaseDate ? new Date(entry.releaseDate).getFullYear() : null,
          rating: entry.rating || null
        };
      });

      return { count, items: this.enrichStoreItemsWithLocalState(items) };
    } catch (e) {
      console.warn('[HydraStore] Falha em searchStoreCatalogue:', e.message);
      return { count: 0, items: [] };
    }
  }

  enrichStoreItemsWithLocalState(items) {
    const db = this.getDb();
    const games = Object.values(db?.games || {});
    return items.map(item => {
      const normItem = this.normalizeTitle(item.title);
      const localMatch = games.find(g =>
        (item.objectId && (String(g.steamAppId) === String(item.objectId) || String(g.hydraObjectId) === String(item.objectId))) ||
        this.normalizeTitle(g.title) === normItem
      );
      const repacks = this.searchRepacksForGame(item.title);
      return {
        ...item,
        inLibrary: Boolean(localMatch),
        localGameId: localMatch ? localMatch.id : null,
        installed: localMatch ? Boolean(localMatch.installed !== false) : false,
        repacksCount: repacks.length
      };
    });
  }

  // ============================================================================
  // 4. GOG GALAXY & XBOX / PC GAME PASS SCANNERS + WINDOWS STARTUP REGISTRY
  // ============================================================================

  async scanGogAndXboxGames() {
    const discovered = [];

    // 1. Scan GOG Galaxy installed games via Windows Registry
    await new Promise((resolve) => {
      const psScript = `
        $ErrorActionPreference = 'SilentlyContinue'
        $gogPath = 'HKLM:\\SOFTWARE\\WOW6432Node\\GOG.com\\Games'
        if (Test-Path $gogPath) {
          Get-ChildItem $gogPath | ForEach-Object {
            $p = Get-ItemProperty $_.PSPath
            if ($p.gameName -and $p.exe -and (Test-Path $p.exe)) {
              Write-Output ("GOG|" + $p.gameID + "|" + $p.gameName + "|" + $p.exe + "|" + $p.path)
            }
          }
        }
      `;
      execFile('powershell.exe', ['-NoProfile', '-Command', psScript], { windowsHide: true }, (err, stdout) => {
        if (!err && stdout) {
          const lines = String(stdout).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          for (const line of lines) {
            const parts = line.split('|');
            if (parts[0] === 'GOG' && parts.length >= 4) {
              discovered.push({
                store: 'GOG',
                id: parts[1],
                title: parts[2],
                exePath: parts[3],
                installDir: parts[4] || path.dirname(parts[3])
              });
            }
          }
        }
        resolve();
      });
    });

    // 2. Scan Xbox / PC Game Pass folders across all Windows drives (C: to Z:) and custom folders
    const driveLetters = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];
    const xboxRoots = [];

    for (const letter of driveLetters) {
      const rootPath = `${letter}:\\XboxGames`;
      if (fs.existsSync(rootPath)) {
        xboxRoots.push(rootPath);
      }
    }

    // Include custom xbox folders if configured
    const customXbox = (this.config?.customXboxFolders || []);
    for (const cFolder of customXbox) {
      if (fs.existsSync(cFolder) && !xboxRoots.includes(cFolder)) {
        xboxRoots.push(cFolder);
      }
    }

    for (const xRoot of xboxRoots) {
      let dirs = [];
      try {
        dirs = fs.readdirSync(xRoot, { withFileTypes: true }).filter(d => d.isDirectory());
      } catch { continue; }

      for (const d of dirs) {
        if (d.name.toLowerCase() === 'gamesave') continue;

        const gameFolder = path.join(xRoot, d.name);
        const contentFolder = fs.existsSync(path.join(gameFolder, 'Content'))
          ? path.join(gameFolder, 'Content')
          : gameFolder;

        let cfgPath = null;
        for (const name of ['MicrosoftGame.Config', 'MicrosoftGame.config', 'microsoftgame.config']) {
          const testP = path.join(contentFolder, name);
          if (fs.existsSync(testP)) { cfgPath = testP; break; }
        }

        let title = d.name.replace(/\s*-\s*The Last Crusade.*/i, '').trim();
        let exePath = null;
        let coverPath = null;
        let heroPath = null;

        if (cfgPath) {
          try {
            const xml = fs.readFileSync(cfgPath, 'utf8');
            const dNameMatch = xml.match(/DefaultDisplayName="([^"]+)"/i) ||
                               xml.match(/OverrideDisplayName="([^"]+)"/i) ||
                               xml.match(/<DisplayName>([^<]+)<\/DisplayName>/i);
            if (dNameMatch && dNameMatch[1] && !dNameMatch[1].startsWith('ms-resource:')) {
              title = dNameMatch[1];
            }

            const storeLogo = xml.match(/StoreLogo="([^"]+)"/i) ||
                              xml.match(/Square150x150Logo="([^"]+)"/i);
            if (storeLogo && storeLogo[1]) {
              const cPath = path.join(contentFolder, storeLogo[1]);
              if (fs.existsSync(cPath)) coverPath = cPath;
            }

            const splashImg = xml.match(/SplashScreenImage="([^"]+)"/i);
            if (splashImg && splashImg[1]) {
              const hPath = path.join(contentFolder, splashImg[1]);
              if (fs.existsSync(hPath)) heroPath = hPath;
            }

            const exeMatch = xml.match(/<Executable\s+[^>]*Name="([^"]+\.exe)"/i);
            if (exeMatch && exeMatch[1]) {
              const candidate = path.join(contentFolder, exeMatch[1]);
              if (fs.existsSync(candidate)) exePath = candidate;
            }
          } catch {}
        }

        const helperExe = path.join(contentFolder, 'gamelaunchhelper.exe');
        if (fs.existsSync(helperExe)) {
          exePath = helperExe;
        }

        if (!exePath) {
          try {
            const exes = fs.readdirSync(contentFolder).filter(f => f.toLowerCase().endsWith('.exe') && !/crash|unins/i.test(f));
            if (exes.length > 0) exePath = path.join(contentFolder, exes[0]);
          } catch {}
        }

        if (exePath && fs.existsSync(exePath)) {
          discovered.push({
            store: 'XBOX',
            id: d.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            title,
            exePath,
            coverPath,
            heroPath,
            installDir: contentFolder
          });
        }
      }
    }

    return discovered;
  }

  async setWindowsAutoLaunch(enabled, launchMinimized = false) {
    const exePath = path.join(this.rootDir, 'HydraRetro.exe');
    const cmdVal = launchMinimized ? `"${exePath}" --minimized` : `"${exePath}"`;

    return new Promise((resolve) => {
      const ps = enabled
        ? `Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'HydraRetro' -Value '${cmdVal.replace(/'/g, "''")}'`
        : `Remove-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'HydraRetro' -ErrorAction SilentlyContinue`;
      execFile('powershell.exe', ['-NoProfile', '-Command', ps], { windowsHide: true }, () => resolve(true));
    });
  }
}

module.exports = { HydraDownloadsEngine };
