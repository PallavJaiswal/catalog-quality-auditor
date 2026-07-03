"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/upload",    label: "Upload"    },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/reports",   label: "Reports"   },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav
      className="border-b border-hairline px-8 py-0
        flex items-center gap-1"
      style={{ backgroundColor: "var(--panel)" }}
    >
      {/* Brand */}
      <div className="flex items-center gap-2 mr-8 py-4">
        <div
          className="w-6 h-6 rounded flex items-center
            justify-center"
          style={{ backgroundColor: "var(--accent-dim, #0f4f4a)" }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14" height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0
              11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <span
          className="font-semibold text-sm text-text-primary
            hidden sm:block"
        >
          Catalog Auditor
        </span>
      </div>

      {/* Nav links */}
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="px-4 py-4 text-sm border-b-2
              transition-colors"
            style={{
              borderColor: isActive
                ? "var(--accent)"
                : "transparent",
              color: isActive
                ? "var(--text-primary)"
                : "var(--text-muted)",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}