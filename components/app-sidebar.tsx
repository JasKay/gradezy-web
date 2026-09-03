"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppSidebar({ assessment }: { assessment?: { id: string; name: string; module: string } }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;
  const assessmentLinks = assessment ? [
    ["Overview", `/assessments/${assessment.id}`],
    ["Reconciliation", `/assessments/${assessment.id}/reconciliation`],
    ["Issues", `/assessments/${assessment.id}/issues`],
    ["Readiness", `/assessments/${assessment.id}/readiness`],
  ] : [];

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-white/10 bg-[#0a0f17] text-white lg:block">
      <div className="flex h-full flex-col">
        <Link href="/dashboard" className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-[#070b12]">G</span>
          <span className="text-xl font-semibold tracking-tight">Gradezy</span>
        </Link>
        <nav className="flex-1 px-4 py-6">
          <p className="px-3 pb-3 text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">Workspace</p>
          <div className="space-y-1">
            <SidebarLink href="/dashboard" active={isActive("/dashboard")}>Dashboard</SidebarLink>
            <SidebarLink href="/assessments" active={pathname === "/assessments" || pathname === "/assessments/new"}>Assessments</SidebarLink>
          </div>
          {assessment && <>
            <p className="mt-9 px-3 pb-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">Current assessment</p>
            <p className="mb-3 px-3 text-sm font-medium text-slate-300">{assessment.module}</p>
            <div className="space-y-1">{assessmentLinks.map(([label, href]) => <SidebarLink key={href} href={href} active={isActive(href)}>{label}</SidebarLink>)}</div>
          </>}
        </nav>
        <div className="border-t border-white/10 p-4 text-xs text-slate-500">Assessment Team<br /><span className="text-slate-600">Gradezy workspace</span></div>
      </div>
    </aside>
  );
}

function SidebarLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} className={`block rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-white/10 text-white" : "text-slate-500 hover:bg-white/5 hover:text-white"}`}>{children}</Link>;
}
