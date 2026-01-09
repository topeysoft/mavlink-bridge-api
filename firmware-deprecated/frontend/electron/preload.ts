import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const electronAPI = {
    ping: () => ipcRenderer.invoke('ping'),

    // Platform detection
    platform: process.platform,

    // App version
    getVersion: () => process.env.npm_package_version || '1.0.0'
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electronAPI', electronAPI)
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore (define in dts)
    window.electronAPI = electronAPI
}
