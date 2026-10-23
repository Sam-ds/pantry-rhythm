/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OFF_SEARCH_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
