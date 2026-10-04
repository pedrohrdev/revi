import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Instrument_Serif, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { todaySaoPaulo } from "@/lib/date";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Revi", template: "%s · Revi" },
  description: "Saiba o que você estudou, o que já revisou e quando revisar de novo.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;

  let shell: { dueCount: number; subjects: string[] } | null = null;
  if (email) {
    // Lightweight: only the columns the shell needs (badge + subject
    // suggestions in "Registrar estudo").
    const { data: rows } = await supabase
      .from("contents")
      .select("subject, status, next_review_date");
    const today = todaySaoPaulo();
    const list = rows ?? [];
    shell = {
      dueCount: list.filter(
        (row) => row.status === "active" && row.next_review_date && row.next_review_date <= today,
      ).length,
      subjects: [
        ...new Set(list.map((row) => row.subject?.trim()).filter((s): s is string => !!s)),
      ].sort((a, b) => a.localeCompare(b, "pt-BR")),
    };
  }

  return (
    <html
      lang="pt-BR"
      className={`dark ${hanken.variable} ${instrumentSerif.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {email && shell ? (
          <AppShell email={email} dueCount={shell.dueCount} subjects={shell.subjects}>
            {children}
          </AppShell>
        ) : (
          <div className="flex min-h-dvh flex-col">{children}</div>
        )}
        <Toaster theme="dark" position="top-center" />
      </body>
    </html>
  );
}
