import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";
// @sentry/astro only auto-injects sentry.server.config into Astro *page* SSR bundles
// (astro's isPage() excludes .ts endpoints), so a request that hits an API route
// without an earlier page render in the same server instance never initializes Sentry.
// Importing the init file here guarantees it runs on every request, page or API.
import "../sentry.server.config";

const PROTECTED_ROUTES = ["/dashboard", "/yarns"];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;
  } else {
    context.locals.user = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
