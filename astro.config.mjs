// @ts-check
import process from "node:process";
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";
import sentry from "@sentry/astro";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap(), sentry()],
  vite: {
    plugins: [tailwindcss()],
    define: {
      "import.meta.env.SENTRY_ENVIRONMENT": JSON.stringify(process.env.VERCEL_ENV ?? "development"),
    },
  },
  adapter: vercel(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
      SENTRY_DSN: envField.string({ context: "client", access: "public", optional: true }),
    },
  },
});
