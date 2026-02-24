import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ └── main.js
// │

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public');


let win: BrowserWindow | null;
// ⚡️ Serving local development server
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
        width: 1200,
        height: 800,
        title: 'Amazon Caxias SGO9 - WMS',
        autoHideMenuBar: true,
    });

    // Open DevTools for debugging
    win.webContents.openDevTools();

    // Test actively push message to the Electron-Renderer
    win.webContents.on('did-finish-load', () => {
        console.log('WmsMain: Window finished loading');
        win?.webContents.send('main-process-message', (new Date()).toLocaleString());
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('WmsMain: Failed to load:', errorCode, errorDescription);
    });

    if (VITE_DEV_SERVER_URL) {
        console.log('WmsMain: Loading URL:', VITE_DEV_SERVER_URL);
        win.loadURL(VITE_DEV_SERVER_URL);
    } else {
        const indexPath = path.join(process.env.DIST, 'index.html');
        console.log('WmsMain: Loading File:', indexPath);
        win.loadFile(indexPath);
    }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
        win = null;
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.whenReady().then(createWindow);
