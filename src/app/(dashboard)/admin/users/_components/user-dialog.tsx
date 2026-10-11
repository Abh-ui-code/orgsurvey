"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/shared/form-dialog";
import { UnitSelect } from "@/components/shared/unit-select";
import { DrawerField } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { OrgUser, UserRole } from "@/types/org";
import { useSaveUser } from "../_hooks/use-users";

interface Draft {
  id?: string;
  full_name: string;
  email: string;
  title: string;
  role: UserRole;
  unit_id: string;
  password: string;
  is_active: boolean;
}

export const NEW_USER: Draft = { full_name: "", email: "", title: "", role: "member", unit_id: "", password: "", is_active: true };

export function draftFromUser(u: OrgUser): Draft {
  return {
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    title: u.title,
    role: u.role,
    unit_id: u.unit?.id ?? "",
    password: "",
    is_active: u.is_active,
  };
}

/** Add a person, or edit one. `draft` is null when the dialog is closed. */
export function UserDialog({ draft, onClose }: { draft: Draft | null; onClose: () => void }) {
  const save = useSaveUser();
  const [value, setValue] = useState<Draft | null>(draft);
  const [seen, setSeen] = useState(draft);
  if (draft !== seen) {
    setSeen(draft);
    setValue(draft);
  }
  const editing = Boolean(value?.id);

  return (
    <FormDialog
      open={draft !== null}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? "Edit user" : "Add user"}
      size="lg"
      saving={save.isPending}
      submitDisabled={!value?.full_name.trim() || !value?.email.trim() || (!editing && (value?.password.length ?? 0) < 8)}
      onSubmit={() =>
        value &&
        save.mutate(
          {
            id: value.id,
            full_name: value.full_name,
            email: value.email,
            title: value.title,
            role: value.role,
            unit_id: value.unit_id || null,
            is_active: value.is_active,
            password: value.password || undefined,
          },
          {
            onSuccess: () => {
              toast.success("User saved");
              onClose();
            },
            onError: (e) => toast.error((e as Error).message),
          },
        )
      }
    >
      {value && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <DrawerField label="Full name" required>
              <Input value={value.full_name} onChange={(e) => setValue({ ...value, full_name: e.target.value })} />
            </DrawerField>
            <DrawerField label="Job title">
              <Input value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} />
            </DrawerField>
          </div>
          <DrawerField label="Email" required>
            <Input type="email" value={value.email} onChange={(e) => setValue({ ...value, email: e.target.value })} />
          </DrawerField>
          <DrawerField label="Org block" hint="Where this person sits in the hierarchy.">
            <UnitSelect value={value.unit_id} onChange={(id) => setValue({ ...value, unit_id: id })} placeholder="Not placed" />
          </DrawerField>
          <div className="grid grid-cols-2 gap-3">
            <DrawerField label="Access">
              <Select value={value.role} onChange={(e) => setValue({ ...value, role: e.target.value as UserRole })}>
                <option value="member">Member</option>
                <option value="admin">Administrator</option>
              </Select>
            </DrawerField>
            <DrawerField
              label={editing ? "New password" : "Password"}
              required={!editing}
              hint={editing ? "Leave blank to keep the current one." : "At least 8 characters. They can change it later."}
            >
              <Input type="password" value={value.password} onChange={(e) => setValue({ ...value, password: e.target.value })} autoComplete="new-password" />
            </DrawerField>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <Switch checked={value.is_active} onCheckedChange={(c) => setValue({ ...value, is_active: c })} />
            Active
          </label>
        </>
      )}
    </FormDialog>
  );
}
