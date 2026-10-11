"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { IconButton } from "@/components/shared/icon-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useBankCategories } from "@/hooks/use-bank-categories";
import { useDeleteBankCategory, useSaveBankCategory } from "../_hooks/use-question-bank";

/** Add, rename and delete the topics questions are filed under. */
export function CategoriesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const categories = useBankCategories();
  const save = useSaveBankCategory();
  const del = useDeleteBankCategory();
  const [newLabel, setNewLabel] = useState("");
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null);
  const fail = (e: Error) => toast.error(e.message);

  function rename() {
    if (editing?.label.trim()) save.mutate({ id: editing.id, label: editing.label }, { onSuccess: () => setEditing(null), onError: fail });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="center" className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Question categories</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate({ label: newLabel }, { onSuccess: () => setNewLabel(""), onError: fail });
            }}
          >
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="New category name" />
            <Button type="submit" disabled={!newLabel.trim()} loading={save.isPending && !editing}>
              <Plus className="h-4 w-4" /> Add
            </Button>
          </form>
          <ul className="divide-y divide-line rounded-md border border-line">
            {categories.data?.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2">
                {editing?.id === c.id ? (
                  <>
                    <Input
                      value={editing.label}
                      autoFocus
                      onChange={(e) => setEditing({ id: c.id, label: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") rename();
                        if (e.key === "Escape") setEditing(null);
                      }}
                    />
                    <Button size="sm" disabled={!editing.label.trim()} onClick={rename}>
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-ink">
                      {c.label} <span className="text-xs text-ink-faint">({c.question_count})</span>
                    </span>
                    <IconButton label={`Rename ${c.label}`} onClick={() => setEditing({ id: c.id, label: c.label })}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={`Delete ${c.label}`} onClick={() => del.mutate(c.id, { onError: fail })}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </>
                )}
              </li>
            ))}
          </ul>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
