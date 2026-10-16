"use client";

import { useEffect, useState } from "react";
import { getTenantFromHost } from "@/lib/tenant";
import { Brand } from "./_components/brand";
import { FindWorkspace } from "./_components/find-workspace";
import { SignInForm } from "./_components/sign-in-form";

const STEPS = [
  { role: "Responder", line: "Answers for their block" },
  { role: "Reviewer", line: "Checks the response" },
  { role: "Approver", line: "Signs it off" },
];

export default function LoginPage() {
  // The host is only known in the browser; render nothing until it is.
  const [tenant, setTenant] = useState<string | null | undefined>(undefined);
  useEffect(() => setTenant(getTenantFromHost()), []);

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-ink lg:flex">
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full border border-sidebar-line" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-8 h-[20rem] w-[20rem] rounded-full border border-sidebar-line" />
        <p className="font-display text-lg font-semibold text-white">OrgSurvey</p>
        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-[1.1] text-white">Every survey has someone it is waiting on.</h2>
          <p className="mt-4 text-sidebar-muted">Send a survey to a block of your organisation, and follow it through response, review and approval.</p>
          <ol className="mt-10 space-y-0">
            {STEPS.map((s, i) => (
              <li key={s.role} className="relative flex gap-4 pb-6 last:pb-0">
                {i < STEPS.length - 1 && <span aria-hidden className="absolute left-[11px] top-6 h-full w-px bg-sidebar-line" />}
                <span className={i === STEPS.length - 1 ? "relative mt-0.5 h-6 w-6 shrink-0 rounded-full bg-sidebar-mark" : "relative mt-0.5 h-6 w-6 shrink-0 rounded-full border-2 border-sidebar-muted"} />
                <div>
                  <p className="font-medium text-white">{s.role}</p>
                  <p className="text-sm text-sidebar-muted">{s.line}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <span />
      </aside>

      <main className="flex items-center justify-center bg-paper p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <Brand />
          </div>
          {tenant === undefined ? null : tenant === null ? <FindWorkspace /> : <SignInForm tenant={tenant} />}
        </div>
      </main>
    </div>
  );
}
