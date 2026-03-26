"use client";

import { useState } from "react";
import type { InvoiceTemplate } from "@/lib/database.types";
import { PRODUCTS } from "@/lib/constants";

interface InvoiceSettingsPageProps {
  templates: InvoiceTemplate[];
  onSave: (template: Omit<InvoiceTemplate, "created_at" | "updated_at">) => void;
}

export function InvoiceSettingsPage({
  templates,
  onSave,
}: InvoiceSettingsPageProps) {
  const [saved, setSaved] = useState<string | null>(null);

  return (
    <div>
      <h2 className="text-[22px] font-extrabold mb-6">請求書設定</h2>
      <p className="text-sm text-slate-500 mb-6">
        プロダクトごとに請求書の項目名をカスタマイズできます。
      </p>

      <div className="space-y-6 max-w-[700px]">
        {PRODUCTS.map((product) => (
          <TemplateCard
            key={product.id}
            product={product}
            template={templates.find((t) => t.product_type === product.id)}
            onSave={(t) => {
              onSave(t);
              setSaved(product.id);
              setTimeout(() => setSaved(null), 2000);
            }}
            isSaved={saved === product.id}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({
  product,
  template,
  onSave,
  isSaved,
}: {
  product: (typeof PRODUCTS)[number];
  template?: InvoiceTemplate;
  onSave: (t: Omit<InvoiceTemplate, "created_at" | "updated_at">) => void;
  isSaved: boolean;
}) {
  const [monthlyLabel, setMonthlyLabel] = useState(
    template?.monthly_label || `${product.label}月額利用料`
  );
  const [initialLabel, setInitialLabel] = useState(
    template?.initial_label || "初期導入費"
  );
  const [optionLabel, setOptionLabel] = useState(
    template?.option_label || "オプション"
  );
  const [notes, setNotes] = useState(template?.notes || "");

  const handleSave = () => {
    onSave({
      id: product.id,
      product_type: product.id,
      monthly_label: monthlyLabel,
      initial_label: initialLabel,
      option_label: optionLabel,
      notes,
    });
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div
        className="px-5 py-3 flex items-center gap-2"
        style={{ background: `${product.hex}10`, borderBottom: `2px solid ${product.hex}30` }}
      >
        <span
          className="w-3 h-3 rounded-full"
          style={{ background: product.hex }}
        />
        <span className="text-sm font-bold" style={{ color: product.hex }}>
          {product.label}
        </span>
      </div>
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-semibold text-slate-500 mb-1">
              月額料金の表示名
            </label>
            <input
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400"
              value={monthlyLabel}
              onChange={(e) => setMonthlyLabel(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-500 mb-1">
              初期導入費の表示名
            </label>
            <input
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400"
              value={initialLabel}
              onChange={(e) => setInitialLabel(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-500 mb-1">
            オプションの表示名
          </label>
          <input
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400"
            value={optionLabel}
            onChange={(e) => setOptionLabel(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-500 mb-1">
            備考（請求書下部に表示）
          </label>
          <textarea
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400 min-h-[60px] resize-y"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="お支払いに関する注意事項など"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            className="px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold cursor-pointer hover:bg-slate-700"
            onClick={handleSave}
          >
            保存
          </button>
          {isSaved && (
            <span className="text-sm text-green-600 font-medium">
              保存しました
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
