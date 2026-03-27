import type { ProductType } from "./database.types";

export const PRODUCTS: {
  id: ProductType;
  label: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  hex: string;
}[] = [
  {
    id: "bakusoq",
    label: "BAKUSOQ",
    colorClass: "text-blue-600",
    bgClass: "bg-blue-100",
    borderClass: "border-blue-600",
    hex: "#2563eb",
  },
  {
    id: "ninkuboxx",
    label: "NiNKUBOXX",
    colorClass: "text-violet-600",
    bgClass: "bg-violet-100",
    borderClass: "border-violet-600",
    hex: "#7c3aed",
  },
  {
    id: "other",
    label: "その他",
    colorClass: "text-emerald-600",
    bgClass: "bg-emerald-100",
    borderClass: "border-emerald-600",
    hex: "#059669",
  },
];

export const TABS = [
  { id: "contracts" as const, label: "契約", icon: "📄" },
  { id: "cashflow" as const, label: "資金繰り表", icon: "📊" },
  { id: "companies" as const, label: "企業マスタ", icon: "🏢" },
  { id: "invoice_settings" as const, label: "請求書設定", icon: "📝" },
  { id: "settings" as const, label: "設定", icon: "⚙" },
] as const;

export type TabId = (typeof TABS)[number]["id"];
