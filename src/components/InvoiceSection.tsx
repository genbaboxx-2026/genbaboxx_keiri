"use client";

import { useState, useMemo } from "react";
import type { Contract, Company, Settings } from "@/lib/database.types";
import { getInvoicesForMonth } from "@/lib/invoiceCalc";
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
  const [generating, setGenerating] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const invoices = useMemo(
    () => getInvoicesForMonth(selectedMonth, contracts, companies),
    [selectedMonth, contracts, companies]
  );

  // 月が変わったら全選択
  if (!initialized || checked.size === 0) {
    const allIds = new Set(invoices.map((i) => i.companyId));
    if (allIds.size > 0 && !initialized) {
      setChecked(allIds);
      setInitialized(true);
    }
  }

  const handleMonthChange = (m: string) => {
    setSelectedMonth(m);
    // 次のレンダーで全選択
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
    if (checked.size === invoices.length) {
      setChecked(new Set());
    } else {
      setChecked(new Set(invoices.map((i) => i.companyId)));
    }
  };

  const selectedInvoices = invoices.filter((i) => checked.has(i.companyId));
  const selectedTotal = selectedInvoices.reduce((s, i) => s + i.total, 0);

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

  return (
    <div className="mt-8">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        請求書作成
      </h3>

      {/* 月選択 */}
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
        <>
          {/* 企業一覧 */}
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
                    小計（税別）
                  </th>
                  <th className="px-3 py-2.5 text-right font-bold text-xs text-slate-600">
                    消費税
                  </th>
                  <th className="px-3 py-2.5 text-right font-bold text-xs text-slate-600">
                    合計（税込）
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr
                    key={inv.companyId}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={checked.has(inv.companyId)}
                        onChange={() => toggleCheck(inv.companyId)}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2.5 font-medium">
                      {inv.companyName}
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {inv.items.map((it) => it.description).join("、")}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      ¥{formatNumber(inv.subtotal)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
                      ¥{formatNumber(inv.tax)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                      ¥{formatNumber(inv.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 合計 + ボタン */}
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
        </>
      )}
    </div>
  );
}
