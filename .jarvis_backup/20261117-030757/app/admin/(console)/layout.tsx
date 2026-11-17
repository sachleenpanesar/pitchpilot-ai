import Link from "next/link";
import { ClipboardCheck, LayoutDashboard, MessageSquare, Settings2, ShieldCheck, TicketPercent, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/admin-auth";
import AdminLogoutButton from "./admin-logout-button";

const navigation = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users & Credits", icon: UsersRound },
  { href: "/admin/promos", label: "Promo Codes", icon: TicketPercent },
  { href: "/admin/settings", label: "Site Settings", icon: Settings2 },
  { href: "/admin/upi-payments", label: "Pending UPI Payments", icon: ClipboardCheck },
  { href: "/admin/support", label: "Support Inbox", icon: MessageSquare },
];

export default async function AdminConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 md:flex">
      <aside className="flex w-full shrink-0 flex-col border-b border-slate-800 bg-slate-900 md:min-h-screen md:w-72 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold tracking-tight text-white">PitchPilot</p>
            <p className="text-xs text-slate-400">Super Admin</p>
          </div>
        </div>

        <nav aria-label="Admin navigation" className="flex flex-wrap gap-2 p-4 md:flex-1 md:flex-col">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              <Icon className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-5 py-4">
          <span className="min-w-0 truncate text-xs text-slate-400" title={admin.email}>
            {admin.email}
          </span>
          <AdminLogoutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
