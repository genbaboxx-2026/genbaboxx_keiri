import type { Settings, Contract, Company, InvoiceTemplate, PayType, CloseOffset } from "./database.types";
import type { CompanyInvoice } from "./invoiceCalc";
import { getInvoicesForMonth } from "./invoiceCalc";
import { generateInvoiceNumber, renderInvoicePDFBytes } from "./invoice";

function payMonthLabel(pay: PayType): string {
  if (pay === "same_end") return "当月払い";
  if (pay === "next_end" || pay === "next_10") return "翌月払い";
  if (pay === "next2_10") return "翌々月払い";
  return "その他";
}

function closeLabel(close: CloseOffset): string {
  if (close === "-1") return "前月締";
  if (close === "0") return "当月締";
  return "翌月締";
}

function payConditionFolder(close: CloseOffset, pay: PayType): string {
  return `${closeLabel(close)}${payMonthLabel(pay)}`;
}

export async function generateInvoiceZIP(
  settings: Settings,
  customerInvoices: CompanyInvoice[],
  contracts: Contract[],
  companies: Company[],
  invoiceMonth: string,
  templates?: InvoiceTemplate[],
  templateNotes?: string,
  dueDate?: string,
  notesMap?: Record<string, string>,
  dueDatesMap?: Record<string, string>,
  onProgress?: (current: number, total: number) => void,
  issueDatesMap?: Record<string, string>
): Promise<void> {
  const [JSZip, { jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jszip").then((m) => m.default),
    import("jspdf"),
    import("html2canvas-pro"),
  ]);

  const today = new Date();
  const defaultIssueDate = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;

  // Load font
  const fontLink = document.createElement("link");
  fontLink.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap";
  fontLink.rel = "stylesheet";
  document.head.appendChild(fontLink);
  await new Promise((r) => setTimeout(r, 500));

  // Offscreen container
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  document.body.appendChild(container);

  const zip = new JSZip();
  const customerFolder = zip.folder("お客様用")!;
  const gbFolder = zip.folder("GB用")!;

  // Generate stable invoice numbers per company
  const invoiceNumbers = new Map<string, string>();
  for (const inv of customerInvoices) {
    invoiceNumbers.set(inv.companyId, generateInvoiceNumber());
    // Small delay to ensure unique timestamps
    await new Promise((r) => setTimeout(r, 2));
  }

  // Count total PDFs for progress
  // Build GB groups first to count
  const groupMap = new Map<string, Set<string>>(); // folder -> set of companyIds
  for (const c of contracts) {
    if (c.contract_status === "cancelled") continue;
    const folder = payConditionFolder(c.monthly_close, c.monthly_pay);
    if (!groupMap.has(folder)) groupMap.set(folder, new Set());
    groupMap.get(folder)!.add(c.company_id);
  }

  let totalPdfs = customerInvoices.length;
  for (const [, companyIds] of groupMap) {
    totalPdfs += companyIds.size;
  }
  let currentPdf = 0;

  try {
    // === お客様用 ===
    for (const inv of customerInvoices) {
      const invNum = invoiceNumbers.get(inv.companyId)!;
      const notes = notesMap?.[inv.companyId] ?? templateNotes;
      const companyDueDate = dueDatesMap?.[inv.companyId] ?? dueDate;
      const fileName = `${inv.companyName}御中_請求書_${invNum}.pdf`;

      const companyIssueDate = issueDatesMap?.[inv.companyId] ? issueDatesMap[inv.companyId].replace(/-/g, "/") : defaultIssueDate;
      const bytes = await renderInvoicePDFBytes(
        inv, settings, companyIssueDate, invNum, container,
        html2canvas as unknown as (el: HTMLElement, opts: Record<string, unknown>) => Promise<HTMLCanvasElement>,
        jsPDF, companyDueDate, notes
      );
      customerFolder.file(fileName, bytes);
      currentPdf++;
      onProgress?.(currentPdf, totalPdfs);
    }

    // === GB用 ===
    // 契約ベースの全請求書（カスタム項目なし）を生成して差分検出用に使う
    const baseInvoices = getInvoicesForMonth(invoiceMonth, contracts.filter((c) => c.contract_status !== "cancelled"), companies, templates);
    const baseInvoiceMap = new Map(baseInvoices.map((inv) => [inv.companyId, inv]));

    for (const [folderName, companyIds] of groupMap) {
      const conditionContracts = contracts.filter((c) => {
        if (c.contract_status === "cancelled") return false;
        return payConditionFolder(c.monthly_close, c.monthly_pay) === folderName;
      });

      const groupInvoices = getInvoicesForMonth(
        invoiceMonth,
        conditionContracts,
        companies,
        templates
      ).filter((inv) => inv.total > 0);

      if (groupInvoices.length === 0) continue;

      const subFolder = gbFolder.folder(folderName)!;

      for (const inv of groupInvoices) {
        if (!companyIds.has(inv.companyId)) continue;
        const invNum = invoiceNumbers.get(inv.companyId) || generateInvoiceNumber();
        const notes = notesMap?.[inv.companyId] ?? templateNotes;
        const companyDueDate = dueDatesMap?.[inv.companyId] ?? dueDate;
        const fileName = `${inv.companyName}御中_請求書_${invNum}.pdf`;

        const gbIssueDate = issueDatesMap?.[inv.companyId] ? issueDatesMap[inv.companyId].replace(/-/g, "/") : defaultIssueDate;
        const bytes = await renderInvoicePDFBytes(
          inv, settings, gbIssueDate, invNum, container,
          html2canvas as unknown as (el: HTMLElement, opts: Record<string, unknown>) => Promise<HTMLCanvasElement>,
          jsPDF, companyDueDate, notes
        );
        subFolder.file(fileName, bytes);
        currentPdf++;
        onProgress?.(currentPdf, totalPdfs);
      }
    }

    // === GB用/不明 フォルダ（カスタム項目＝契約に紐づかない差分） ===
    const unknownInvoices: CompanyInvoice[] = [];
    for (const custInv of customerInvoices) {
      const baseInv = baseInvoiceMap.get(custInv.companyId);
      const baseTotal = baseInv?.total ?? 0;
      const diff = custInv.total - baseTotal;
      if (Math.abs(diff) < 1) continue; // 差分なし
      // 差分項目を抽出: お客様用にあって契約ベースにない項目
      const baseDescs = new Set((baseInv?.items ?? []).map((it) => `${it.description}|${it.amount}`));
      const extraItems = custInv.items.filter((it) => !baseDescs.has(`${it.description}|${it.amount}`));
      if (extraItems.length === 0) continue;
      const subtotal = extraItems.reduce((s, it) => s + it.amount, 0);
      const tax = Math.floor(subtotal * 0.1);
      unknownInvoices.push({
        companyId: custInv.companyId,
        companyName: custInv.companyName,
        items: extraItems,
        subtotal,
        tax,
        total: subtotal + tax,
        paymentDueDate: custInv.paymentDueDate,
      });
    }

    if (unknownInvoices.length > 0) {
      const unknownFolder = gbFolder.folder("不明")!;
      for (const inv of unknownInvoices) {
        const invNum = invoiceNumbers.get(inv.companyId) || generateInvoiceNumber();
        const notes = notesMap?.[inv.companyId] ?? templateNotes;
        const companyDueDate = dueDatesMap?.[inv.companyId] ?? dueDate;
        const fileName = `${inv.companyName}御中_請求書_${invNum}.pdf`;

        const unknownIssueDate = issueDatesMap?.[inv.companyId] ? issueDatesMap[inv.companyId].replace(/-/g, "/") : defaultIssueDate;
        const bytes = await renderInvoicePDFBytes(
          inv, settings, unknownIssueDate, invNum, container,
          html2canvas as unknown as (el: HTMLElement, opts: Record<string, unknown>) => Promise<HTMLCanvasElement>,
          jsPDF, companyDueDate, notes
        );
        unknownFolder.file(fileName, bytes);
        currentPdf++;
        onProgress?.(currentPdf, totalPdfs);
      }
    }

    // Generate ZIP and download
    const blob = await zip.generateAsync({ type: "blob" });
    const [y, m] = invoiceMonth.split("-");
    const zipName = `${y}年${parseInt(m)}月請求書.zip`;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = zipName;
    a.click();
    URL.revokeObjectURL(a.href);
  } finally {
    document.body.removeChild(container);
  }
}
