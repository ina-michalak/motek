import * as Sentry from "@sentry/astro";
// SENTRY_DSN is context: "client" because the DSN is public by design (not a
// secret) — the "client" schema still resolves correctly here on the server.
import { SENTRY_DSN } from "astro:env/client";

Sentry.init({
  dsn: SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? "development",
  tracesSampleRate: 0,
  sendDefaultPii: false,
});
