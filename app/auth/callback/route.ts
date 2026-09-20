import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PKCE callback: Supabase redirects here with ?code=... after the user
// clicks the magic link. Exchanging it for a session writes the auth
// cookies via lib/supabase/server.ts's setAll.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link_expired`);
}
