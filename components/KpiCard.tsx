interface KpiCardProps {
  label: string;
  value: string;
  accent: "default" | "positive" | "negative" | "warning";
}

export function KpiCard({ label, value, accent }: KpiCardProps) {
  const accentColor = {
    default:  "var(--text-primary)",
    positive: "var(--positive)",
    negative: "var(--negative)",
    warning:  "var(--warning)",
  }[accent];

  return (
    <div
      className="rounded-xl border border-hairline p-5
        flex flex-col gap-2"
      style={{ backgroundColor: "var(--panel)" }}
    >
      <p className="mono-label text-text-muted">{label}</p>
      <p
        className="text-3xl font-semibold tracking-tight"
        style={{ color: accentColor }}
      >
        {value}
      </p>
    </div>
  );
}