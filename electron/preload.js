// electron/preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  isElectron: true,
  pickDirectory: () => ipcRenderer.invoke("pick-directory"),
  pickZip: () => ipcRenderer.invoke("pick-zip"),
  getSystemTheme: () => ipcRenderer.invoke("get-theme"),
  openPath: (p) => ipcRenderer.invoke("open-path", p),
});
