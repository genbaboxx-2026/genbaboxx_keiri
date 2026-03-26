import type { Settings } from "./database.types";
import type { CompanyInvoice } from "./invoiceCalc";

let cachedFontBase64: string | null = null;

async function loadJapaneseFont(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any
) {
  if (!cachedFontBase64) {
    // Google Fonts の静的ホスティングからTTFを取得
    const res = await fetch(
      "https://raw.githubusercontent.com/google/fonts/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf"
    );
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
    }
    cachedFontBase64 = btoa(binary);
  }
  doc.addFileToVFS("NotoSansJP-Regular.ttf", cachedFontBase64);
  doc.addFont("NotoSansJP-Regular.ttf", "NotoSansJP", "normal");
}

export async function generateInvoicePDF(
  settings: Settings,
  invoices: CompanyInvoice[],
  invoiceMonth: string
) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // 日本語フォントロード
  await loadJapaneseFont(doc);
  doc.setFont("NotoSansJP", "normal");

  const [yearStr, monthStr] = invoiceMonth.split("-");
  const today = new Date();
  const issueDate = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;

  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    if (i > 0) doc.addPage();

    let y = 20;

    // タイトル
    doc.setFontSize(22);
    doc.text("請求書", 105, y, { align: "center" });
    y += 12;

    // 発行日
    doc.setFontSize(10);
    doc.text(`発行日: ${issueDate}`, 190, y, { align: "right" });
    y += 8;

    // 請求先
    doc.setFontSize(14);
    doc.text(`${inv.companyName} 御中`, 20, y);
    y += 2;
    doc.setLineWidth(0.5);
    doc.line(20, y, 120, y);
    y += 10;

    // 請求金額
    doc.setFontSize(11);
    doc.text("ご請求金額（税込）", 20, y);
    y += 7;
    doc.setFontSize(18);
    doc.text(`¥${inv.total.toLocaleString()}`, 20, y);
    y += 12;

    // 請求元情報
    const infoX = 120;
    let infoY = 50;
    doc.setFontSize(10);
    if (settings.company_name) {
      doc.setFontSize(12);
      doc.text(settings.company_name, infoX, infoY);
      infoY += 6;
      doc.setFontSize(9);
    }
    if (settings.company_address) {
      const addrLines = settings.company_address.split("\n");
      for (const line of addrLines) {
        doc.text(line, infoX, infoY);
        infoY += 5;
      }
    }
    if (settings.company_phone) {
      doc.text(`TEL: ${settings.company_phone}`, infoX, infoY);
      infoY += 5;
    }
    if (settings.invoice_number) {
      doc.text(`登録番号: ${settings.invoice_number}`, infoX, infoY);
      infoY += 5;
    }

    // 対象期間
    doc.setFontSize(10);
    y = Math.max(y, infoY + 5);
    doc.text(`対象期間: ${yearStr}年${parseInt(monthStr)}月分`, 20, y);
    y += 8;

    // 明細テーブル
    autoTable(doc, {
      startY: y,
      head: [["品目", "数量", "単価", "金額"]],
      body: inv.items.map((item) => [
        item.description,
        String(item.quantity),
        `¥${item.unitPrice.toLocaleString()}`,
        `¥${item.amount.toLocaleString()}`,
      ]),
      styles: {
        font: "NotoSansJP",
        fontSize: 10,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [51, 65, 85],
        textColor: [255, 255, 255],
        fontStyle: "normal",
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: "right", cellWidth: 25 },
        2: { halign: "right", cellWidth: 35 },
        3: { halign: "right", cellWidth: 35 },
      },
      margin: { left: 20, right: 20 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;

    // 合計セクション
    const sumX = 140;
    doc.setFontSize(10);
    doc.text("小計（税別）", sumX, y);
    doc.text(`¥${inv.subtotal.toLocaleString()}`, 190, y, { align: "right" });
    y += 6;
    doc.text("消費税（10%）", sumX, y);
    doc.text(`¥${inv.tax.toLocaleString()}`, 190, y, { align: "right" });
    y += 2;
    doc.line(sumX, y, 190, y);
    y += 6;
    doc.setFontSize(12);
    doc.text("合計（税込）", sumX, y);
    doc.text(`¥${inv.total.toLocaleString()}`, 190, y, { align: "right" });
    y += 14;

    // 振込先
    if (settings.bank_info) {
      doc.setFontSize(10);
      doc.text("お振込先", 20, y);
      y += 6;
      doc.setFontSize(9);
      const bankLines = settings.bank_info.split("\n");
      for (const line of bankLines) {
        doc.text(line, 20, y);
        y += 5;
      }
    }
  }

  doc.save(`請求書_${invoiceMonth}.pdf`);
}
