"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const routes = [
  { href: "/dashboard", label: "Overview", icon: "▦" },
  { href: "/students", label: "Cohorts & enrolments", icon: "◉" },
  { href: "/assessments", label: "Assessment tracker", icon: "▤" },
  { href: "/progress", label: "Progress Tracker", icon: "◷" },
  { href: "/markers", label: "Marker directory", icon: "♧" },
  { href: "/marking", label: "Marking Allocation", icon: "▤" },
  { href: "/sources", label: "Integrations", icon: "◇" },
];
export function AppSidebar({
  assessment,
}: {
  assessment?: { id: string; name: string; module: string };
}) {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-[#e0e7e4] bg-white lg:block">
      <div className="flex h-full flex-col">
        <Link
          href="/dashboard"
          className="flex h-[94px] items-center gap-3 border-b border-[#e7ece9] px-7"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#225c4b] text-lg font-bold text-white">
            g
          </span>
          <span className="text-xl font-semibold tracking-tight text-[#274237]">
            Gradezy<span className="ml-1 text-[#84a494]">.</span>
          </span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-4 py-7">
          <p className="mb-4 px-3 text-[10px] font-semibold tracking-[.18em] text-[#99a99f]">
            ASSESSMENT OPERATIONS
          </p>
          <div className="space-y-2">
            {routes.map((r) => {
              const active =
                r.href === "/assessments"
                  ? path.startsWith("/assessments") ||
                    path.startsWith("/workflow")
                  : r.href === "/students"
                    ? path.startsWith("/students")
                    : path === r.href;
              return (
                <Link
                  key={r.href}
                  href={r.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] transition ${active ? "bg-[#eaf2ec] font-semibold text-[#225c4b]" : "text-[#819086] hover:bg-[#f4f7f5]"}`}
                >
                  <span className="w-5 text-lg" aria-hidden>
                    {r.icon}
                  </span>
                  {r.label}
                </Link>
              );
            })}
          </div>
          {assessment && (
            <div className="mt-8 border-t border-[#e7ece9] pt-5">
              <p className="px-3 text-xs font-semibold text-[#597762]">
                {assessment.name}
              </p>
              <Link
                className="mt-3 block px-3 py-2 text-xs text-[#225c4b]"
                href={`/workflow/${assessment.id}`}
              >
                Connected workspace →
              </Link>
              {["reconciliation", "issues", "readiness"].map((section) => (
                <Link
                  key={section}
                  className="block px-3 py-2 text-xs capitalize text-[#819086]"
                  href={`/assessments/${assessment.id}/${section}`}
                >
                  {section}
                </Link>
              ))}
            </div>
          )}
          <div className="mt-8 border-t border-[#e7ece9] pt-5">
            <Link
              href="/students/all"
              className="block px-3 py-2 text-xs text-[#8a9990]"
            >
              Legacy student analytics
            </Link>
            <Link
              href="/settings"
              className="block px-3 py-2 text-xs text-[#8a9990]"
            >
              Workspace settings
            </Link>
          </div>
        </nav>
        <div className="m-4 rounded-xl border border-[#dfe9e2] bg-[#f4f8f5] p-4">
          <p className="text-xs font-semibold text-[#577761]">
            Assessment team
          </p>
          <p className="mt-2 text-[11px] leading-5 text-[#91a196]">
            Cohorts to reviewed grades.
            <br />A connected operations workspace.
          </p>
        </div>
      </div>
    </aside>
  );
}
