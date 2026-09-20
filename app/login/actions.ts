"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function readCredentials(formData: FormData): { email: string; password: string } {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signIn(formData: FormData): Promise<void> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) {
    redirect("/login?error=missing_fields&tab=login");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=invalid_credentials&tab=login");
  }

  redirect("/");
}

export async function requestPasswordReset(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect("/login?error=missing_fields&tab=forgot");
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/reset-password/confirm`,
  });

  // Supabase never reveals whether the email is registered (avoids account
  // enumeration) — always redirect to the same "check your inbox" state,
  // even on error; only log server-side for our own visibility.
  if (error) {
    console.error("resetPasswordForEmail failed:", error.status, error.message);
  }

  redirect("/login?sent=forgot&tab=forgot");
}

export async function signUp(formData: FormData): Promise<void> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) {
    redirect("/login?error=missing_fields&tab=signup");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    // Email confirmation is disabled project-wide, so signUp() either
    // returns an active session or one of these — never a "check your
    // inbox" pending state.
    if (error.code === "user_already_exists") {
      redirect("/login?error=user_already_exists&tab=signup");
    }
    if (error.code === "weak_password") {
      redirect("/login?error=weak_password&tab=signup");
    }
    redirect("/login?error=signup_failed&tab=signup");
  }

  redirect("/");
}
