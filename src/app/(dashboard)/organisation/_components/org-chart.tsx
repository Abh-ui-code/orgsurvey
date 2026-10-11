"use client";

import { ChevronsDownUp, ChevronsUpDown, Maximize2, Minus, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UnitNode } from "@/lib/org";
import { unitPath } from "@/lib/org";
import { cn } from "@/lib/utils";
import type { OrgUnit } from "@/types/org";
import { UnitCard } from "./unit-card";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.6;
const ZOOM_STEP = 0.1;
/** Above this many blocks the chart opens with the lower levels folded away. */
const LARGE_ORG = 30;
const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));

function countDescendants(node: UnitNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}

/** Ids of blocks that should start folded: in a large organisation, everything
 * below the third level, so the chart opens as an overview rather than a wall. */
function initiallyCollapsed(roots: UnitNode[], total: number): Set<string> {
  const out = new Set<string>();
  if (total <= LARGE_ORG) return out;
  const walk = (node: UnitNode, depth: number) => {
    if (depth >= 2 && node.children.length > 0) out.add(node.id);
    node.children.forEach((c) => walk(c, depth + 1));
  };
  roots.forEach((r) => walk(r, 0));
  return out;
}

/** One block plus its subtree. The connector lines are plain borders: a
 * vertical stub under the parent, a horizontal rail across the children, and
 * a vertical stub into each child. A block with children can be folded. */
function Branch({
  node,
  selectedId,
  collapsed,
  onToggle,
  onSelect,
}: {
  node: UnitNode;
  selectedId: string | null;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const count = node.children.length;
  const folded = collapsed.has(node.id);
  return (
    <div className="flex flex-col items-center">
      <UnitCard unit={node} selected={selectedId === node.id} onSelect={() => onSelect(node.id)} />
      {count > 0 && (
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          aria-label={folded ? `Show ${countDescendants(node)} blocks under ${node.name}` : `Hide blocks under ${node.name}`}
          aria-expanded={!folded}
          className="-mb-1.5 mt-1 flex h-5 items-center gap-1 rounded-full border border-line-strong bg-paper-raised px-1.5 text-2xs font-medium text-ink-muted hover:border-brand hover:text-brand"
        >
          {folded ? (
            <>
              <Plus className="h-3 w-3" /> {countDescendants(node)}
            </>
          ) : (
            <Minus className="h-3 w-3" />
          )}
        </button>
      )}
      {count > 0 && !folded && (
        <>
          <div className="h-6 w-px bg-line-strong" />
          <div className="flex">
            {node.children.map((child, i) => (
              <div key={child.id} className="relative flex flex-col items-center px-3 pt-6">
                {count > 1 && (
                  <div
                    className={cn(
                      "absolute top-0 h-px bg-line-strong",
                      i === 0 ? "left-1/2 right-0" : i === count - 1 ? "left-0 right-1/2" : "left-0 right-0",
                    )}
                  />
                )}
                <div className="absolute left-1/2 top-0 h-6 w-px bg-line-strong" />
                <Branch node={child} selectedId={selectedId} collapsed={collapsed} onToggle={onToggle} onSelect={onSelect} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Find a block by name. Picking a result unfolds the way down to it and selects it. */
function BlockSearch({ units, onPick }: { units: OrgUnit[]; onPick: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? units.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 6) : [];
  }, [units, query]);

  return (
    <div className="relative w-64">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a block…" className="pl-8" aria-label="Find a block" />
      {matches.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-line bg-paper-raised shadow-lg">
          {matches.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-paper-sunken"
                onClick={() => {
                  onPick(u.id);
                  setQuery("");
                }}
              >
                <span className="block text-ink">{u.name}</span>
                <span className="block truncate text-xs text-ink-faint">{unitPath(units, u.id)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The hierarchy as a zoomable block diagram. Ctrl/Cmd + wheel zooms too;
 * branches fold; blocks can be found by name. */
export function OrgChart({
  roots,
  units,
  selectedId,
  onSelect,
}: {
  roots: UnitNode[];
  units: OrgUnit[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [collapsed, setCollapsed] = useState(() => initiallyCollapsed(roots, units.length));
  const scroller = useRef<HTMLDivElement>(null);

  // Needs a non-passive native listener so the browser's own page zoom can be suppressed.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => clamp(z - Math.sign(e.deltaY) * ZOOM_STEP));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const foldable = useMemo(() => units.filter((u) => units.some((c) => c.parent_id === u.id)).map((u) => u.id), [units]);

  function pick(id: string) {
    // Unfold every ancestor so the block is actually on screen, then select and centre it.
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (let u = units.find((x) => x.id === id); u?.parent_id; u = units.find((x) => x.id === u!.parent_id)) next.delete(u.parent_id);
      return next;
    });
    onSelect(id);
    setTimeout(() => document.getElementById(`unit-${id}`)?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" }), 80);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BlockSearch units={units} onPick={pick} />
        <div className="flex items-center gap-1 rounded-lg border border-line bg-paper-raised p-1 shadow-sm">
          <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set())} title="Show every block">
            <ChevronsUpDown className="h-4 w-4" /> Expand all
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set(foldable))} title="Fold every branch">
            <ChevronsDownUp className="h-4 w-4" /> Collapse all
          </Button>
          <span className="mx-1 h-5 w-px bg-line" />
          <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => setZoom((z) => clamp(z - ZOOM_STEP))} disabled={zoom <= MIN_ZOOM}>
            <Minus className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center font-mono-data text-xs text-ink-muted">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => setZoom((z) => clamp(z + ZOOM_STEP))} disabled={zoom >= MAX_ZOOM}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Reset zoom" title="Reset zoom" onClick={() => setZoom(1)}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={scroller} className="h-[calc(100vh-17rem)] min-h-[380px] overflow-auto rounded-lg border border-line bg-paper-raised">
        {/* CSS zoom (unlike transform: scale) changes layout size, so the scroll area tracks it. */}
        <div className="flex min-w-max justify-center p-8" style={{ zoom }}>
          {roots.map((root) => (
            <Branch key={root.id} node={root} selectedId={selectedId} collapsed={collapsed} onToggle={toggle} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}
