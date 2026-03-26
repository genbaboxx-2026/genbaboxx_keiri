"use client";

import { useState, useMemo, useCallback } from "react";
import type { Contract, Company, Settings, InvoiceTemplate } from "@/lib/database.types";
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
  invoiceTemplate?: InvoiceTemplate;
  allMonths: string[];
}

export function InvoiceSection({
  contracts,
  companies,
  settings,
  invoiceTemplate,
  allMonths,
}: InvoiceSectionProps) {
  const currentMonth = getCurrentMonth();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [customItems, setCustomItems] = useState<
    Record<string, InvoiceLineItem[]>
  >({});
  const [baseOverrides, setBaseOverrides] = useState<
    Record<string, Record<number, Partial<InvoiceLineItem>>>
  >({});
  const [generating, setGenerating] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const baseInvoices = useMemo(
    () => getInvoicesForMonth(selectedMonth, contracts, companies, invoiceTemplate),
    [selectedMonth, contracts, companies, invoiceTemplate]
  );

  // カスタム項目を反映した請求データ
  const invoices: CompanyInvoice[] = useMemo(
    () =>
      baseInvoices.map((inv) => {
        const overrides = baseOverrides[inv.companyId] || {};
        const baseItems = inv.items.map((item, idx) => {
          const ov = overrides[idx];
          if (!ov) return item;
          const merged = { ...item, ...ov };
          if (ov.quantity !== undefined || ov.unitPrice !== undefined) {
            merged.amount = (merged.quantity || 0) * (merged.unitPrice || 0);
          }
          return merged;
        });
        const extra = customItems[inv.companyId] || [];
        const allItems = [...baseItems, ...extra];
        const subtotal = allItems.reduce((s, i) => s + i.amount, 0);
        const tax = allItems.reduce((s, i) => s + Math.floor(i.amount * ((i.taxRate ?? 10) / 100)), 0);
        return { ...inv, items: allItems, subtotal, tax, total: subtotal + tax };
      }),
    [baseInvoices, customItems, baseOverrides]
  );

  if (!initialized && invoices.length > 0) {
    setChecked(new Set(invoices.map((i) => i.companyId)));
    setInitialized(true);
  }

  const handleMonthChange = (m: string) => {
    setSelectedMonth(m);
    setCustomItems({});
    setBaseOverrides({});
    setExpandedId(null);
    setTimeout(() => {
      const inv = getInvoicesForMonth(m, contracts, companies, invoiceTemplate);
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
        { description: "", quantity: 1, unit: "", unitPrice: 0, taxRate: 10, amount: 0 },
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
      } else if (field === "unit") {
        item.unit = value as string;
      } else if (field === "quantity") {
        item.quantity = Number(value) || 0;
        item.amount = item.quantity * item.unitPrice;
      } else if (field === "unitPrice") {
        item.unitPrice = Number(value) || 0;
        item.amount = item.quantity * item.unitPrice;
      } else if (field === "taxRate") {
        item.taxRate = Number(value);
      }
      items[index] = item;
      return { ...prev, [companyId]: items };
    });
  };

  const updateBaseItem = (
    companyId: string,
    index: number,
    field: keyof InvoiceLineItem,
    value: string | number
  ) => {
    setBaseOverrides((prev) => {
      const companyOv = { ...(prev[companyId] || {}) };
      const itemOv = { ...(companyOv[index] || {}) };
      if (field === "description" || field === "unit") {
        (itemOv as Record<string, unknown>)[field] = value;
      } else {
        (itemOv as Record<string, unknown>)[field] = Number(value) || 0;
      }
      companyOv[index] = itemOv;
      return { ...prev, [companyId]: companyOv };
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
      await generateInvoicePDF(settings, selectedInvoices, selectedMonth, invoiceTemplate?.notes);
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
                        onUpdateBaseItem={(i, f, v) =>
                          updateBaseItem(inv.companyId, i, f, v)
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
            <div className="w-[340px] flex-shrink-0">
              <div className="relative">
                <button
                  className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center bg-white border border-slate-300 rounded text-slate-500 hover:text-slate-800 cursor-pointer text-xs shadow-sm"
                  onClick={() => setShowFullPreview(true)}
                  title="拡大表示"
                >
                  ⛶
                </button>
                <InvoicePreview
                  inv={previewInvoice}
                  settings={settings}
                  issueDate={issueDate}
                  month={selectedMonth}
                  notes={invoiceTemplate?.notes}
                />
              </div>
            </div>
          )}

          {/* 拡大プレビューモーダル */}
          {showFullPreview && previewInvoice && settings && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
              onClick={() => setShowFullPreview(false)}
            >
              <div
                className="w-[600px] max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white rounded-full text-slate-500 hover:text-slate-800 cursor-pointer text-lg shadow"
                  onClick={() => setShowFullPreview(false)}
                >
                  ✕
                </button>
                <InvoicePreview
                  inv={previewInvoice}
                  settings={settings}
                  issueDate={issueDate}
                  month={selectedMonth}
                  notes={invoiceTemplate?.notes}
                  large
                />
              </div>
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
  onUpdateBaseItem,
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
  onUpdateBaseItem: (
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
          <td colSpan={3} className="p-0">
            <div className="border-t border-slate-200">
              <table className="w-full text-xs" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "28px" }} />
                  <col />
                  <col style={{ width: "60px" }} />
                  <col style={{ width: "52px" }} />
                  <col style={{ width: "90px" }} />
                  <col style={{ width: "56px" }} />
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "28px" }} />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-1 py-2 text-center text-slate-400">#</th>
                    <th className="px-2 py-2 text-left font-semibold text-slate-500">摘要</th>
                    <th className="px-1 py-2 text-center font-semibold text-slate-500">数量</th>
                    <th className="px-1 py-2 text-center font-semibold text-slate-500">単位</th>
                    <th className="px-1 py-2 text-right font-semibold text-slate-500">単価</th>
                    <th className="px-1 py-2 text-center font-semibold text-slate-500">税率</th>
                    <th className="px-1 py-2 text-right font-semibold text-slate-500">金額</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...inv.items.slice(0, baseItemCount).map((item, i) => ({ item, i, isBase: true })),
                    ...extras.map((item, i) => ({ item, i, isBase: false }))].map(({ item, i, isBase }) => (
                    <tr key={isBase ? i : `c-${i}`} className={`border-b border-slate-100 ${!isBase ? "bg-blue-50/30" : ""}`}>
                      <td className={`px-1 py-1 text-center ${isBase ? "text-slate-300" : "text-blue-400"}`}>
                        {isBase ? i + 1 : baseItemCount + i + 1}
                      </td>
                      <td className="px-1 py-1 overflow-hidden">
                        <input
                          className="w-full px-1.5 py-1 border border-slate-200 rounded bg-white text-xs outline-none focus:border-blue-400 min-w-0"
                          value={item.description}
                          onChange={(e) => isBase
                            ? onUpdateBaseItem(i, "description", e.target.value)
                            : onUpdateItem(i, "description", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-0.5 py-1">
                        <input
                          className="w-full px-1 py-1 border border-slate-200 rounded bg-white text-xs text-center outline-none focus:border-blue-400 min-w-0"
                          type="number"
                          value={item.quantity || ""}
                          onChange={(e) => isBase
                            ? onUpdateBaseItem(i, "quantity", e.target.value)
                            : onUpdateItem(i, "quantity", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-0.5 py-1">
                        <input
                          className="w-full px-1 py-1 border border-slate-200 rounded bg-white text-xs text-center outline-none focus:border-blue-400 min-w-0"
                          value={item.unit || ""}
                          onChange={(e) => isBase
                            ? onUpdateBaseItem(i, "unit", e.target.value)
                            : onUpdateItem(i, "unit", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-0.5 py-1">
                        <input
                          className="w-full px-1 py-1 border border-slate-200 rounded bg-white text-xs text-right outline-none focus:border-blue-400 min-w-0"
                          type="number"
                          value={item.unitPrice || ""}
                          onChange={(e) => isBase
                            ? onUpdateBaseItem(i, "unitPrice", e.target.value)
                            : onUpdateItem(i, "unitPrice", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-0.5 py-1">
                        <select
                          className="w-full px-0 py-1 border border-slate-200 rounded bg-white text-xs outline-none focus:border-blue-400 min-w-0"
                          value={item.taxRate ?? 10}
                          onChange={(e) => isBase
                            ? onUpdateBaseItem(i, "taxRate", Number(e.target.value))
                            : onUpdateItem(i, "taxRate", Number(e.target.value))
                          }
                        >
                          <option value={10}>10%</option>
                          <option value={8}>8%</option>
                          <option value={0}>0%</option>
                        </select>
                      </td>
                      <td className="px-1 py-1 text-right tabular-nums font-semibold whitespace-nowrap overflow-hidden">
                        ¥{formatNumber(item.amount)}
                      </td>
                      <td className="px-0.5 py-1">
                        {!isBase && (
                          <button
                            className="text-red-400 hover:text-red-600 cursor-pointer bg-transparent border-none text-xs"
                            onClick={() => onRemoveItem(i)}
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50/50 border-t border-slate-100">
                <button
                  className="text-[11px] text-blue-600 hover:text-blue-800 cursor-pointer bg-transparent border-none font-semibold"
                  onClick={onAddItem}
                >
                  + 項目を追加
                </button>
                <div className="flex gap-5 text-xs">
                  <span className="text-slate-500">小計 <span className="tabular-nums">¥{formatNumber(inv.subtotal)}</span></span>
                  <span className="text-slate-500">消費税 <span className="tabular-nums">¥{formatNumber(inv.tax)}</span></span>
                  <span className="font-bold">合計 <span className="tabular-nums">¥{formatNumber(inv.total)}</span></span>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** 請求書プレビュー（実際のPDFレイアウトに近い表示） */
function InvoicePreview({
  inv,
  settings,
  issueDate,
  month,
  notes,
  large,
}: {
  inv: CompanyInvoice;
  settings: Settings;
  issueDate: string;
  month: string;
  notes?: string;
  large?: boolean;
}) {
  const visibleItems = inv.items.filter((it) => it.amount > 0 || it.description);
  const emptyRows = Math.max(0, 8 - visibleItems.length);
  const baseText = large ? "text-[11px]" : "text-[8px]";
  const titleSize = large ? "text-xl" : "text-base";
  const nameSize = large ? "text-sm" : "text-[10px]";
  const amountSize = large ? "text-xl" : "text-[14px]";
  const companySize = large ? "text-[13px]" : "text-[9px]";
  const smallText = large ? "text-[10px]" : "text-[7px]";
  const padding = large ? "p-8" : "p-4";

  return (
    <div className={`border border-slate-300 rounded bg-white shadow-sm ${large ? "" : "sticky top-4"} ${baseText} leading-relaxed`} style={large ? undefined : { aspectRatio: "210/297" }}>
      <div className={`${padding} h-full flex flex-col overflow-hidden`}>
        {/* タイトル */}
        <div className="text-center mb-4">
          <div className={`${titleSize} font-bold`}>請求書</div>
          <div className="w-10 mx-auto border-b border-slate-800 mt-1" />
        </div>

        {/* 上部: 請求先 + 自社情報 */}
        <div className="flex justify-between mb-4">
          <div>
            <div className={`${nameSize} font-bold`}>{inv.companyName} 御中</div>
            <div className="border-b border-slate-800 mt-0.5 w-28" />
          </div>
          <div className={`text-right ${baseText} text-slate-600`}>
            <div>請求日　{issueDate}</div>
            {settings.invoice_number && (
              <div>登録番号　{settings.invoice_number}</div>
            )}
          </div>
        </div>

        {/* 自社情報 右寄せ */}
        <div className={`text-right ${baseText} mb-3`}>
          {settings.logo_url && (
            <div className="flex justify-end mb-1">
              <img src={settings.logo_url} alt="ロゴ" className={large ? "h-10" : "h-6"} />
            </div>
          )}
          <div className={`font-bold ${companySize}`}>{settings.company_name}</div>
          <div className="flex justify-end items-start gap-1">
            <div>
              {settings.company_address && (
                <div className="whitespace-pre-line text-slate-600">{settings.company_address}</div>
              )}
              {settings.company_phone && (
                <div className="text-slate-600">TEL: {settings.company_phone}</div>
              )}
            </div>
            {settings.stamp_url && (
              <img src={settings.stamp_url} alt="社印" className={`${large ? "h-12 w-12" : "h-8 w-8"} object-contain`} />
            )}
          </div>
        </div>

        {/* 「下記の通り...」 */}
        <div className={`${baseText} text-slate-600 mb-3`}>
          下記の通りご請求申し上げます。
        </div>

        {/* 請求金額 */}
        <div className="mb-4">
          <div className={`${baseText} text-slate-500 mb-1`}>請求金額</div>
          <div className={`${amountSize} font-bold`}>
            {formatNumber(inv.total)}円
          </div>
          <div className="border-b-2 border-slate-800 w-24 mt-0.5" />
        </div>

        {/* 明細テーブル */}
        <table className="w-full border-collapse border border-slate-400 mb-3 text-[8px]">
          <thead>
            <tr>
              {["摘要", "数量", "単価", "明細金額"].map((h) => (
                <th key={h} className="border border-slate-400 px-1.5 py-1 font-normal bg-white text-center">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item, i) => (
              <tr key={i}>
                <td className="border border-slate-400 px-1.5 py-1">{item.description}</td>
                <td className="border border-slate-400 px-1.5 py-1 text-right">{item.quantity}{item.unit}</td>
                <td className="border border-slate-400 px-1.5 py-1 text-right">{formatNumber(item.unitPrice)}</td>
                <td className="border border-slate-400 px-1.5 py-1 text-right">{formatNumber(item.amount)}</td>
              </tr>
            ))}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <tr key={`empty-${i}`}>
                <td className="border border-slate-400 px-1.5 py-1">&nbsp;</td>
                <td className="border border-slate-400 px-1.5 py-1">&nbsp;</td>
                <td className="border border-slate-400 px-1.5 py-1">&nbsp;</td>
                <td className="border border-slate-400 px-1.5 py-1">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 下部: 振込先 + 合計 */}
        <div className="flex justify-between mt-auto">
          {/* 左: 振込先 */}
          <div className={baseText}>
            <div className="text-slate-500 mb-0.5">振込先</div>
            <div className="whitespace-pre-line">
              {settings.bank_info || "（設定ページで登録してください）"}
            </div>
          </div>

          {/* 右: 合計テーブル */}
          <table className={`border-collapse border border-slate-400 ${baseText}`}>
            <tbody>
              <tr>
                <td className="border border-slate-400 px-2 py-0.5">小計</td>
                <td className="border border-slate-400 px-2 py-0.5 text-right">{formatNumber(inv.subtotal)}円</td>
              </tr>
              <tr>
                <td className="border border-slate-400 px-2 py-0.5">消費税</td>
                <td className="border border-slate-400 px-2 py-0.5 text-right">{formatNumber(inv.tax)}円</td>
              </tr>
              <tr className="font-bold">
                <td className="border border-slate-400 px-2 py-0.5">合計</td>
                <td className="border border-slate-400 px-2 py-0.5 text-right">{formatNumber(inv.total)}円</td>
              </tr>
              <tr>
                <td className={`border border-slate-400 px-2 py-0.5 ${smallText}`}>内訳 10%対象(税抜)</td>
                <td className={`border border-slate-400 px-2 py-0.5 text-right ${smallText}`}>{formatNumber(inv.subtotal)}円</td>
              </tr>
              <tr>
                <td className={`border border-slate-400 px-2 py-0.5 ${smallText}`}>　　 10%消費税</td>
                <td className={`border border-slate-400 px-2 py-0.5 text-right ${smallText}`}>{formatNumber(inv.tax)}円</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 備考 */}
        <div className={`mt-2 border border-slate-400 px-2 py-1.5 ${baseText}`}>
          <div className="text-slate-500 mb-0.5">備考</div>
          <div className="whitespace-pre-line min-h-[1.5em]">
            {notes || ""}
          </div>
        </div>
      </div>
    </div>
  );
}
