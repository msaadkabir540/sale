import { NextResponse, type NextRequest } from "next/server";

import { hasSupabaseEnv } from "@/lib/env";
import { updateSession } from "@/lib/supabase/proxy";

const SETUP_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Surf Daily Sales — setup required</title>
  </head>
  <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#faf8f3;color:#0f172a;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
    <main style="width:min(36rem,calc(100% - 3rem));background:#fff;border:1px solid #e2e8f0;border-radius:1rem;padding:2rem;box-shadow:0 1px 2px rgba(15,23,42,.04)">
      <p style="margin:0 0 .5rem;font-size:.75rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#22768c">Configuration required</p>
      <h1 style="margin:0;font-size:1.5rem;letter-spacing:-.02em">Connect Supabase to continue</h1>
      <p style="margin:.75rem 0 0;line-height:1.6;color:#475569">
        <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are not set.
        Add them to <code>.env.local</code>, then restart the server.
      </p>
      <p style="margin:1.25rem 0 .5rem;font-weight:600">Local development</p>
      <pre style="margin:0;padding:1rem;background:#0b2a34;color:#dbf0f4;border-radius:.75rem;overflow-x:auto;font-size:.875rem;line-height:1.7">supabase start
npm run env:local
npm run dev</pre>
      <p style="margin:1rem 0 0;font-size:.8125rem;color:#64748b">
        Using a hosted project? Set the project URL and anon/publishable key from the Supabase dashboard.
        Never add the service-role key to the app.
      </p>
    </main>
  </body>
</html>`;

export default async function proxy(request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return new NextResponse(SETUP_PAGE, {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
