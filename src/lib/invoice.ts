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

// 罫線ヘルパー
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawLine(doc: any, x1: number, y1: number, x2: number, y2: number, width = 0.3) {
  doc.setLineWidth(width);
  doc.setDrawColor(60, 60, 60);
  doc.line(x1, y1, x2, y2);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawRect(doc: any, x: number, y: number, w: number, h: number, fill?: [number, number, number]) {
  doc.setLineWidth(0.2);
  doc.setDrawColor(80, 80, 80);
  if (fill) {
    doc.setFillColor(...fill);
    doc.rect(x, y, w, h, "FD");
  } else {
    doc.rect(x, y, w, h);
  }
}

export async function generateInvoicePDF(
  settings: Settings,
  invoices: CompanyInvoice[],
  invoiceMonth: string,
  templateNotes?: string
) {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await loadJapaneseFont(doc);
  doc.setFont("NotoSansJP", "normal");

  // ロゴ・社印画像を事前ロード
  const logoData = settings.logo_url ? await loadImage(settings.logo_url) : null;
  const stampData = settings.stamp_url ? await loadImage(settings.stamp_url) : null;

  const today = new Date();
  const issueDate = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;
  const pageW = 210;
  const pageH = 297;
  const mL = 18;
  const mR = 18;
  const contentW = pageW - mL - mR;

  for (let idx = 0; idx < invoices.length; idx++) {
    const inv = invoices[idx];
    if (idx > 0) doc.addPage();

    let y = 22;

    // ===== タイトル =====
    doc.setFontSize(22);
    doc.setTextColor(30, 30, 30);
    doc.text("請 求 書", pageW / 2, y, { align: "center" });
    y += 4;
    drawLine(doc, pageW / 2 - 25, y, pageW / 2 + 25, y, 0.8);
    y += 12;

    // ===== 左: 請求先 =====
    doc.setFontSize(14);
    doc.setTextColor(20, 20, 20);
    doc.text(`${inv.companyName}`, mL, y);
    y += 2;
    doc.setFontSize(11);
    doc.text("御中", mL + doc.getTextWidth(inv.companyName) * 14 / doc.getFontSize() + 2, y - 2);
    drawLine(doc, mL, y, mL + 95, y, 0.6);
    y += 4;

    // ===== 右上: 請求日・登録番号 =====
    const rightBlockX = 125;
    let ry = 34;
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text("請求日", rightBlockX, ry);
    doc.setTextColor(30, 30, 30);
    doc.text(issueDate, pageW - mR, ry, { align: "right" });
    ry += 6;
    if (settings.invoice_number) {
      doc.setTextColor(80, 80, 80);
      doc.text("登録番号", rightBlockX, ry);
      doc.setTextColor(30, 30, 30);
      doc.text(settings.invoice_number, pageW - mR, ry, { align: "right" });
      ry += 6;
    }

    // ===== 右: ロゴ + 自社情報 =====
    ry += 4;
    if (logoData) {
      try { doc.addImage(logoData, "PNG", 145, ry - 5, 36, 10); } catch { /* ignore */ }
      ry += 12;
    }
    doc.setFontSize(11);
    doc.setTextColor(20, 20, 20);
    doc.text(settings.company_name || "", pageW - mR - (stampData ? 22 : 0), ry, { align: "right" });
    ry += 6;
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const stampStartY = ry;
    if (settings.company_address) {
      const addrLines = settings.company_address.split("\n");
      for (const line of addrLines) {
        doc.text(line, pageW - mR - (stampData ? 22 : 0), ry, { align: "right" });
        ry += 4;
      }
    }
    if (settings.company_phone) {
      doc.text(`TEL: ${settings.company_phone}`, pageW - mR - (stampData ? 22 : 0), ry, { align: "right" });
      ry += 4;
    }
    if (stampData) {
      try { doc.addImage(stampData, "PNG", pageW - mR - 20, stampStartY - 3, 20, 20); } catch { /* ignore */ }
    }

    // ===== 「下記の通り...」 =====
    y = Math.max(y + 10, ry + 6);
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text("下記の通りご請求申し上げます。", mL, y);
    y += 10;

    // ===== 請求金額ボックス =====
    const amountBoxH = 18;
    drawRect(doc, mL, y - 5, contentW, amountBoxH, [245, 247, 250]);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("ご請求金額（税込）", mL + 4, y);
    y += 7;
    doc.setFontSize(22);
    doc.setTextColor(20, 20, 20);
    doc.text(`¥${fmt(inv.total)}`, mL + 4, y);
    y = y - 7 + amountBoxH + 8;

    // ===== 明細テーブル =====
    const items = inv.items.filter((it) => it.amount > 0 || it.description);
    const maxRows = 8;
    const emptyRows = Math.max(0, maxRows - items.length);

    const colWidths = [contentW * 0.48, contentW * 0.13, contentW * 0.17, contentW * 0.22];
    const rowH = 7;
    const headerH = 8;

    // ヘッダー
    drawRect(doc, mL, y, contentW, headerH, [240, 242, 245]);
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const headers = ["摘要", "数量", "単価", "金額"];
    let cx = mL;
    for (let c = 0; c < 4; c++) {
      doc.text(headers[c], cx + colWidths[c] / 2, y + headerH / 2 + 1, { align: "center" });
      cx += colWidths[c];
    }
    // ヘッダー罫線
    drawLine(doc, mL, y, mL + contentW, y, 0.4);
    drawLine(doc, mL, y + headerH, mL + contentW, y + headerH, 0.4);
    y += headerH;

    // データ行
    doc.setTextColor(30, 30, 30);
    const allRows = [
      ...items.map((item) => [
        item.description,
        `${item.quantity}${item.unit || ""}`,
        `¥${fmt(item.unitPrice)}`,
        `¥${fmt(item.amount)}`,
      ]),
      ...Array(emptyRows).fill(["", "", "", ""]),
    ];

    for (let r = 0; r < allRows.length; r++) {
      const row = allRows[r];
      const ry2 = y + r * rowH;
      // 偶数行に薄い背景
      if (r % 2 === 0 && row[0]) {
        drawRect(doc, mL, ry2, contentW, rowH, [250, 251, 253]);
      }
      cx = mL;
      doc.setFontSize(8);
      // 摘要（左寄せ）
      doc.text(row[0], cx + 3, ry2 + rowH / 2 + 1);
      cx += colWidths[0];
      // 数量（右寄せ）
      doc.text(row[1], cx + colWidths[1] - 3, ry2 + rowH / 2 + 1, { align: "right" });
      cx += colWidths[1];
      // 単価（右寄せ）
      doc.text(row[2], cx + colWidths[2] - 3, ry2 + rowH / 2 + 1, { align: "right" });
      cx += colWidths[2];
      // 金額（右寄せ）
      doc.text(row[3], cx + colWidths[3] - 3, ry2 + rowH / 2 + 1, { align: "right" });
      // 行下の罫線
      drawLine(doc, mL, ry2 + rowH, mL + contentW, ry2 + rowH, 0.15);
    }

    // テーブルの縦罫線
    cx = mL;
    const tableTop = y - headerH;
    const tableBottom = y + allRows.length * rowH;
    drawLine(doc, mL, tableTop, mL, tableBottom, 0.3);
    drawLine(doc, mL + contentW, tableTop, mL + contentW, tableBottom, 0.3);
    for (let c = 0; c < 3; c++) {
      cx += colWidths[c];
      drawLine(doc, cx, tableTop, cx, tableBottom, 0.15);
    }
    // テーブル最下部の太線
    drawLine(doc, mL, tableBottom, mL + contentW, tableBottom, 0.4);

    y = tableBottom + 8;

    // ===== 左下: 振込先 =====
    const bottomY = y;
    if (settings.bank_info) {
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text("お振込先", mL, bottomY);
      drawLine(doc, mL, bottomY + 1.5, mL + 18, bottomY + 1.5, 0.3);

      doc.setFontSize(8);
      doc.setTextColor(30, 30, 30);
      let by = bottomY + 7;
      const bankLines = settings.bank_info.split("\n");
      for (const line of bankLines) {
        doc.text(line, mL + 2, by);
        by += 5;
      }
    }

    // ===== 右下: 合計テーブル =====
    const sumX = pageW - mR - 70;
    const sumW = 70;
    const sumColL = sumW * 0.55;
    const sumColR = sumW * 0.45;
    const sumRowH = 7;
    const sumData: [string, string, boolean][] = [
      ["小計", `¥${fmt(inv.subtotal)}`, false],
      ["消費税", `¥${fmt(inv.tax)}`, false],
      ["合計", `¥${fmt(inv.total)}`, true],
    ];

    let sy = bottomY - 2;
    for (const [label, value, bold] of sumData) {
      if (bold) {
        drawRect(doc, sumX, sy, sumW, sumRowH, [35, 40, 50]);
        doc.setTextColor(255, 255, 255);
      } else {
        drawRect(doc, sumX, sy, sumW, sumRowH);
        doc.setTextColor(30, 30, 30);
      }
      doc.setFontSize(bold ? 9 : 8);
      doc.text(label, sumX + 3, sy + sumRowH / 2 + 1);
      doc.text(value, sumX + sumColL + sumColR - 3, sy + sumRowH / 2 + 1, { align: "right" });
      // 縦の区切り線
      if (!bold) {
        drawLine(doc, sumX + sumColL, sy, sumX + sumColL, sy + sumRowH, 0.15);
      }
      sy += sumRowH;
    }

    // 内訳行
    sy += 2;
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    const breakdownData: [string, string][] = [
      ["10%対象（税抜）", `¥${fmt(inv.subtotal)}`],
      ["10%消費税", `¥${fmt(inv.tax)}`],
    ];
    for (const [label, value] of breakdownData) {
      drawRect(doc, sumX, sy, sumW, 5.5);
      doc.text(`内訳  ${label}`, sumX + 2, sy + 3.5);
      doc.text(value, sumX + sumW - 3, sy + 3.5, { align: "right" });
      sy += 5.5;
    }

    // ===== 備考 =====
    const notesY = Math.max(sy + 6, y + 35);
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text("備考", mL, notesY);
    drawLine(doc, mL, notesY + 1.5, mL + 10, notesY + 1.5, 0.3);
    doc.setTextColor(30, 30, 30);
    if (templateNotes) {
      const noteLines = templateNotes.split("\n");
      let ny = notesY + 6;
      for (const line of noteLines) {
        doc.text(line, mL + 2, ny);
        ny += 4.5;
      }
    }

    // ===== ページ番号 =====
    if (invoices.length > 1) {
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `${idx + 1} / ${invoices.length}`,
        pageW / 2,
        pageH - 10,
        { align: "center" }
      );
    }
  }

  doc.save(`請求書_${invoiceMonth}.pdf`);
}
