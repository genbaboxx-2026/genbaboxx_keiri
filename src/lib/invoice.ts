import type { Settings } from "./database.types";
import type { CompanyInvoice } from "./invoiceCalc";

let cachedFontBase64: string | null = null;

async function loadJapaneseFont(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any
) {
  if (!cachedFontBase64) {
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

const fmt = (n: number) => n.toLocaleString();

async function loadImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateInvoicePDF(
  settings: Settings,
  invoices: CompanyInvoice[],
  invoiceMonth: string,
  templateNotes?: string
) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await loadJapaneseFont(doc);
  doc.setFont("NotoSansJP", "normal");

  // ロゴ・社印画像を事前ロード
  const logoData = settings.logo_url ? await loadImage(settings.logo_url) : null;
  const stampData = settings.stamp_url ? await loadImage(settings.stamp_url) : null;

  const today = new Date();
  const issueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const pageW = 210;
  const marginL = 20;
  const marginR = 20;
  const contentW = pageW - marginL - marginR;

  for (let idx = 0; idx < invoices.length; idx++) {
    const inv = invoices[idx];
    if (idx > 0) doc.addPage();

    let y = 20;

    // ===== タイトル =====
    doc.setFontSize(18);
    doc.text("請求書", pageW / 2, y, { align: "center" });
    y += 3;
    doc.setLineWidth(0.5);
    doc.line(pageW / 2 - 20, y, pageW / 2 + 20, y);
    y += 12;

    // ===== 左: 請求先 =====
    doc.setFontSize(14);
    doc.text(`${inv.companyName} 御中`, marginL, y);
    y += 2;
    doc.setLineWidth(0.3);
    doc.line(marginL, y, marginL + 90, y);

    // ===== 右上: 請求日・番号 =====
    const rightX = 130;
    let ry = 32;
    doc.setFontSize(8);
    doc.text("請求日", rightX, ry);
    doc.text(issueDate, pageW - marginR, ry, { align: "right" });
    ry += 5;
    if (settings.invoice_number) {
      doc.text("登録番号", rightX, ry);
      doc.text(settings.invoice_number, pageW - marginR, ry, { align: "right" });
      ry += 5;
    }

    // ===== 右: ロゴ + 自社情報 =====
    ry += 3;
    if (logoData) {
      try { doc.addImage(logoData, "PNG", 140, ry - 5, 40, 12); } catch { /* ignore */ }
      ry += 14;
    }
    doc.setFontSize(11);
    doc.text(settings.company_name || "", pageW - marginR, ry, { align: "right" });
    ry += 6;
    doc.setFontSize(8);
    const stampStartY = ry;
    if (settings.company_address) {
      const addrLines = settings.company_address.split("\n");
      for (const line of addrLines) {
        doc.text(line, pageW - marginR - (stampData ? 20 : 0), ry, { align: "right" });
        ry += 4;
      }
    }
    if (settings.company_phone) {
      doc.text(`TEL: ${settings.company_phone}`, pageW - marginR - (stampData ? 20 : 0), ry, { align: "right" });
      ry += 4;
    }
    if (stampData) {
      try { doc.addImage(stampData, "PNG", pageW - marginR - 18, stampStartY - 2, 18, 18); } catch { /* ignore */ }
    }

    // ===== 「下記の通り...」 =====
    y = Math.max(y + 12, ry + 5);
    doc.setFontSize(9);
    doc.text("下記の通りご請求申し上げます。", marginL, y);
    y += 10;

    // ===== 請求金額 =====
    doc.setFontSize(9);
    doc.text("請求金額", marginL, y);
    y += 8;
    doc.setFontSize(20);
    doc.text(`${fmt(inv.total)}円`, marginL + 5, y);
    y += 3;
    doc.setLineWidth(0.5);
    doc.line(marginL, y, marginL + 80, y);
    y += 10;

    // ===== 明細テーブル =====
    const tableStartY = y;
    const maxRows = 10;
    const items = inv.items.filter((it) => it.amount > 0 || it.description);
    const emptyRows = Math.max(0, maxRows - items.length);
    const bodyData = [
      ...items.map((item) => [
        item.description,
        String(item.quantity),
        fmt(item.unitPrice),
        fmt(item.amount),
      ]),
      ...Array(emptyRows).fill(["", "", "", ""]),
    ];

    autoTable(doc, {
      startY: tableStartY,
      head: [["摘要", "数量", "単価", "明細金額"]],
      body: bodyData,
      styles: {
        font: "NotoSansJP",
        fontSize: 9,
        cellPadding: 3,
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        fontStyle: "normal",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 85 },
        1: { cellWidth: 20, halign: "right" },
        2: { cellWidth: 30, halign: "right" },
        3: { cellWidth: 35, halign: "right" },
      },
      margin: { left: marginL, right: marginR },
      theme: "grid",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 5;

    // ===== 左下: 入金期日・振込先 =====
    const bottomY = y;
    doc.setFontSize(9);
    if (settings.bank_info) {
      let by = bottomY;
      doc.text("振込先", marginL, by);
      by += 5;
      doc.setFontSize(8);
      const bankLines = settings.bank_info.split("\n");
      for (const line of bankLines) {
        doc.text(line, marginL + 15, by);
        by += 4;
      }
    }

    // ===== 右下: 小計/消費税/合計/内訳 =====
    const sumTableX = 120;
    const sumTableW = pageW - marginR - sumTableX;

    autoTable(doc, {
      startY: bottomY - 2,
      body: [
        ["小計", `${fmt(inv.subtotal)}円`],
        ["消費税", `${fmt(inv.tax)}円`],
        ["合計", `${fmt(inv.total)}円`],
        ["内訳  10%対象(税抜)", `${fmt(inv.subtotal)}円`],
        ["        10%消費税", `${fmt(inv.tax)}円`],
      ],
      styles: {
        font: "NotoSansJP",
        fontSize: 8,
        cellPadding: 2,
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: sumTableW * 0.55 },
        1: { cellWidth: sumTableW * 0.45, halign: "right" },
      },
      margin: { left: sumTableX, right: marginR },
      theme: "grid",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 5;

    // ===== 備考 =====
    if (templateNotes) {
      doc.setFontSize(8);
      doc.setDrawColor(0);
      doc.rect(marginL, y, contentW, 20);
      doc.text("備考", marginL + 3, y + 5);
      const noteLines = templateNotes.split("\n");
      let ny = y + 10;
      for (const line of noteLines) {
        doc.text(line, marginL + 3, ny);
        ny += 4;
      }
      y += 25;
    }

    // ===== ページ番号 =====
    doc.setFontSize(8);
    doc.text(
      `${idx + 1} / ${invoices.length}`,
      pageW / 2,
      287,
      { align: "center" }
    );
  }

  doc.save(`請求書_${invoiceMonth}.pdf`);
}
