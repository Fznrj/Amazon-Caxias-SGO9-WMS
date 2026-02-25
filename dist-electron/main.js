import { app as n, BrowserWindow as t } from "electron";
import o from "node:path";
import { fileURLToPath as c } from "node:url";
const a = o.dirname(c(import.meta.url));
process.env.DIST = o.join(a, "../dist");
process.env.VITE_PUBLIC = n.isPackaged ? process.env.DIST : o.join(a, "../public");
let e;
const s = process.env.VITE_DEV_SERVER_URL;
function l() {
  if (e = new t({
    icon: o.join(process.env.VITE_PUBLIC, "favicon.ico"),
    webPreferences: {
      preload: o.join(a, "preload.js")
    },
    width: 1200,
    height: 800,
    title: "Amazon Caxias SGO9 - WMS",
    autoHideMenuBar: !0
  }), e.webContents.openDevTools(), e.webContents.on("did-finish-load", () => {
    console.log("WmsMain: Window finished loading"), e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), e.webContents.on("did-fail-load", (i, d, r) => {
    console.error("WmsMain: Failed to load:", d, r);
  }), s)
    console.log("WmsMain: Loading URL:", s), e.loadURL(s);
  else {
    const i = o.join(process.env.DIST, "index.html");
    console.log("WmsMain: Loading File:", i), e.loadFile(i);
  }
}
n.on("window-all-closed", () => {
  process.platform !== "darwin" && (n.quit(), e = null);
});
n.on("activate", () => {
  t.getAllWindows().length === 0 && l();
});
n.whenReady().then(l);
