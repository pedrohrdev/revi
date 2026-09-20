import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset, signIn, signUp } from "./actions";

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
  const errorMessage = params.error
    ? (ERROR_MESSAGES[params.error] ?? "Algo deu errado. Tente novamente.")
    : null;
  const activeTab =
    params.tab === "signup" ? "signup" : params.tab === "forgot" ? "forgot" : "login";
  const resetLinkSent = params.sent === "forgot";

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Revi</CardTitle>
          <CardDescription>
            Entre ou crie sua conta para organizar suas revisões.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                <Button type="submit" className="w-full">
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
                <Button type="submit" className="w-full">
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
                  <Button type="submit" className="w-full">
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
        </CardContent>
      </Card>
    </main>
  );
}
