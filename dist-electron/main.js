import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.DIST = path.join(__dirname$1, "../dist");
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname$1, "../public");
let win;
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "favicon.ico"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.js")
    },
    width: 1200,
    height: 800,
    title: "Amazon Caxias SGO9 - WMS",
    autoHideMenuBar: true
  });
  win.webContents.openDevTools();
  win.webContents.on("did-finish-load", () => {
    console.log("WmsMain: Window finished loading");
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  win.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("WmsMain: Failed to load:", errorCode, errorDescription);
  });
  if (VITE_DEV_SERVER_URL) {
    console.log("WmsMain: Loading URL:", VITE_DEV_SERVER_URL);
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(process.env.DIST, "index.html");
    console.log("WmsMain: Loading File:", indexPath);
    win.loadFile(indexPath);
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
