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
import { signIn, signUp } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Preencha e-mail e senha.",
  invalid_credentials: "E-mail ou senha inválidos.",
  user_already_exists: "Este e-mail já tem uma conta. Tente entrar.",
  weak_password: "A senha precisa ter pelo menos 6 caracteres.",
  signup_failed: "Não foi possível criar a conta. Tente novamente.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const errorMessage = params.error
    ? (ERROR_MESSAGES[params.error] ?? "Algo deu errado. Tente novamente.")
    : null;
  const activeTab = params.tab === "signup" ? "signup" : "login";

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
        </CardContent>
      </Card>
    </main>
  );
}
