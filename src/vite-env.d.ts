/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_APP_NAME: string
  /** 'resend' when the send-message Edge Function has a provider key; 'dryrun' otherwise. */
  readonly VITE_MESSAGE_PROVIDER?: 'resend' | 'dryrun'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
