"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * The standard "fill in a few fields and save" dialog, so every form in the
 * app shares one header, scrolling body and Cancel / Save footer.
 *
 * `side="right"` makes it a full-height drawer for longer forms; the default
 * is a centred dialog. Pressing Enter in a field submits.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  side = "center",
  size = "md",
  submitLabel = "Save",
  submitDisabled,
  saving,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  side?: "center" | "right";
  size?: "sm" | "md" | "lg";
  submitLabel?: string;
  submitDisabled?: boolean;
  saving?: boolean;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side={side} className={cn(side === "center" && "w-full", side === "center" && SIZE[size])}>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (!submitDisabled && !saving) onSubmit();
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">{children}</DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitDisabled} loading={saving}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const SIZE = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" } as const;
