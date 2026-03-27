"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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
  const [companyNotes, setCompanyNotes] = useState<Record<string, string>>({});
  const [sentStatus, setSentStatus] = useState<Record<string, string>>({});
  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // 月変更時にDBから備考と送信ステータスを読み込む
  useEffect(() => {
    import("@/lib/api").then(({ fetchInvoiceNotes, fetchSentStatus }) => {
      fetchInvoiceNotes(selectedMonth).then(setCompanyNotes);
      fetchSentStatus(selectedMonth).then(setSentStatus);
    });
  }, [selectedMonth]);

  // 備考変更時にDBに自動保存（debounce 1秒）
  const handleNoteChange = useCallback((companyId: string, note: string) => {
    setCompanyNotes((prev) => ({ ...prev, [companyId]: note }));
    if (noteTimers.current[companyId]) clearTimeout(noteTimers.current[companyId]);
    noteTimers.current[companyId] = setTimeout(() => {
      import("@/lib/api").then(({ upsertInvoiceNote }) => {
        upsertInvoiceNote(companyId, selectedMonth, note).catch(console.error);
      });
    }, 1000);
  }, [selectedMonth]);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendChecked, setSendChecked] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<{ companyName: string; email: string; success: boolean; error?: string }[] | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "preview">("list");
  const [previewIndex, setPreviewIndex] = useState(0);

  // Invoice number generation: INV-XXXXXXXXXX per company, stable during session
  const invoiceNumberMap = useRef<Record<string, string>>({});
  const getInvoiceNumber = useCallback((companyId: string) => {
    if (!invoiceNumberMap.current[companyId]) {
      const ts = Date.now().toString();
      const last10 = ts.slice(-10).padStart(10, "0");
      invoiceNumberMap.current[companyId] = `INV-${last10}`;
    }
    return invoiceNumberMap.current[companyId];
  }, []);

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

  const applyTemplateVars = useCallback((tpl: string) => {
    return tpl
      .replace(/\{会社名\}/g, settings?.company_name || "")
      .replace(/\{月\}/g, monthLabel)
      .replace(/○○/g, settings?.company_name || "○○")
      .replace(/○月/g, monthLabel);
  }, [settings, monthLabel]);

  const handleOpenConfirm = () => {
    const subjectTpl = settings?.email_subject_template;
    const bodyTpl = settings?.email_body_template;
    setEmailSubject(
      subjectTpl ? applyTemplateVars(subjectTpl) : `【${settings?.company_name || ""}】${monthLabel}分 請求書送付のご案内`
    );
    setEmailBody(
      bodyTpl ? applyTemplateVars(bodyTpl) : buildDefaultEmailBody()
    );
    setSendChecked(new Set(selectedInvoices.map((i) => i.companyId)));
    setSendResults(null);
    setShowSendConfirm(true);
  };

  const handleGenerate = async () => {
    if (!settings || selectedInvoices.length === 0) return;
    setGenerating(true);
    try {
      const { generateInvoicePDF } = await import("@/lib/invoice");
      await generateInvoicePDF(settings, selectedInvoices, selectedMonth, invoiceTemplate?.notes, dueDate, companyNotes, dueDates);
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
      await generateInvoicePDF(settings, [inv], selectedMonth, invoiceTemplate?.notes, dueDate, companyNotes, dueDates);
    } catch (e) {
      console.error(e);
      alert("PDF生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  };

  const handleSendInvoices = async () => {
    if (!settings || sendChecked.size === 0) return;
    setSending(true);
    setSendResults(null);
    const results: { companyName: string; email: string; success: boolean; error?: string }[] = [];
    try {
      const { generateInvoicePDFBase64 } = await import("@/lib/invoice");
      const invoicesToSend = selectedInvoices.filter((i) => sendChecked.has(i.companyId));

      for (const inv of invoicesToSend) {
        const co = getCompany(inv.companyId);
        const email = co?.invoice_email || "";
        if (!email) {
          results.push({ companyName: inv.companyName, email: "", success: false, error: "メールアドレス未設定" });
          setSendResults([...results]);
          continue;
        }
        try {
          const companyNote = companyNotes[inv.companyId] ?? invoiceTemplate?.notes;
          const companyDue = dueDates[inv.companyId] ?? dueDate;
          const pdfBase64 = await generateInvoicePDFBase64(settings, inv, selectedMonth, companyNote, companyDue);

          const res = await fetch("/api/send-invoice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipients: [{
                companyName: inv.companyName,
                email,
                contactName: co?.invoice_contact_name || "",
                pdfBase64,
              }],
              subject: emailSubject,
              body: emailBody,
              senderName: settings.company_name || "",
              invoiceMonth: selectedMonth,
            }),
          });

          const data = await res.json();
          if (data.results?.[0]) {
            results.push(data.results[0]);
            if (data.results[0]?.success) {
              import("@/lib/api").then(({ markAsSent }) => {
                markAsSent(inv.companyId, selectedMonth).catch(console.error);
              });
              setSentStatus((prev) => ({ ...prev, [inv.companyId]: new Date().toISOString() }));
            }
          } else {
            results.push({ companyName: inv.companyName, email, success: false, error: data.error || "送信失敗" });
          }
        } catch (e) {
          results.push({ companyName: inv.companyName, email, success: false, error: "送信エラー" });
        }
        setSendResults([...results]);
      }
    } catch (e) {
      console.error(e);
      alert("送信に失敗しました");
    } finally {
      setSending(false);
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
        <div className="flex gap-4">
          {/* 左: 企業一覧 */}
          <div className="min-w-0" style={{ flex: "1 1 0", maxWidth: "calc(100% - 520px)" }}>
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
                        companyNote={companyNotes[inv.companyId] ?? invoiceTemplate?.notes ?? ""}
                        onNoteChange={(v) => handleNoteChange(inv.companyId, v)}
                        sentAt={sentStatus[inv.companyId]}
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

            <div className="mt-4 text-sm text-slate-600">
              {selectedInvoices.length}社選択 / 合計{" "}
              <span className="font-bold text-slate-800">
                ¥{formatNumber(selectedTotal)}
              </span>
              （税込）
            </div>
          </div>

          {/* 右: プレビュー + ボタン */}
          <div className="w-[500px] flex-shrink-0">
            {previewInvoice && settings ? (
              <div className="relative" style={{ aspectRatio: "210/297" }}>
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
                  notes={companyNotes[previewInvoice.companyId] ?? invoiceTemplate?.notes}
                  dueDate={dueDates[previewInvoice.companyId] ?? dueDate}
                  invoiceNumber={getInvoiceNumber(previewInvoice.companyId)}
                />
              </div>
            ) : (
              <div className="border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-300 text-xs" style={{ aspectRatio: "210/297" }}>
                企業を選択するとプレビュー表示
              </div>
            )}
            <div className="flex flex-col gap-2 mt-4">
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
                  notes={companyNotes[previewInvoice.companyId] ?? invoiceTemplate?.notes}
                  dueDate={dueDates[previewInvoice.companyId] ?? dueDate}
                  large
                  invoiceNumber={getInvoiceNumber(previewInvoice.companyId)}
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
          companyNotes={companyNotes}
          dueDate={dueDate}
          dueDates={dueDates}
          currentIndex={previewIndex}
          onChangeIndex={setPreviewIndex}
          onDownloadSingle={handleGenerateSingle}
          onDownloadAll={() => handleGenerate()}
          onOpenConfirm={handleOpenConfirm}
          selectedCount={selectedInvoices.length}
          generating={generating}
          getInvoiceNumber={getInvoiceNumber}
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
                className="px-7 py-2.5 bg-slate-800 text-white rounded-[10px] text-sm font-bold cursor-pointer hover:bg-slate-700 disabled:opacity-40"
                disabled={sending || !settings?.company_name || sendChecked.size === 0}
                onClick={handleSendInvoices}
              >
                {sending ? "送信中..." : `${sendChecked.size}社の請求書を送付`}
              </button>
            </div>

            {/* 送信結果 */}
            {sendResults && (
              <div className="px-6 pb-4">
                <div className="text-sm font-bold text-slate-700 mb-2">送信結果</div>
                <div className="space-y-1">
                  {sendResults.map((r, i) => (
                    <div key={i} className={`text-xs px-3 py-2 rounded ${r.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                      {r.companyName}: {r.success ? "送信成功" : `失敗 - ${r.error}`}
                      {r.email && <span className="text-slate-400 ml-2">({r.email})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
  companyNotes,
  dueDate,
  dueDates,
  currentIndex,
  onChangeIndex,
  onDownloadSingle,
  onDownloadAll,
  onOpenConfirm,
  selectedCount,
  generating,
  getInvoiceNumber,
}: {
  invoices: CompanyInvoice[];
  settings: Settings | null;
  issueDate: string;
  month: string;
  notes?: string;
  companyNotes?: Record<string, string>;
  dueDates?: Record<string, string>;
  dueDate?: string;
  currentIndex: number;
  onChangeIndex: (i: number) => void;
  onDownloadSingle: (inv: CompanyInvoice) => void;
  onDownloadAll: () => void;
  onOpenConfirm: () => void;
  selectedCount: number;
  generating: boolean;
  getInvoiceNumber: (companyId: string) => string;
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
                  notes={companyNotes?.[prevInv.companyId] ?? notes}
                  dueDate={dueDates?.[prevInv.companyId] ?? dueDate}
                  large
                  invoiceNumber={getInvoiceNumber(prevInv.companyId)}
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
                  notes={companyNotes?.[nextInv.companyId] ?? notes}
                  dueDate={dueDates?.[nextInv.companyId] ?? dueDate}
                  large
                  invoiceNumber={getInvoiceNumber(nextInv.companyId)}
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
                notes={companyNotes?.[current.companyId] ?? notes}
                dueDate={dueDates?.[current.companyId] ?? dueDate}
                large
                invoiceNumber={getInvoiceNumber(current.companyId)}
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
  companyNote,
  onNoteChange,
  sentAt,
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
  companyNote: string;
  onNoteChange: (v: string) => void;
  sentAt?: string;
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
            <div className="flex items-center gap-2">
              <div className="font-medium">{inv.companyName}</div>
              {sentAt && (
                <span className="text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 px-1.5 py-0.5 rounded-full">
                  送信済
                </span>
              )}
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
              <div className="flex items-center justify-between pl-7 pr-3 py-2 bg-blue-100/50 border-t border-blue-200">
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
              <div className="px-4 py-2 border-t border-blue-100 border-b-2 border-b-blue-300">
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-slate-500 pt-1.5 flex-shrink-0">備考:</span>
                  <textarea
                    className="flex-1 px-2 py-1 border border-slate-200 rounded text-[11px] outline-none focus:border-blue-400 bg-white resize-y min-h-[28px]"
                    rows={1}
                    value={companyNote}
                    onChange={(e) => onNoteChange(e.target.value)}
                    placeholder="備考を入力..."
                  />
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
  invoiceNumber,
}: {
  inv: CompanyInvoice;
  settings: Settings;
  issueDate: string;
  month: string;
  notes?: string;
  dueDate?: string;
  large?: boolean;
  invoiceNumber?: string;
}) {
  const visibleItems = inv.items.filter((it) => it.amount > 0 || it.description);
  const emptyRows = Math.max(0, 8 - visibleItems.length);

  return (
    <div
      className="border border-slate-300 rounded bg-white shadow-sm"
      style={{ width: "100%", height: "100%", overflow: "hidden", position: "relative" }}
    >
      <div style={{ width: 700, height: 990, transform: "scale(var(--inv-scale))", transformOrigin: "top left", fontFamily: "'Noto Sans JP', sans-serif", padding: "42px 48px 34px", boxSizing: "border-box", fontSize: 13, color: "#1a1a1a", lineHeight: 1.65, overflow: "hidden", display: "flex", flexDirection: "column", position: "absolute", top: 0, left: 0 } as React.CSSProperties}
        ref={(el) => {
          if (!el) return;
          const parent = el.parentElement;
          if (!parent) return;
          const s = Math.min(parent.clientWidth / 700, parent.clientHeight / 990);
          el.style.setProperty("--inv-scale", String(s));
        }}
      >
        {/* タイトル */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 8, display: "inline-block" }}>
            請求書
            <div style={{ borderBottom: "2px solid #1a1a1a", marginTop: 4 }} />
          </div>
        </div>

        {/* ヘッダー */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ maxWidth: 290 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 3 }}>{inv.companyName}　御中</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <table style={{ marginLeft: "auto", borderCollapse: "collapse", fontSize: 12.5, marginBottom: 14 }}>
              <tbody>
                {([["請求日", issueDate], ["請求書番号", invoiceNumber || ""], ...(settings.invoice_number ? [["登録番号", settings.invoice_number]] : [])] as [string, string][]).map(([l, v]) => (
                  <tr key={l} style={{ borderBottom: "0.5px solid #999" }}>
                    <td style={{ padding: "3px 12px 3px 6px", textAlign: "left", color: "#333", fontWeight: 500 }}>{l}</td>
                    <td style={{ padding: "3px 6px 3px 12px", textAlign: "right", fontWeight: 600 }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{settings.company_name}</div>
            {settings.company_address && (
              <>
                <div style={{ fontSize: 11.5, color: "#555" }}>（本店所在地）</div>
                <div style={{ fontSize: 12.5, whiteSpace: "pre-line" }}>{settings.company_address}</div>
              </>
            )}
          </div>
        </div>

        {/* 本文 */}
        <div style={{ fontSize: 13, marginTop: 14, marginBottom: 16 }}>下記の通りご請求申し上げます。</div>

        {/* 請求金額 */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>請求金額</span>
            <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 1 }}>{formatNumber(inv.total)}<span style={{ fontSize: 14 }}>円</span></span>
          </div>
          <div style={{ borderBottom: "2.5px solid #1a1a1a", marginTop: 4, width: "45%" }} />
        </div>

        {/* 明細テーブル */}
        {(() => { const cb = "0.5px solid #333"; return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ padding: "8px 8px", textAlign: "center", fontWeight: 700, width: "48%", border: cb }}>摘要</th>
              <th style={{ padding: "8px 8px", textAlign: "center", fontWeight: 700, width: "10%", borderTop: cb, borderBottom: cb, borderRight: cb }}>数量</th>
              <th style={{ padding: "8px 8px", textAlign: "center", fontWeight: 700, width: "18%", borderTop: cb, borderBottom: cb, borderRight: cb }}>単価</th>
              <th style={{ padding: "8px 8px", textAlign: "center", fontWeight: 700, width: "18%", borderTop: cb, borderBottom: cb, borderRight: cb }}>明細金額</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item, i) => (
              <tr key={i}>
                <td style={{ padding: "8px 8px", borderBottom: cb, borderLeft: cb, borderRight: cb }}>{item.description}</td>
                <td style={{ padding: "8px 8px", textAlign: "right", borderBottom: cb, borderRight: cb }}>{item.quantity}{item.unit}</td>
                <td style={{ padding: "8px 8px", textAlign: "right", borderBottom: cb, borderRight: cb }}>{formatNumber(item.unitPrice)}</td>
                <td style={{ padding: "8px 8px", textAlign: "right", borderBottom: cb, borderRight: cb }}>{formatNumber(item.amount)}</td>
              </tr>
            ))}
            {Array.from({ length: emptyRows }).map((_, i) => (
              <tr key={`e${i}`}>
                <td style={{ padding: "8px 8px", borderBottom: cb, borderLeft: cb, borderRight: cb }}>&nbsp;</td>
                <td style={{ padding: "8px 8px", borderBottom: cb, borderRight: cb }} />
                <td style={{ padding: "8px 8px", borderBottom: cb, borderRight: cb }} />
                <td style={{ padding: "8px 8px", borderBottom: cb, borderRight: cb }} />
              </tr>
            ))}
          </tbody>
        </table>
        ); })()}

        {/* 下部 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 10 }}>
          <div style={{ fontSize: 12.5, marginTop: 18 }}>
            {dueDate && (
              <div style={{ marginBottom: 5 }}>
                <span style={{ fontWeight: 700 }}>入金期日</span>
                <span style={{ marginLeft: 14 }}>{dueDate.replace(/-/g, "-")}</span>
              </div>
            )}
            <div>
              <span style={{ fontWeight: 700 }}>振込先</span>
              <span style={{ marginLeft: 14, whiteSpace: "pre-line" }}>{settings.bank_info || "（設定ページで登録してください）"}</span>
            </div>
          </div>
          {(() => { const cb = "0.5px solid #333"; return (
          <table style={{ borderCollapse: "collapse", fontSize: 13, marginTop: 6 }}>
            <tbody>
              <tr>
                <td style={{ padding: "6px 14px", fontWeight: 600, borderTop: cb, borderBottom: cb, borderLeft: cb }}>小計</td>
                <td style={{ padding: "6px 18px", textAlign: "right", borderTop: cb, borderBottom: cb, borderRight: cb }}>{formatNumber(inv.subtotal)}円</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 14px", fontWeight: 600, borderBottom: cb, borderLeft: cb }}>消費税</td>
                <td style={{ padding: "6px 18px", textAlign: "right", borderBottom: cb, borderRight: cb }}>{formatNumber(inv.tax)}円</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 14px", fontWeight: 700, borderBottom: cb, borderLeft: cb }}>合計</td>
                <td style={{ padding: "6px 18px", textAlign: "right", fontWeight: 700, borderBottom: cb, borderRight: cb }}>{formatNumber(inv.total)}円</td>
              </tr>
            </tbody>
          </table>
          ); })()}
        </div>

        {/* 備考 */}
        <div style={{ marginTop: 16, border: "0.5px solid #999", borderRadius: 2, padding: "10px 12px", minHeight: 80 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#444", marginBottom: 2 }}>備考</div>
          <div style={{ whiteSpace: "pre-line", fontSize: 12.5 }}>{notes || ""}</div>
        </div>
      </div>
    </div>
  );
}
