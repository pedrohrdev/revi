import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Revi",
  description: "Organize suas revisões de conteúdos estudados.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;

  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {email ? (
          <header className="flex items-center justify-between gap-3 border-b bg-card px-4 py-3">
            <span className="shrink-0 text-sm font-semibold text-primary">Revi</span>
            <div className="flex min-w-0 items-center gap-3">
              <span className="hidden truncate text-sm text-muted-foreground sm:inline">
                {email}
              </span>
              <form action={signOut}>
                <Button type="submit" variant="outline" size="sm">
                  Sair
                </Button>
              </form>
            </div>
          </header>
        ) : null}
        {children}
        <Toaster />
      </body>
    </html>
  );
}
