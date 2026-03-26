"use client";

import { useState, useMemo, useCallback } from "react";
import type { Contract, Company, Settings } from "@/lib/database.types";
import {
  getInvoicesForMonth,
  type CompanyInvoice,
  type InvoiceLineItem,
} from "@/lib/invoiceCalc";
import { formatNumber, getCurrentMonth } from "@/lib/calc";

interface InvoiceSectionProps {
  contracts: Contract[];
  companies: Company[];
  settings: Settings | null;
  allMonths: string[];
}

export function InvoiceSection({
  contracts,
  companies,
  settings,
  allMonths,
}: InvoiceSectionProps) {
  const currentMonth = getCurrentMonth();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [customItems, setCustomItems] = useState<
    Record<string, InvoiceLineItem[]>
  >({});
  const [generating, setGenerating] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const baseInvoices = useMemo(
    () => getInvoicesForMonth(selectedMonth, contracts, companies),
    [selectedMonth, contracts, companies]
  );

  // カスタム項目を反映した請求データ
  const invoices: CompanyInvoice[] = useMemo(
    () =>
      baseInvoices.map((inv) => {
        const extra = customItems[inv.companyId] || [];
        const allItems = [...inv.items, ...extra];
        const subtotal = allItems.reduce((s, i) => s + i.amount, 0);
        const tax = Math.floor(subtotal * 0.1);
        return { ...inv, items: allItems, subtotal, tax, total: subtotal + tax };
      }),
    [baseInvoices, customItems]
  );

  if (!initialized && invoices.length > 0) {
    setChecked(new Set(invoices.map((i) => i.companyId)));
    setInitialized(true);
  }

  const handleMonthChange = (m: string) => {
    setSelectedMonth(m);
    setCustomItems({});
    setExpandedId(null);
    setTimeout(() => {
      const inv = getInvoicesForMonth(m, contracts, companies);
      setChecked(new Set(inv.map((i) => i.companyId)));
    }, 0);
  };

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (checked.size === invoices.length) setChecked(new Set());
    else setChecked(new Set(invoices.map((i) => i.companyId)));
  };

  const addCustomItem = (companyId: string) => {
    setCustomItems((prev) => ({
      ...prev,
      [companyId]: [
        ...(prev[companyId] || []),
        { description: "", quantity: 1, unitPrice: 0, amount: 0 },
      ],
    }));
  };

  const updateCustomItem = (
    companyId: string,
    index: number,
    field: keyof InvoiceLineItem,
    value: string | number
  ) => {
    setCustomItems((prev) => {
      const items = [...(prev[companyId] || [])];
      const item = { ...items[index] };
      if (field === "description") {
        item.description = value as string;
      } else if (field === "quantity") {
        item.quantity = Number(value) || 0;
        item.amount = item.quantity * item.unitPrice;
      } else if (field === "unitPrice") {
        item.unitPrice = Number(value) || 0;
        item.amount = item.quantity * item.unitPrice;
      }
      items[index] = item;
      return { ...prev, [companyId]: items };
    });
  };

  const removeCustomItem = (companyId: string, index: number) => {
    setCustomItems((prev) => {
      const items = [...(prev[companyId] || [])];
      items.splice(index, 1);
      return { ...prev, [companyId]: items };
    });
  };

  const selectedInvoices = invoices.filter((i) => checked.has(i.companyId));
  const selectedTotal = selectedInvoices.reduce((s, i) => s + i.total, 0);
  const previewInvoice = invoices.find((i) => i.companyId === expandedId);

  const handleGenerate = async () => {
    if (!settings || selectedInvoices.length === 0) return;
    setGenerating(true);
    try {
      const { generateInvoicePDF } = await import("@/lib/invoice");
      await generateInvoicePDF(settings, selectedInvoices, selectedMonth);
    } catch (e) {
      console.error(e);
      alert("PDF生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const today = new Date();
  const issueDate = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="mt-8">
      <h3 className="text-lg font-bold mb-4">請求書作成</h3>

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-semibold text-slate-600">対象月:</label>
        <select
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
          value={selectedMonth}
          onChange={(e) => handleMonthChange(e.target.value)}
        >
          {allMonths.map((m) => (
            <option key={m} value={m}>
              {m.split("-")[0]}年{parseInt(m.split("-")[1])}月
            </option>
          ))}
        </select>
      </div>

      {!settings?.company_name && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          請求書を作成するには、設定ページで自社情報を登録してください。
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl">
          この月に請求対象の企業はありません
        </div>
      ) : (
        <div className="flex gap-6">
          {/* 左: 企業一覧 */}
          <div className="flex-1 min-w-0">
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-slate-200">
                    <th className="px-3 py-2.5 text-left w-10">
                      <input
                        type="checkbox"
                        checked={checked.size === invoices.length}
                        onChange={toggleAll}
                        className="cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left font-bold text-xs text-slate-600">
                      企業名
                    </th>
                    <th className="px-3 py-2.5 text-right font-bold text-xs text-slate-600">
                      合計（税込）
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const isExpanded = expandedId === inv.companyId;
                    const extras = customItems[inv.companyId] || [];
                    return (
                      <CompanyRow
                        key={inv.companyId}
                        inv={inv}
                        isExpanded={isExpanded}
                        isChecked={checked.has(inv.companyId)}
                        extras={extras}
                        onToggleCheck={() => toggleCheck(inv.companyId)}
                        onToggleExpand={() =>
                          setExpandedId(isExpanded ? null : inv.companyId)
                        }
                        onAddItem={() => addCustomItem(inv.companyId)}
                        onUpdateItem={(i, f, v) =>
                          updateCustomItem(inv.companyId, i, f, v)
                        }
                        onRemoveItem={(i) =>
                          removeCustomItem(inv.companyId, i)
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                {selectedInvoices.length}社選択 / 合計{" "}
                <span className="font-bold text-slate-800">
                  ¥{formatNumber(selectedTotal)}
                </span>
                （税込）
              </div>
              <button
                className="px-6 py-2.5 bg-slate-800 text-white rounded-[10px] text-sm font-semibold cursor-pointer hover:bg-slate-700 disabled:opacity-40"
                disabled={
                  generating ||
                  selectedInvoices.length === 0 ||
                  !settings?.company_name
                }
                onClick={handleGenerate}
              >
                {generating
                  ? "生成中..."
                  : `選択した${selectedInvoices.length}社の請求書を作成`}
              </button>
            </div>
          </div>

          {/* 右: プレビュー */}
          {previewInvoice && settings && (
            <div className="w-[380px] flex-shrink-0">
              <InvoicePreview
                inv={previewInvoice}
                settings={settings}
                issueDate={issueDate}
                month={selectedMonth}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 企業行（アコーディオン） */
function CompanyRow({
  inv,
  isExpanded,
  isChecked,
  extras,
  onToggleCheck,
  onToggleExpand,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: {
  inv: CompanyInvoice;
  isExpanded: boolean;
  isChecked: boolean;
  extras: InvoiceLineItem[];
  onToggleCheck: () => void;
  onToggleExpand: () => void;
  onAddItem: () => void;
  onUpdateItem: (
    index: number,
    field: keyof InvoiceLineItem,
    value: string | number
  ) => void;
  onRemoveItem: (index: number) => void;
}) {
  const baseItemCount = inv.items.length - extras.length;

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50">
        <td className="px-3 py-2.5">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={onToggleCheck}
            className="cursor-pointer"
          />
        </td>
        <td
          className="px-3 py-2.5 cursor-pointer"
          onClick={onToggleExpand}
        >
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">
              {isExpanded ? "▼" : "▶"}
            </span>
            <div>
              <div className="font-medium">{inv.companyName}</div>
              <div className="text-[10px] text-slate-400">
                {inv.items.map((it) => it.description).filter(Boolean).join("、")}
              </div>
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
          ¥{formatNumber(inv.total)}
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={3} className="px-6 py-3 bg-slate-50/70">
            <div className="space-y-1.5">
              {/* 自動計算された項目（読み取り専用） */}
              {inv.items.slice(0, baseItemCount).map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs text-slate-600"
                >
                  <span className="flex-1">{item.description}</span>
                  <span className="w-12 text-right">{item.quantity}</span>
                  <span className="w-20 text-right">
                    ¥{formatNumber(item.unitPrice)}
                  </span>
                  <span className="w-24 text-right font-semibold">
                    ¥{formatNumber(item.amount)}
                  </span>
                  <span className="w-6" />
                </div>
              ))}

              {/* カスタム項目（編集可能） */}
              {extras.map((item, i) => (
                <div
                  key={`custom-${i}`}
                  className="flex items-center gap-2 text-xs"
                >
                  <input
                    className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs"
                    placeholder="品目名"
                    value={item.description}
                    onChange={(e) =>
                      onUpdateItem(i, "description", e.target.value)
                    }
                  />
                  <input
                    className="w-12 px-1 py-1 border border-slate-200 rounded text-xs text-right"
                    type="number"
                    value={item.quantity || ""}
                    onChange={(e) =>
                      onUpdateItem(i, "quantity", e.target.value)
                    }
                  />
                  <input
                    className="w-20 px-1 py-1 border border-slate-200 rounded text-xs text-right"
                    type="number"
                    placeholder="単価"
                    value={item.unitPrice || ""}
                    onChange={(e) =>
                      onUpdateItem(i, "unitPrice", e.target.value)
                    }
                  />
                  <span className="w-24 text-right font-semibold tabular-nums">
                    ¥{formatNumber(item.amount)}
                  </span>
                  <button
                    className="w-6 text-red-400 hover:text-red-600 cursor-pointer bg-transparent border-none text-xs"
                    onClick={() => onRemoveItem(i)}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                className="text-[11px] text-blue-600 hover:text-blue-800 cursor-pointer bg-transparent border-none mt-1"
                onClick={onAddItem}
              >
                + 項目を追加
              </button>

              <div className="border-t border-slate-200 pt-2 mt-2 flex justify-end gap-6 text-xs">
                <span className="text-slate-500">
                  小計 ¥{formatNumber(inv.subtotal)}
                </span>
                <span className="text-slate-500">
                  税 ¥{formatNumber(inv.tax)}
                </span>
                <span className="font-bold">
                  合計 ¥{formatNumber(inv.total)}
                </span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** 請求書プレビュー */
function InvoicePreview({
  inv,
  settings,
  issueDate,
  month,
}: {
  inv: CompanyInvoice;
  settings: Settings;
  issueDate: string;
  month: string;
}) {
  const [y, m] = month.split("-");
  return (
    <div className="border border-slate-300 rounded-lg bg-white shadow-sm p-5 text-[10px] leading-relaxed sticky top-4">
      <div className="text-center text-base font-bold border-b border-slate-800 pb-2 mb-3">
        請求書
      </div>

      <div className="flex justify-between mb-4">
        <div>
          <div className="text-sm font-bold">{inv.companyName} 御中</div>
        </div>
        <div className="text-right text-[9px] text-slate-500">
          <div>発行日: {issueDate}</div>
          {settings.invoice_number && (
            <div>登録番号: {settings.invoice_number}</div>
          )}
        </div>
      </div>

      <div className="text-right mb-4 text-[9px]">
        <div className="font-bold">{settings.company_name}</div>
        {settings.company_address && (
          <div className="whitespace-pre-line">{settings.company_address}</div>
        )}
        {settings.company_phone && <div>TEL: {settings.company_phone}</div>}
      </div>

      <div className="mb-3">
        <span className="text-[9px] text-slate-500">
          対象: {y}年{parseInt(m)}月分
        </span>
      </div>

      <div className="bg-slate-50 rounded px-2 py-1.5 mb-3 text-center">
        <span className="text-[9px] text-slate-500">ご請求金額（税込）</span>
        <div className="text-sm font-bold">
          ¥{formatNumber(inv.total)}
        </div>
      </div>

      {/* 明細 */}
      <table className="w-full border-collapse mb-3">
        <thead>
          <tr className="bg-slate-700 text-white">
            {["品目", "数量", "単価", "金額"].map((h) => (
              <th key={h} className="px-1.5 py-1 text-[8px] font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inv.items
            .filter((it) => it.amount > 0 || it.description)
            .map((item, i) => (
              <tr key={i} className="border-b border-slate-200">
                <td className="px-1.5 py-1">{item.description}</td>
                <td className="px-1.5 py-1 text-right">{item.quantity}</td>
                <td className="px-1.5 py-1 text-right">
                  ¥{formatNumber(item.unitPrice)}
                </td>
                <td className="px-1.5 py-1 text-right font-medium">
                  ¥{formatNumber(item.amount)}
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {/* 合計 */}
      <div className="flex flex-col items-end gap-0.5 mb-3 text-[9px]">
        <div className="flex gap-4">
          <span className="text-slate-500">小計</span>
          <span>¥{formatNumber(inv.subtotal)}</span>
        </div>
        <div className="flex gap-4">
          <span className="text-slate-500">消費税(10%)</span>
          <span>¥{formatNumber(inv.tax)}</span>
        </div>
        <div className="flex gap-4 font-bold border-t border-slate-300 pt-0.5">
          <span>合計</span>
          <span>¥{formatNumber(inv.total)}</span>
        </div>
      </div>

      {/* 振込先 */}
      {settings.bank_info && (
        <div className="border-t border-slate-200 pt-2 text-[8px] text-slate-600">
          <div className="font-bold mb-0.5">お振込先</div>
          <div className="whitespace-pre-line">{settings.bank_info}</div>
        </div>
      )}
    </div>
  );
}
