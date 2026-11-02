/**
 * HydraRetro — Native Electron Main Process Entrypoint
 * Provides maximum GPU performance flags, borderless fullscreen window,
 * and integrated background server lifecycle management.
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const http = require('http');
const path = require('path');

// 1. Performance GPU Switches (Must be added before app.whenReady())
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-oop-rasterization');

const PORT = 38475;
const TARGET_URL = `http://127.0.0.1:${PORT}`;

/**
 * Verifica se o backend HTTP do HydraRetro está ouvindo e respondendo na porta designada.
 * @param {number} port Porta do servidor HTTP.
 * @returns {Promise<boolean>}
 */
function isServerReady(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/state`, (res) => {
      resolve(true);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.setTimeout(600, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Aguarda ativamente até que o servidor backend esteja pronto para conexões.
 * @param {number} port Porta do servidor HTTP.
 * @param {number} maxAttempts Tentativas máximas de sondagem.
 * @returns {Promise<boolean>}
 */
async function waitForServer(port, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const ready = await isServerReady(port);
    if (ready) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

let mainWindow = null;
let authWindow = null;

/**
 * Abre a janela modal nativa de autenticação oficial do Hydra Launcher.
 * Intercepta o redirecionamento de protocolo hydralauncher://auth e processa o login.
 */
function openAuthWindow() {
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.focus();
    return;
  }

  const authUrl = 'https://auth.hydra.losbroxas.org/?lng=pt-BR';

  authWindow = new BrowserWindow({
    width: 600,
    height: 640,
    backgroundColor: '#1c1c1c',
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    modal: true,
    show: false,
    maximizable: false,
    resizable: false,
    minimizable: false,
    autoHideMenuBar: true,
    title: 'Hydra — Conectar Conta Oficial',
    webPreferences: {
      sandbox: false,
      nodeIntegrationInSubFrames: true
    }
  });

  authWindow.removeMenu();
  authWindow.loadURL(authUrl);

  authWindow.once('ready-to-show', () => {
    authWindow.show();
    authWindow.focus();
  });

  const handleAuthRedirect = (url) => {
    if (url && url.startsWith('hydralauncher://auth')) {
      if (authWindow && !authWindow.isDestroyed()) {
        authWindow.close();
      }

      // Envia requisição local para o server.js processar o callback de login
      const postData = JSON.stringify({ url });
      const req = http.request({
        hostname: '127.0.0.1',
        port: PORT,
        path: '/api/profile/login-hydra',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            const data = JSON.parse(raw);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('on-profile-updated', data);
              mainWindow.focus();
            }
          } catch (e) {
            console.error('[HydraRetro Electron] Erro ao interpretar resposta de login:', e);
          }
        });
      });

      req.on('error', (err) => {
        console.error('[HydraRetro Electron] Erro ao enviar callback de login:', err.message);
      });
      req.write(postData);
      req.end();
    }
  };

  authWindow.webContents.on('will-navigate', (_event, url) => {
    handleAuthRedirect(url);
  });

  authWindow.webContents.on('will-redirect', (_event, url) => {
    handleAuthRedirect(url);
  });

  authWindow.once('closed', () => {
    authWindow = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
    }
  });
}

ipcMain.handle('open-auth-window', async () => {
  openAuthWindow();
});

/**
 * Cria a janela principal do HydraRetro no Electron com configurações de console fullscreen.
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    frame: false,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#07090e',
    title: 'HydraRetro — Classic Console Hub',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      spellcheck: false
    }
  });

  mainWindow.loadURL(TARGET_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Inicia o backend Node.js embutido se a porta ainda não estiver ativa
  const serverAlreadyRunning = await isServerReady(PORT);

  if (!serverAlreadyRunning) {
    try {
      require('./server.js');
    } catch (err) {
      console.error('[HydraRetro Electron] Erro ao carregar server.js embutido:', err);
    }
  }

  // Aguarda confirmação de que a porta 38475 está pronta
  await waitForServer(PORT);

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Fechamento limpo da aplicação
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
