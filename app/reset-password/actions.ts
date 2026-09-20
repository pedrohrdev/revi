"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updatePassword(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  if (!password) {
    redirect("/reset-password?error=missing_password");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    if (error.code === "weak_password") {
      redirect("/reset-password?error=weak_password");
    }
    // Most likely cause: no active (recovery) session — the code exchange
    // never happened or already expired.
    redirect("/reset-password?error=update_failed");
  }

  redirect("/");
}
