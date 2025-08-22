/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_DEVICE_URL: string
  readonly VITE_DEVICE_DISCOVERY_ENABLED: string
  readonly VITE_WEBSOCKET_RECONNECT_ATTEMPTS: string
  readonly VITE_WEBSOCKET_RECONNECT_DELAY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string;
    VUE_ROUTER_MODE: 'hash' | 'history' | 'abstract' | undefined;
    VUE_ROUTER_BASE: string | undefined;
  }
}
