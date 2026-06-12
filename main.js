const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true, // Hide the top menu for a cleaner look
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: "File Organizer",
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // Load the local index.html file
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend() {
  // Start the Spring Boot server
  backendProcess = spawn('java', ['-jar', path.join(__dirname, 'backend-java.jar')], {
    stdio: 'inherit'
  });

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend:', err);
  });

  backendProcess.on('exit', (code, signal) => {
    if (!isQuitting) {
      console.warn(`Backend process exited unexpectedly (code ${code}, signal ${signal}). Restarting backend server...`);
      setTimeout(() => {
        if (!isQuitting) {
          startBackend();
        }
      }, 1000);
    }
  });
}

app.on('ready', () => {
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev) {
    startBackend();
  }
  createWindow();
});

app.on('window-all-closed', () => {
  isQuitting = true;
  // Kill the backend process when the app closes
  if (backendProcess) backendProcess.kill();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Listener for Folder Selection
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (result.canceled) {
    return null;
  } else {
    return result.filePaths[0];
  }
});
