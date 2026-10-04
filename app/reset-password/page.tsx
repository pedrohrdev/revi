import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  missing_password: "Informe uma senha.",
  weak_password: "A senha precisa ter pelo menos 6 caracteres.",
  update_failed: "Não foi possível atualizar a senha. Peça um novo link e tente de novo.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  // The PKCE code exchange happens in reset-password/confirm/route.ts (a
  // Route Handler, which can persist cookies) and redirects here only on
  // success — so no active session at this point means an invalid/expired
  // link or a direct visit, not a race to handle.
  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !data?.claims) {
    redirect("/login?error=reset_link_invalid&tab=forgot");
  }

  const errorMessage = params.error
    ? (ERROR_MESSAGES[params.error] ?? "Algo deu errado. Tente novamente.")
    : null;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2">
          <h1 className="font-display text-4xl leading-tight">Nova senha</h1>
          <p className="text-sm text-muted-foreground">Escolha uma nova senha para sua conta.</p>
        </div>
        <div>
          <form action={updatePassword} className="space-y-4">
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="h-10 w-full font-semibold">
              Salvar nova senha
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
