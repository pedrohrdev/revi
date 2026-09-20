import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Route Handlers (unlike Server Components) are allowed to persist cookies,
// so the PKCE code exchange has to happen here rather than in
// reset-password/page.tsx's render.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/reset-password`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=reset_link_invalid&tab=forgot`);
}
