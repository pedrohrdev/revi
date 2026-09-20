import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithMagicLink } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  link_expired: "O link expirou ou já foi usado. Peça um novo abaixo.",
  missing_email: "Informe um e-mail.",
  send_failed: "Não foi possível enviar o link agora. Tente novamente.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const errorMessage = params.error
    ? (ERROR_MESSAGES[params.error] ?? "Algo deu errado. Tente novamente.")
    : null;
  const wasSent = params.sent === "1";

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Entrar no Revi</CardTitle>
          <CardDescription>
            Informe seu e-mail e enviaremos um link para entrar, sem senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {wasSent ? (
            <p className="text-sm text-muted-foreground">
              Link enviado! Confira sua caixa de entrada e clique no link para
              entrar.
            </p>
          ) : (
            <form action={signInWithMagicLink} className="space-y-4">
              {errorMessage ? (
                <p className="text-sm text-destructive">{errorMessage}</p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="voce@exemplo.com"
                />
              </div>
              <Button type="submit" className="w-full">
                Enviar link mágico
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
