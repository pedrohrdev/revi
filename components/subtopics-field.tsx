"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { flushSync } from "react-dom";
import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_SUBTOPIC_LENGTH, MAX_SUBTOPICS, subtopicKey } from "@/lib/subtopics";

interface Row {
  id: number;
  value: string;
}

// Dynamic list of subtopic inputs, all named "subtopics" so the parent form
// reads them with formData.getAll("subtopics"). Blank rows and duplicates
// are only flagged here — the Server Action is what actually normalizes the
// list (lib/subtopics.ts).
export function SubtopicsField({ defaultValue = [] }: { defaultValue?: string[] }) {
  // The "Registrar estudo" dialog can open on top of the edit page, so two
  // instances may coexist — ids must not be hardcoded.
  const idPrefix = useId();
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  const [rows, setRows] = useState<Row[]>(() =>
    (defaultValue.length > 0 ? defaultValue : [""]).map((value, id) => ({ id, value })),
  );

  const atLimit = rows.length >= MAX_SUBTOPICS;

  // A row is a duplicate when an earlier, non-blank row has the same key
  // (case, accents and spacing ignored) — it'll be dropped on save.
  const seen = new Set<string>();
  const duplicates = new Set<number>();
  for (const row of rows) {
    const key = subtopicKey(row.value);
    if (!key) continue;
    if (seen.has(key)) duplicates.add(row.id);
    else seen.add(key);
  }

  function focusRow(id: number) {
    inputs.current.get(id)?.focus();
  }

  // flushSync commits the row change before moving focus, so focus is
  // handled right here in the event instead of in an effect.
  function addRowAfter(index: number) {
    if (atLimit) return;
    // Ids only need to be unique among the rows currently rendered: each
    // row keeps its id (and React key) for its whole life, so editing or
    // removing one row never shifts focus or values onto another.
    const row = { id: Math.max(-1, ...rows.map((r) => r.id)) + 1, value: "" };
    flushSync(() =>
      setRows((current) => [...current.slice(0, index + 1), row, ...current.slice(index + 1)]),
    );
    focusRow(row.id);
  }

  function removeRow(index: number, focus: Row | undefined) {
    const { id } = rows[index];
    flushSync(() => setRows((current) => current.filter((row) => row.id !== id)));
    // Removing the only row leaves no input to land on; keep focus inside
    // the field instead of dropping it to <body>.
    if (focus) focusRow(focus.id);
    else addButton.current?.focus();
  }

  function updateRow(id: number, value: string) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, value } : row)));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Enter") {
      // Never submit the form from here; Enter moves on to the next row.
      event.preventDefault();
      if (event.nativeEvent.isComposing) return;
      const next = rows[index + 1];
      if (next && !next.value.trim()) focusRow(next.id);
      else if (rows[index].value.trim()) addRowAfter(index);
      return;
    }
    // Backspace on an empty row deletes it and goes back to the previous one.
    if (event.key === "Backspace" && rows[index].value === "" && rows.length > 1) {
      event.preventDefault();
      removeRow(index, rows[index - 1] ?? rows[index + 1]);
    }
  }

  return (
    <div role="group" aria-labelledby={`${idPrefix}-label`} className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <span id={`${idPrefix}-label`} className="text-sm leading-none font-medium select-none">
          Subconteúdos
        </span>
        <span className="text-xs text-muted-foreground">Opcional</span>
      </div>

      {rows.length > 0 ? (
        <ul className="space-y-1.5">
          {rows.map((row, index) => {
            const duplicate = duplicates.has(row.id);
            return (
              <li key={row.id}>
                <div className="flex items-center gap-1.5">
                  <Input
                    ref={(element) => {
                      if (element) inputs.current.set(row.id, element);
                      else inputs.current.delete(row.id);
                    }}
                    name="subtopics"
                    value={row.value}
                    onChange={(event) => updateRow(row.id, event.target.value)}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                    maxLength={MAX_SUBTOPIC_LENGTH}
                    autoComplete="off"
                    placeholder={index === 0 ? "Ex.: req.params" : undefined}
                    aria-label={`Subconteúdo ${index + 1}`}
                    aria-describedby={duplicate ? `${idPrefix}-${row.id}-duplicate` : undefined}
                    className="h-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    onClick={() => removeRow(index, rows[index + 1] ?? rows[index - 1])}
                    aria-label={row.value.trim() ? `Remover subconteúdo ${row.value.trim()}` : "Remover linha"}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <XIcon />
                  </Button>
                </div>
                {duplicate ? (
                  <p id={`${idPrefix}-${row.id}-duplicate`} className="mt-1 text-xs text-muted-foreground">
                    Já está na lista e será ignorado.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {atLimit ? (
        <p className="text-xs text-muted-foreground">Limite de {MAX_SUBTOPICS} subconteúdos.</p>
      ) : (
        <button
          ref={addButton}
          type="button"
          onClick={() => addRowAfter(rows.length - 1)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <PlusIcon className="size-4" />
          Adicionar subconteúdo
        </button>
      )}
    </div>
  );
}
