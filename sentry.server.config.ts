import * as Sentry from "@sentry/astro";
import { SENTRY_DSN } from "astro:env/client";

Sentry.init({
  dsn: SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? "development",
  tracesSampleRate: 0,
  sendDefaultPii: false,
});
