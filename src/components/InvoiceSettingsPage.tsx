"use client";

import { useState } from "react";
import type { InvoiceTemplate, PresetItem } from "@/lib/database.types";
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
      <h2 className="text-[22px] font-extrabold mb-2">請求書設定</h2>
      <p className="text-sm text-slate-500 mb-6">
        プロダクトごとに請求書の明細行をプリセットできます。
      </p>

      <div className="space-y-6 max-w-[800px]">
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
  const [presetItems, setPresetItems] = useState<PresetItem[]>(() => {
    try {
      return template?.preset_items ? JSON.parse(template.preset_items) : [];
    } catch {
      return [];
    }
  });

  const addPresetItem = () => {
    setPresetItems((prev) => [
      ...prev,
      { description: "", defaultQuantity: 1, defaultUnitPrice: 0 },
    ]);
  };

  const updatePresetItem = (
    index: number,
    field: keyof PresetItem,
    value: string | number
  ) => {
    setPresetItems((prev) => {
      const items = [...prev];
      items[index] = { ...items[index], [field]: value };
      return items;
    });
  };

  const removePresetItem = (index: number) => {
    setPresetItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave({
      id: product.id,
      product_type: product.id,
      monthly_label: monthlyLabel,
      initial_label: initialLabel,
      option_label: optionLabel,
      notes,
      preset_items: JSON.stringify(presetItems),
    });
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div
        className="px-5 py-3 flex items-center gap-2"
        style={{
          background: `${product.hex}10`,
          borderBottom: `2px solid ${product.hex}30`,
        }}
      >
        <span
          className="w-3 h-3 rounded-full"
          style={{ background: product.hex }}
        />
        <span className="text-sm font-bold" style={{ color: product.hex }}>
          {product.label}
        </span>
      </div>
      <div className="p-5">
        {/* 明細行テーブル */}
        <div className="text-xs font-bold text-slate-500 mb-2">
          請求明細のプリセット行
        </div>
        <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2 text-left text-xs font-bold text-slate-600">
                  種類
                </th>
                <th className="px-3 py-2 text-left text-xs font-bold text-slate-600">
                  表示名
                </th>
                <th className="px-3 py-2 text-xs font-bold text-slate-600 w-8" />
              </tr>
            </thead>
            <tbody>
              {/* 固定3行: 月額/初期/オプション */}
              <tr className="border-b border-slate-100">
                <td className="px-3 py-2 text-xs text-slate-500">月額料金</td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-blue-400"
                    value={monthlyLabel}
                    onChange={(e) => setMonthlyLabel(e.target.value)}
                  />
                </td>
                <td />
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-3 py-2 text-xs text-slate-500">初期導入費</td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-blue-400"
                    value={initialLabel}
                    onChange={(e) => setInitialLabel(e.target.value)}
                  />
                </td>
                <td />
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-3 py-2 text-xs text-slate-500">オプション</td>
                <td className="px-3 py-1.5">
                  <input
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-blue-400"
                    value={optionLabel}
                    onChange={(e) => setOptionLabel(e.target.value)}
                  />
                </td>
                <td />
              </tr>

              {/* カスタム行 */}
              {presetItems.map((item, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-xs text-blue-500">カスタム</td>
                  <td className="px-3 py-1.5">
                    <div className="flex gap-2">
                      <input
                        className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm outline-none focus:border-blue-400"
                        value={item.description}
                        onChange={(e) =>
                          updatePresetItem(i, "description", e.target.value)
                        }
                        placeholder="項目名（例: 交通費）"
                      />
                      <input
                        className="w-16 px-2 py-1.5 border border-slate-200 rounded text-sm text-right outline-none focus:border-blue-400"
                        type="number"
                        value={item.defaultQuantity || ""}
                        onChange={(e) =>
                          updatePresetItem(
                            i,
                            "defaultQuantity",
                            Number(e.target.value) || 0
                          )
                        }
                        placeholder="数量"
                      />
                      <input
                        className="w-24 px-2 py-1.5 border border-slate-200 rounded text-sm text-right outline-none focus:border-blue-400"
                        type="number"
                        value={item.defaultUnitPrice || ""}
                        onChange={(e) =>
                          updatePresetItem(
                            i,
                            "defaultUnitPrice",
                            Number(e.target.value) || 0
                          )
                        }
                        placeholder="単価"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      className="text-red-400 hover:text-red-600 cursor-pointer bg-transparent border-none text-xs"
                      onClick={() => removePresetItem(i)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            className="w-full px-3 py-2 text-[12px] text-blue-600 hover:bg-blue-50 cursor-pointer bg-transparent border-none text-left font-semibold"
            onClick={addPresetItem}
          >
            + 行を追加
          </button>
        </div>

        {/* 備考 */}
        <div className="mb-4">
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
