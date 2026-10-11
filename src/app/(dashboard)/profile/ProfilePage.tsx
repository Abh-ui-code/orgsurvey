"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DrawerField } from "@/components/ui/drawer-form";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useChangePassword, useUpdateProfile } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useUnits } from "@/hooks/use-units";
import { unitPath } from "@/lib/org";

export default function ProfilePage() {
  const { user } = usePermissions();
  const units = useUnits();
  const update = useUpdateProfile();
  const changePassword = useChangePassword();
  const [name, setName] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  if (!user) return <Skeleton className="h-64 w-full" />;

  return (
    <div>
      <PageHeader title="My profile" description="Your details, place in the organisation and password." />
      <div className="grid max-w-4xl gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DrawerField label="Full name" required>
              <Input value={name ?? user.full_name} onChange={(e) => setName(e.target.value)} />
            </DrawerField>
            <DrawerField label="Job title">
              <Input value={title ?? user.title} onChange={(e) => setTitle(e.target.value)} />
            </DrawerField>
            <DrawerField label="Email">
              <Input value={user.email} disabled />
            </DrawerField>
            <div className="flex justify-end">
              <Button
                loading={update.isPending}
                disabled={!(name ?? user.full_name).trim()}
                onClick={() =>
                  update.mutate(
                    { full_name: name ?? user.full_name, title: title ?? user.title },
                    { onSuccess: () => toast.success("Profile updated"), onError: (e) => toast.error((e as Error).message) },
                  )
                }
              >
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>In the organisation</CardTitle>
              <Badge tone={user.role === "admin" ? "brand" : "neutral"}>{user.role === "admin" ? "Administrator" : "Member"}</Badge>
            </CardHeader>
            <CardContent className="text-sm text-ink">{unitPath(units.data ?? [], user.unit?.id) || "Not placed in a block"}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DrawerField label="Current password">
                <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
              </DrawerField>
              <DrawerField label="New password" hint="At least 8 characters.">
                <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
              </DrawerField>
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  loading={changePassword.isPending}
                  disabled={!current || next.length < 8}
                  onClick={() =>
                    changePassword.mutate(
                      { current_password: current, new_password: next },
                      {
                        onSuccess: () => {
                          toast.success("Password changed");
                          setCurrent("");
                          setNext("");
                        },
                        onError: (e) => toast.error((e as Error).message),
                      },
                    )
                  }
                >
                  Update password
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
