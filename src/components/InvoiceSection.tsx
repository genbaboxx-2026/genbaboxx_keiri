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
  const [deletedBaseItems, setDeletedBaseItems] = useState<Record<string, Set<number>>>({});
  const [generating, setGenerating] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const getLastBusinessDay = (month: string) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m, 0); // 月末日
    const dow = d.getDay();
    if (dow === 0) d.setDate(d.getDate() - 2); // 日曜→金曜
    if (dow === 6) d.setDate(d.getDate() - 1); // 土曜→金曜
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const [dueDate, setDueDate] = useState(() => getLastBusinessDay(currentMonth));
  const [dueDates, setDueDates] = useState<Record<string, string>>({});
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendChecked, setSendChecked] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "preview">("list");
  const [previewIndex, setPreviewIndex] = useState(0);

  const baseInvoices = useMemo(
    () => getInvoicesForMonth(selectedMonth, contracts, companies, invoiceTemplate),
    [selectedMonth, contracts, companies, invoiceTemplate]
  );

  // カスタム項目を反映した請求データ
  const invoices: CompanyInvoice[] = useMemo(
    () =>
      baseInvoices.map((inv) => {
        const overrides = baseOverrides[inv.companyId] || {};
        const deleted = deletedBaseItems[inv.companyId] || new Set<number>();
        const baseItems = inv.items
          .map((item, idx) => {
            if (deleted.has(idx)) return null;
            const ov = overrides[idx];
            if (!ov) return item;
            const merged = { ...item, ...ov };
            if (ov.quantity !== undefined || ov.unitPrice !== undefined) {
              merged.amount = (merged.quantity || 0) * (merged.unitPrice || 0);
            }
            return merged;
          })
          .filter((item): item is InvoiceLineItem => item !== null);
        const extra = customItems[inv.companyId] || [];
        const allItems = [...baseItems, ...extra];
        const subtotal = allItems.reduce((s, i) => s + i.amount, 0);
        const tax = allItems.reduce((s, i) => s + Math.floor(i.amount * ((i.taxRate ?? 10) / 100)), 0);
        return { ...inv, items: allItems, subtotal, tax, total: subtotal + tax };
      }),
    [baseInvoices, customItems, baseOverrides, deletedBaseItems]
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
    setDueDate(getLastBusinessDay(m));
    setDueDates({});
    setDeletedBaseItems({});
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

  // 企業IDから企業情報を取得
  const getCompany = useCallback(
    (companyId: string) => companies.find((c) => c.id === companyId),
    [companies]
  );

  const monthLabel = `${selectedMonth.split("-")[0]}年${parseInt(selectedMonth.split("-")[1])}月`;

  const buildDefaultEmailBody = useCallback(() => {
    const companyName = settings?.company_name || "";
    return `いつもお世話になっております。\n${companyName}です。\n\n${monthLabel}分の請求書を添付にてお送りいたします。\nご確認のほど、よろしくお願いいたします。\n\n何かご不明な点がございましたら、お気軽にお問い合わせください。\n\n${companyName}`;
  }, [settings, monthLabel]);

  const handleOpenConfirm = () => {
    setEmailSubject(`【${settings?.company_name || ""}】${monthLabel}分 請求書送付のご案内`);
    setEmailBody(buildDefaultEmailBody());
    setSendChecked(new Set(selectedInvoices.map((i) => i.companyId)));
    setShowSendConfirm(true);
  };

  const handleGenerate = async () => {
    if (!settings || selectedInvoices.length === 0) return;
    setGenerating(true);
    try {
      const { generateInvoicePDF } = await import("@/lib/invoice");
      await generateInvoicePDF(settings, selectedInvoices, selectedMonth, invoiceTemplate?.notes, dueDate);
      setShowSendConfirm(false);
    } catch (e) {
      console.error(e);
      alert("PDF生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateSingle = async (inv: CompanyInvoice) => {
    if (!settings) return;
    setGenerating(true);
    try {
      const { generateInvoicePDF } = await import("@/lib/invoice");
      await generateInvoicePDF(settings, [inv], selectedMonth, invoiceTemplate?.notes, dueDate);
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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold">請求書作成</h3>
        {invoices.length > 0 && (
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            <button
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                viewMode === "list"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "bg-transparent text-slate-500 hover:text-slate-700"
              }`}
              onClick={() => setViewMode("list")}
            >
              一覧表示
            </button>
            <button
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                viewMode === "preview"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "bg-transparent text-slate-500 hover:text-slate-700"
              }`}
              onClick={() => { setViewMode("preview"); setPreviewIndex(0); }}
            >
              プレビュー
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center gap-6">
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-600">入金期日:</label>
          <input
            type="date"
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
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
      ) : viewMode === "list" ? (
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
                        companyDueDate={dueDates[inv.companyId] ?? dueDate}
                        onDueDateChange={(v) => setDueDates((prev) => ({ ...prev, [inv.companyId]: v }))}
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
                        onDeleteBaseItem={(i) =>
                          setDeletedBaseItems((prev) => {
                            const s = new Set(prev[inv.companyId] || []);
                            s.add(i);
                            return { ...prev, [inv.companyId]: s };
                          })
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-start justify-between">
              <div className="text-sm text-slate-600 pt-2">
                {selectedInvoices.length}社選択 / 合計{" "}
                <span className="font-bold text-slate-800">
                  ¥{formatNumber(selectedTotal)}
                </span>
                （税込）
              </div>
              <div className="flex flex-col items-end gap-2 w-[300px]">
                <button
                  className="w-full py-2.5 bg-slate-100 border border-slate-300 rounded-[10px] text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-200 disabled:opacity-40"
                  disabled={
                    generating ||
                    selectedInvoices.length === 0 ||
                    !settings?.company_name
                  }
                  onClick={handleGenerate}
                >
                  {generating ? "生成中..." : `全${selectedInvoices.length}社を一括PDFダウンロード`}
                </button>
                <button
                  className="w-full py-3 bg-slate-800 text-white rounded-[10px] text-sm font-bold cursor-pointer hover:bg-slate-700 disabled:opacity-40"
                  disabled={
                    selectedInvoices.length === 0 ||
                    !settings?.company_name
                  }
                  onClick={handleOpenConfirm}
                >
                  {`選択した${selectedInvoices.length}社の請求書送付を確認`}
                </button>
              </div>
            </div>
          </div>

          {/* 右: プレビュー（常にスペース確保） */}
          <div className="w-[340px] flex-shrink-0">
            {previewInvoice && settings ? (
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
                  dueDate={dueDate}
                />
              </div>
            ) : (
              <div className="border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-300 text-xs" style={{ aspectRatio: "210/297" }}>
                企業を選択するとプレビュー表示
              </div>
            )}
          </div>

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
                  dueDate={dueDate}
                  large
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* プレビューモード */
        <PreviewGallery
          invoices={selectedInvoices.length > 0 ? selectedInvoices : invoices}
          settings={settings}
          issueDate={issueDate}
          month={selectedMonth}
          notes={invoiceTemplate?.notes}
          dueDate={dueDate}
          currentIndex={previewIndex}
          onChangeIndex={setPreviewIndex}
          onDownloadSingle={handleGenerateSingle}
          onDownloadAll={() => handleGenerate()}
          onOpenConfirm={handleOpenConfirm}
          selectedCount={selectedInvoices.length}
          generating={generating}
        />
      )}

      {/* 送付確認モーダル */}
      {showSendConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowSendConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-[680px] max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-bold">請求書送付確認</h3>
              <button
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer text-lg"
                onClick={() => setShowSendConfirm(false)}
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">
              {/* 送付先一覧 */}
              <div>
                <div className="text-sm font-bold text-slate-700 mb-3">
                  送付先一覧（{sendChecked.size}/{selectedInvoices.length}社）
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="pl-4 pr-1 py-2.5 w-8">
                          <input
                            type="checkbox"
                            checked={sendChecked.size === selectedInvoices.length}
                            onChange={() => {
                              if (sendChecked.size === selectedInvoices.length) {
                                setSendChecked(new Set());
                              } else {
                                setSendChecked(new Set(selectedInvoices.map((i) => i.companyId)));
                              }
                            }}
                            className="cursor-pointer"
                          />
                        </th>
                        <th className="px-3 py-2.5 text-left font-semibold text-xs text-slate-500">企業名</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-xs text-slate-500">担当者</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-xs text-slate-500">メールアドレス</th>
                        <th className="px-4 py-2.5 text-right font-semibold text-xs text-slate-500">金額（税込）</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoices.map((inv) => {
                        const co = getCompany(inv.companyId);
                        const contactName = co?.invoice_contact_name || "";
                        const email = co?.invoice_email || "";
                        const isSendChecked = sendChecked.has(inv.companyId);
                        return (
                          <tr
                            key={inv.companyId}
                            className={`border-b border-slate-100 cursor-pointer transition-colors ${isSendChecked ? "" : "opacity-40"}`}
                            onClick={() => {
                              setSendChecked((prev) => {
                                const next = new Set(prev);
                                if (next.has(inv.companyId)) next.delete(inv.companyId);
                                else next.add(inv.companyId);
                                return next;
                              });
                            }}
                          >
                            <td className="pl-4 pr-1 py-2.5">
                              <input
                                type="checkbox"
                                checked={isSendChecked}
                                onChange={() => {}}
                                className="cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-2.5 font-medium">{inv.companyName}</td>
                            <td className="px-3 py-2.5 text-slate-600">
                              {contactName || <span className="text-slate-300">未設定</span>}
                            </td>
                            <td className="px-3 py-2.5">
                              {email ? (
                                <span className="text-blue-600">{email}</span>
                              ) : (
                                <span className="text-red-400 text-xs font-medium">未設定</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                              ¥{formatNumber(inv.total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 border-t border-slate-200">
                        <td colSpan={4} className="px-4 py-2.5 font-bold text-sm">合計</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-bold text-sm">
                          ¥{formatNumber(selectedInvoices.filter((i) => sendChecked.has(i.companyId)).reduce((s, i) => s + i.total, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {selectedInvoices.filter((inv) => sendChecked.has(inv.companyId)).some((inv) => !getCompany(inv.companyId)?.invoice_email) && (
                  <div className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    メールアドレスが未設定の企業があります。企業マスタから設定してください。
                  </div>
                )}
              </div>

              {/* メール件名 */}
              <div>
                <div className="text-sm font-bold text-slate-700 mb-2">件名</div>
                <input
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
              </div>

              {/* メール本文 */}
              <div>
                <div className="text-sm font-bold text-slate-700 mb-2">本文</div>
                <textarea
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 resize-y leading-relaxed"
                  rows={8}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                />
              </div>
            </div>

            {/* ボタン */}
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-200">
              <button
                className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-[10px] text-sm font-medium cursor-pointer hover:bg-slate-200"
                onClick={() => setShowSendConfirm(false)}
              >
                戻る
              </button>
              <button
                className="px-7 py-2.5 bg-slate-800 text-white rounded-[10px] text-sm font-semibold cursor-pointer hover:bg-slate-700 disabled:opacity-40"
                disabled={generating || !settings?.company_name || sendChecked.size === 0}
                onClick={handleGenerate}
              >
                {generating ? "生成中..." : `${sendChecked.size}社の請求書を作成`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** プレビューギャラリー（スライド形式） */
function PreviewGallery({
  invoices,
  settings,
  issueDate,
  month,
  notes,
  dueDate,
  currentIndex,
  onChangeIndex,
  onDownloadSingle,
  onDownloadAll,
  onOpenConfirm,
  selectedCount,
  generating,
}: {
  invoices: CompanyInvoice[];
  settings: Settings | null;
  issueDate: string;
  month: string;
  notes?: string;
  dueDate?: string;
  currentIndex: number;
  onChangeIndex: (i: number) => void;
  onDownloadSingle: (inv: CompanyInvoice) => void;
  onDownloadAll: () => void;
  onOpenConfirm: () => void;
  selectedCount: number;
  generating: boolean;
}) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);

  if (invoices.length === 0 || !settings) {
    return (
      <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl">
        選択された請求書がありません
      </div>
    );
  }

  const safeIndex = Math.min(currentIndex, invoices.length - 1);
  const current = invoices[safeIndex];

  const goTo = (next: number, dir: "left" | "right") => {
    setSlideDir(dir);
    onChangeIndex(next);
    setTimeout(() => setSlideDir(null), 300);
  };

  const goPrev = () => {
    if (safeIndex > 0) goTo(safeIndex - 1, "right");
  };
  const goNext = () => {
    if (safeIndex < invoices.length - 1) goTo(safeIndex + 1, "left");
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = e.changedTouches[0].clientX - touchStart;
    if (diff > 60) goPrev();
    else if (diff < -60) goNext();
    setTouchStart(null);
  };

  const hasPrev = safeIndex > 0;
  const hasNext = safeIndex < invoices.length - 1;
  const prevInv = hasPrev ? invoices[safeIndex - 1] : null;
  const nextInv = hasNext ? invoices[safeIndex + 1] : null;

  return (
    <div className="flex gap-5">
      {/* 左: 企業リスト */}
      <div className="w-[180px] flex-shrink-0 pt-1">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
          {invoices.length}社
        </div>
        <div className="flex flex-col gap-0.5">
          {invoices.map((inv, i) => (
            <button
              key={inv.companyId}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs cursor-pointer border-none transition-all ${
                i === safeIndex
                  ? "bg-slate-800 text-white font-bold shadow-sm"
                  : "bg-transparent text-slate-600 hover:bg-slate-100 font-medium"
              }`}
              onClick={() => onChangeIndex(i)}
            >
              <div className="truncate">{inv.companyName}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 右: カードスタック */}
      <div className="flex-1 min-w-0">

      {/* カードスタック領域 */}
      <div
        className="relative flex items-center justify-center overflow-hidden"
        style={{ minHeight: "calc(70vh + 48px)" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* 左ボタン */}
        <button
          className="absolute z-20 w-10 h-10 flex items-center justify-center bg-white/90 border border-slate-200 rounded-full shadow text-slate-500 hover:text-slate-800 cursor-pointer disabled:opacity-20 disabled:cursor-default backdrop-blur-sm"
          style={{ top: "50%", left: "calc(50% - 290px)", transform: "translateY(-50%)" }}
          disabled={!hasPrev}
          onClick={goPrev}
        >
          ←
        </button>

        {/* カードスタック */}
        <div className="relative" style={{ height: "calc(70vh + 28px)", aspectRatio: "210/297" }}>
          {/* 左後ろのカード（前のページ） */}
          {prevInv && (
            <div
              className="absolute transition-all duration-300 ease-out cursor-pointer"
              style={{
                top: 28,
                left: 0,
                right: 0,
                bottom: 0,
                transform: "translateX(calc(-60% - 20px)) scale(0.92)",
                zIndex: 1,
              }}
              onClick={goPrev}
            >
              <div className="text-center mb-1.5">
                <span className="text-xs font-semibold text-slate-400">{prevInv.companyName}</span>
              </div>
              <div className="h-[calc(100%-20px)] w-full rounded-lg shadow-lg overflow-hidden opacity-70 hover:opacity-90 transition-opacity border border-slate-200">
                <InvoicePreview
                  inv={prevInv}
                  settings={settings}
                  issueDate={issueDate}
                  month={month}
                  notes={notes}
                  dueDate={dueDate}
                  large
                />
              </div>
            </div>
          )}

          {/* 右後ろのカード（次のページ） */}
          {nextInv && (
            <div
              className="absolute transition-all duration-300 ease-out cursor-pointer"
              style={{
                top: 28,
                left: 0,
                right: 0,
                bottom: 0,
                transform: "translateX(calc(60% + 20px)) scale(0.92)",
                zIndex: 1,
              }}
              onClick={goNext}
            >
              <div className="text-center mb-1.5">
                <span className="text-xs font-semibold text-slate-400">{nextInv.companyName}</span>
              </div>
              <div className="h-[calc(100%-20px)] w-full rounded-lg shadow-lg overflow-hidden opacity-70 hover:opacity-90 transition-opacity border border-slate-200">
                <InvoicePreview
                  inv={nextInv}
                  settings={settings}
                  issueDate={issueDate}
                  month={month}
                  notes={notes}
                  dueDate={dueDate}
                  large
                />
              </div>
            </div>
          )}

          {/* メインカード（現在のページ） */}
          <div
            key={safeIndex}
            className="absolute transition-all duration-300 ease-out animate-card-appear"
            style={{ top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}
          >
            <div className="text-center mb-1.5">
              <span className="text-sm font-bold text-slate-700">{current.companyName}</span>
              <span className="ml-2 text-xs text-slate-400">¥{formatNumber(current.total)}</span>
            </div>
            <div className="h-[calc(100%-20px)] w-full rounded-lg shadow-2xl overflow-hidden border border-slate-300">
              <InvoicePreview
                inv={current}
                settings={settings}
                issueDate={issueDate}
                month={month}
                notes={notes}
                dueDate={dueDate}
                large
              />
            </div>
          </div>
        </div>

        {/* 右ボタン */}
        <button
          className="absolute z-20 w-10 h-10 flex items-center justify-center bg-white/90 border border-slate-200 rounded-full shadow text-slate-500 hover:text-slate-800 cursor-pointer disabled:opacity-20 disabled:cursor-default backdrop-blur-sm"
          style={{ top: "50%", right: "calc(50% - 290px)", transform: "translateY(-50%)" }}
          disabled={!hasNext}
          onClick={goNext}
        >
          →
        </button>
      </div>

      {/* ボタン */}
      <div className="flex flex-col items-end gap-2 mt-5 w-[300px] ml-auto">
        <button
          className="w-full py-2.5 bg-slate-100 border border-slate-300 rounded-[10px] text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-200 disabled:opacity-40"
          disabled={generating}
          onClick={() => onDownloadSingle(current)}
        >
          {generating ? "生成中..." : "この請求書をPDFダウンロード"}
        </button>
        <button
          className="w-full py-2.5 bg-slate-100 border border-slate-300 rounded-[10px] text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-200 disabled:opacity-40"
          disabled={generating}
          onClick={onDownloadAll}
        >
          {generating ? "生成中..." : `全${invoices.length}社を一括PDFダウンロード`}
        </button>
        <button
          className="w-full py-3 bg-slate-800 text-white rounded-[10px] text-sm font-bold cursor-pointer hover:bg-slate-700 disabled:opacity-40"
          disabled={selectedCount === 0 || !settings?.company_name}
          onClick={onOpenConfirm}
        >
          {`選択した${selectedCount}社の請求書送付を確認`}
        </button>
      </div>

      <style>{`
        @keyframes cardAppear {
          from { opacity: 0.8; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-card-appear { animation: cardAppear 0.3s ease-out; }
      `}</style>
      </div>
    </div>
  );
}

/** 企業行（アコーディオン） */
function CompanyRow({
  inv,
  isExpanded,
  isChecked,
  extras,
  companyDueDate,
  onDueDateChange,
  onToggleCheck,
  onToggleExpand,
  onAddItem,
  onUpdateItem,
  onUpdateBaseItem,
  onRemoveItem,
  onDeleteBaseItem,
}: {
  inv: CompanyInvoice;
  isExpanded: boolean;
  isChecked: boolean;
  extras: InvoiceLineItem[];
  companyDueDate: string;
  onDueDateChange: (v: string) => void;
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
  onDeleteBaseItem: (index: number) => void;
}) {
  const baseItemCount = inv.items.length - extras.length;

  return (
    <>
      <tr className={`border-b border-slate-100 hover:bg-slate-50 ${isExpanded ? "bg-blue-50/60" : ""}`}>
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
            <span className={`text-[10px] ${isExpanded ? "text-blue-500" : "text-slate-400"}`}>
              {isExpanded ? "▼" : "▶"}
            </span>
            <div>
              <div className="font-medium">{inv.companyName}</div>
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
            <div className="border-t border-blue-200 bg-blue-50/40 border-l-[3px] border-l-blue-400">
              <table className="w-full text-xs ml-4" style={{ tableLayout: "fixed", width: "calc(100% - 16px)" }}>
                <colgroup>
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
                          inputMode="numeric"
                          value={item.quantity || ""}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9]/g, "");
                            isBase
                              ? onUpdateBaseItem(i, "quantity", v)
                              : onUpdateItem(i, "quantity", v);
                          }}
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
                          inputMode="numeric"
                          value={item.unitPrice ? formatNumber(item.unitPrice) : ""}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9]/g, "");
                            isBase
                              ? onUpdateBaseItem(i, "unitPrice", v)
                              : onUpdateItem(i, "unitPrice", v);
                          }}
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
                        <button
                          className="text-red-400 hover:text-red-600 cursor-pointer bg-transparent border-none text-xs"
                          onClick={() => isBase ? onDeleteBaseItem(i) : onRemoveItem(i)}
                        >
                            ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between pl-7 pr-3 py-2 bg-blue-100/50 border-t border-blue-200 border-b-2 border-b-blue-300">
                <div className="flex items-center gap-4">
                  <button
                    className="text-[11px] text-blue-600 hover:text-blue-800 cursor-pointer bg-transparent border-none font-semibold"
                    onClick={onAddItem}
                  >
                    + 項目を追加
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">入金期日:</span>
                    <input
                      type="date"
                      className="px-1.5 py-0.5 border border-slate-200 rounded text-[11px] outline-none focus:border-blue-400 bg-white"
                      value={companyDueDate}
                      onChange={(e) => onDueDateChange(e.target.value)}
                    />
                  </div>
                </div>
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
  dueDate,
  large,
}: {
  inv: CompanyInvoice;
  settings: Settings;
  issueDate: string;
  month: string;
  notes?: string;
  dueDate?: string;
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
            {dueDate && <div>入金期日　{dueDate.replace(/-/g, "/")}</div>}
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
