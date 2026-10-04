import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, signIn, signUp } from "./actions";

export const metadata: Metadata = { title: "Entrar" };

const STAGES = [
  { label: "Estudo", day: "dia 0" },
  { label: "1ª revisão", day: "dia 1" },
  { label: "2ª revisão", day: "dia 4" },
  { label: "3ª revisão", day: "dia 11" },
  { label: "4ª revisão", day: "dia 26" },
  { label: "5ª revisão", day: "dia 56" },
];

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Preencha e-mail e senha.",
  invalid_credentials: "E-mail ou senha inválidos.",
  user_already_exists: "Este e-mail já tem uma conta. Tente entrar.",
  weak_password: "A senha precisa ter pelo menos 6 caracteres.",
  signup_failed: "Não foi possível criar a conta. Tente novamente.",
  reset_link_invalid: "Esse link expirou ou já foi usado. Peça um novo abaixo.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; tab?: string; sent?: string }>;
}) {
  const params = await searchParams;

  // Already signed in: the login screen has nothing to offer.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/");
  const errorMessage = params.error
    ? (ERROR_MESSAGES[params.error] ?? "Algo deu errado. Tente novamente.")
    : null;
  const activeTab =
    params.tab === "signup" ? "signup" : params.tab === "forgot" ? "forgot" : "login";
  const resetLinkSent = params.sent === "forgot";

  return (
    <main className="grid flex-1 lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-border p-12 lg:flex">
        <p className="flex items-baseline gap-2">
          <span className="font-display text-4xl leading-none">Revi</span>
          <span className="size-2 rounded-full bg-primary" aria-hidden />
        </p>
        <div className="space-y-10">
          <h1 className="max-w-[16ch] font-display text-7xl leading-[0.95] tracking-tight">
            Estude uma vez. Lembre por muito tempo.
          </h1>
          <ol className="flex max-w-xl items-end gap-2" aria-label="Ciclo de revisões espaçadas">
            {STAGES.map((stage, i) => (
              <li key={stage.label} className="flex flex-1 flex-col gap-2">
                <span
                  className="block rounded-md"
                  style={{
                    height: 18 + i * 18,
                    backgroundColor: i === 0 ? "var(--foreground)" : `var(--stage-${i})`,
                  }}
                />
                <span className="text-xs text-foreground">{stage.label}</span>
                <span className="text-[11px] text-muted-foreground">{stage.day}</span>
              </li>
            ))}
          </ol>
        </div>
        <p className="max-w-[46ch] text-sm text-muted-foreground">
          Registre o que estudou e o Revi te diz o que revisar a cada dia, com o histórico de tudo o que
          você já fez.
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-12 sm:px-10">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <p className="flex items-baseline gap-1.5 lg:hidden">
              <span className="font-display text-3xl leading-none">Revi</span>
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            </p>
            <h2 className="font-display text-4xl leading-tight">
              {activeTab === "signup" ? "Crie sua conta" : activeTab === "forgot" ? "Redefinir senha" : "Bem-vindo de volta"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Entre ou crie sua conta para organizar suas revisões.
            </p>
          </div>
        <div>
          <Tabs defaultValue={activeTab}>
            <TabsList className="w-full">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form action={signIn} className="space-y-4 pt-4">
                {activeTab === "login" && errorMessage ? (
                  <p className="text-sm text-destructive">{errorMessage}</p>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="login-email">E-mail</Label>
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="h-10 w-full font-semibold">
                  Entrar
                </Button>
                <p className="text-center text-sm">
                  <Link href="/login?tab=forgot" className="text-muted-foreground underline">
                    Esqueci minha senha
                  </Link>
                </p>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form action={signUp} className="space-y-4 pt-4">
                {activeTab === "signup" && errorMessage ? (
                  <p className="text-sm text-destructive">{errorMessage}</p>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="signup-email">E-mail</Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
                <Button type="submit" className="h-10 w-full font-semibold">
                  Criar conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {activeTab === "forgot" ? (
            <div className="space-y-4 pt-4">
              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
              {resetLinkSent ? (
                <p className="text-sm text-muted-foreground">
                  Se esse e-mail tiver uma conta, enviamos um link para redefinir a senha.
                  Confira sua caixa de entrada.
                </p>
              ) : (
                <form action={requestPasswordReset} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">E-mail</Label>
                    <Input
                      id="forgot-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                    />
                  </div>
                  <Button type="submit" className="h-10 w-full font-semibold">
                    Enviar link de redefinição
                  </Button>
                </form>
              )}
              <p className="text-center text-sm">
                <Link href="/login" className="text-muted-foreground underline">
                  Voltar para o login
                </Link>
              </p>
            </div>
          ) : null}
        </div>
        </div>
      </section>
    </main>
  );
}
