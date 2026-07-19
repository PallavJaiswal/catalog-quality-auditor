type KpiIcon = "listings" | "issues" | "duplicates" | "seo";

interface KpiCardProps {
  label: string;
  value: string;
  accent: "default" | "positive" | "negative" | "warning";
  icon: KpiIcon;
}

const ICON_PATHS: Record<KpiIcon, string> = {
  // Stacked rows — total listings
  listings:
    "M4 6h16M4 12h16M4 18h10",
  // Triangle alert — listings with issues
  issues:
    "M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z",
  // Overlapping squares — duplicates
  duplicates:
    "M8 8h11v11H8zM5 5h11v11H5",
  // Trending line — SEO score
  seo:
    "M4 16.5 10 10l4 4 6.5-6.5M14.5 7.5H20.5v6",
};

export function KpiCard({ label, value, accent, icon }: KpiCardProps) {
  const accentColor = {
    default:  "var(--text-primary)",
    positive: "var(--positive)",
    negative: "var(--negative)",
    warning:  "var(--warning)",
  }[accent];

  return (
    <div
      className="rounded-2xl border border-hairline p-5
        flex flex-col gap-3"
      style={{ backgroundColor: "var(--panel)" }}
    >
      <span
        className="flex h-9 w-9 items-center justify-center
          rounded-full"
        style={{
          backgroundColor: "rgba(45, 212, 191, 0.1)",
          color: "var(--accent)",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={ICON_PATHS[icon]} />
        </svg>
      </span>

      <div className="flex flex-col gap-1">
        <p className="mono-label text-text-muted">{label}</p>
        <p
          className="text-3xl font-semibold tracking-tight"
          style={{ color: accentColor }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
