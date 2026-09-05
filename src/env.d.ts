declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
  }
}

interface ImportMetaEnv {
  // Injected at build time via the `vite.define` block in astro.config.mjs.
  readonly SENTRY_ENVIRONMENT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
