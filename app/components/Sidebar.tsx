"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Enquiries", href: "/enquiries" },
  { name: "Calendar", href: "/calendar" },
  { name: "Quotes", href: "/quotes" },
  { name: "Quote History", href: "/quotes/history" },
  { name: "Bookings", href: "/bookings" },
  { name: "Finance", href: "/finance" },
  { name: "Packages & Services", href: "/packages" },
  { name: "Team Members", href: "/team" },
  { name: "Settings", href: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("LOGOUT ERROR:", error);

      setLoggingOut(false);
      return;
    }

    router.push("/login");
  }

  return (
    <aside className="flex min-h-screen w-64 flex-col border-r bg-white">
      {/* Logo */}
      <div className="border-b px-6 py-6">
        <Link href="/dashboard">
          <h1 className="text-2xl font-bold text-gray-900">
            VenueFlow
          </h1>

          <p className="mt-1 text-xs text-gray-500">
            Venue Management CRM
          </p>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Management
        </p>

        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-black text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Logout */}
      <div className="border-t p-4">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loggingOut ? "Logging out..." : "Log out"}
        </button>
      </div>
    </aside>
  );
}