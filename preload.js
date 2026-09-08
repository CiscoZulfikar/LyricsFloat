const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lyricsFloatAPI', {
  getCurrentState: () => ipcRenderer.invoke('get-current-state'),
  onPlaybackState: (callback) => {
    ipcRenderer.on('playback-state', (_event, value) => callback(value));
  },
  onLyricsLoaded: (callback) => {
    ipcRenderer.on('lyrics-loaded', (_event, value) => callback(value));
  },
  onLyricsTranslationUpdated: (callback) => {
    ipcRenderer.on('lyrics-translation-updated', (_event, value) => callback(value));
  },
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (key, value) => ipcRenderer.invoke('save-config', { key, value }),
  setTargetLanguage: (targetLang) => ipcRenderer.invoke('set-target-language', targetLang),
  setEnabledLanguages: (langs) => ipcRenderer.invoke('set-enabled-languages', langs),

  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('set-always-on-top', flag),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});


