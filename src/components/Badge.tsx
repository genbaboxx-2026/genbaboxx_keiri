import type { ProductType } from "@/lib/database.types";

const PRODUCT_CONFIG: Record<
  ProductType,
  { label: string; color: string; bg: string }
> = {
  bakusoq: { label: "BAKUSOQ", color: "text-blue-600", bg: "bg-blue-100" },
  ninkuboxx: {
    label: "NiNKUBOXX",
    color: "text-violet-600",
    bg: "bg-violet-100",
  },
  other: { label: "その他", color: "text-emerald-600", bg: "bg-emerald-100" },
};

interface BadgeProps {
  product: ProductType;
}

export function Badge({ product }: BadgeProps) {
  const config = PRODUCT_CONFIG[product];
  if (!config) return null;
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold ${config.color} ${config.bg}`}
    >
      {config.label}
    </span>
  );
}
