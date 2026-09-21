"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewContentForm } from "@/components/new-content-form";

export default function NewContentPage() {
  const router = useRouter();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col p-4">
      <Card>
        <CardHeader>
          <CardTitle>Novo conteúdo</CardTitle>
        </CardHeader>
        <CardContent>
          <NewContentForm onSuccess={() => router.push("/")} />
        </CardContent>
      </Card>
    </main>
  );
}
