import * as Sentry from "@sentry/astro";
import { SENTRY_DSN } from "astro:env/client";

Sentry.init({
  dsn: SENTRY_DSN,
  environment: import.meta.env.SENTRY_ENVIRONMENT,
  tracesSampleRate: 0,
  sendDefaultPii: false,
});
