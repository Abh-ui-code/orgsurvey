"use client";

import { Pencil, Plus, Users2 } from "lucide-react";
import { useState } from "react";
import { PermissionGate } from "@/components/permission-gate";
import { IconButton } from "@/components/shared/icon-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { useDebounced } from "@/hooks/use-debounced";
import type { OrgUser } from "@/types/org";
import { NEW_USER, UserDialog, draftFromUser } from "./_components/user-dialog";
import { useUsers } from "./_hooks/use-users";

function Users() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [draft, setDraft] = useState<ReturnType<typeof draftFromUser> | null>(null);

  const debouncedSearch = useDebounced(search);
  const users = useUsers({ search: debouncedSearch, role, is_active: active, page, page_size: pageSize });

  // Any change to a filter starts again from the first page.
  const filter = <T,>(set: (v: T) => void) => (value: T) => {
    set(value);
    setPage(1);
  };

  const columns: ColumnDef<OrgUser>[] = [
    {
      key: "name",
      label: "Name",
      render: (u) => (
        <div>
          <div className="font-medium text-ink">{u.full_name}</div>
          <div className="text-xs text-ink-faint">{u.email}</div>
        </div>
      ),
    },
    { key: "title", label: "Title", render: (u) => u.title || "—" },
    { key: "unit", label: "Org block", render: (u) => u.unit?.name ?? "—" },
    {
      key: "role",
      label: "Access",
      render: (u) => <Badge tone={u.role === "admin" ? "brand" : "neutral"}>{u.role === "admin" ? "Administrator" : "Member"}</Badge>,
    },
    {
      key: "status",
      label: "Status",
      render: (u) => (
        <Badge tone={u.is_active ? "moss" : "neutral"} dot>
          {u.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "edit",
      label: "",
      className: "w-12",
      render: (u) => (
        <IconButton label="Edit user" onClick={() => setDraft(draftFromUser(u))}>
          <Pencil className="h-4 w-4" />
        </IconButton>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        description="People in the organisation. Place them in blocks, then assign them to surveys."
        actions={
          <Button onClick={() => setDraft(NEW_USER)}>
            <Plus className="h-4 w-4" /> Add user
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={search} onChange={filter(setSearch)} placeholder="Search users" className="w-72" />
        <Select value={role} onChange={(e) => filter(setRole)(e.target.value)} className="w-44">
          <option value="">All access levels</option>
          <option value="admin">Administrators</option>
          <option value="member">Members</option>
        </Select>
        <Select value={active} onChange={(e) => filter(setActive)(e.target.value)} className="w-40">
          <option value="">Active and inactive</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
      </div>
      <DataTable
        columns={columns}
        data={users.data?.results ?? []}
        isLoading={users.isPending}
        isFetching={users.isFetching}
        isError={users.isError}
        emptyIcon={Users2}
        emptyTitle="No users found"
        pagination={{ page, pageSize, total: users.data?.count ?? 0 }}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
      <UserDialog draft={draft} onClose={() => setDraft(null)} />
    </>
  );
}

export default function UsersPage() {
  return (
    <PermissionGate module="users" featureName="user management">
      <Users />
    </PermissionGate>
  );
}
