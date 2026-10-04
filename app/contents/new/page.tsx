"use client";

import { useRouter } from "next/navigation";
import { NewContentForm } from "@/components/new-content-form";

export default function NewContentPage() {
  const router = useRouter();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8 lg:py-12">
      <h1 className="font-display text-5xl leading-none tracking-tight">O que você estudou?</h1>
      <NewContentForm onSuccess={() => router.push("/")} />
    </main>
  );
}
