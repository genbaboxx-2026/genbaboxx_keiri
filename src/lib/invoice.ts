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

// 罫線ヘルパー
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawLine(doc: any, x1: number, y1: number, x2: number, y2: number, width = 0.3) {
  doc.setLineWidth(width);
  doc.setDrawColor(51, 51, 51);
  doc.line(x1, y1, x2, y2);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function drawRect(doc: any, x: number, y: number, w: number, h: number) {
  doc.setLineWidth(0.18);
  doc.setDrawColor(51, 51, 51);
  doc.rect(x, y, w, h);
}

function generateInvoiceNumber(): string {
  const ts = Date.now().toString();
  const last10 = ts.slice(-10).padStart(10, "0");
  return `INV-${last10}`;
}

export async function generateInvoicePDF(
  settings: Settings,
  invoices: CompanyInvoice[],
  invoiceMonth: string,
  templateNotes?: string,
  dueDate?: string
) {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await loadJapaneseFont(doc);
  doc.setFont("NotoSansJP", "normal");

  const today = new Date();
  const issueDate = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;
  const pageW = 210;
  const mL = 18;
  const mR = 18;
  const contentW = pageW - mL - mR;

  for (let idx = 0; idx < invoices.length; idx++) {
    const inv = invoices[idx];
    if (idx > 0) doc.addPage();

    const invoiceNumber = generateInvoiceNumber();

    let y = 18;

    // ===== タイトル =====
    doc.setFontSize(22);
    doc.setTextColor(26, 26, 26);
    doc.text("請 求 書", pageW / 2, y, { align: "center", charSpace: 2.5 });
    y += 3.5;
    drawLine(doc, pageW / 2 - 16, y, pageW / 2 + 16, y, 0.7);
    y += 10;

    // ===== 左: 請求先 =====
    const headerY = y;
    doc.setFontSize(16);
    doc.setTextColor(26, 26, 26);
    const companyNameWidth = doc.getTextWidth(inv.companyName);
    doc.text(inv.companyName, mL, y);
    doc.setFontSize(16);
    doc.text("御中", mL + companyNameWidth + 3, y);
    y += 7;

    // ===== 右上: 請求情報テーブル =====
    const rightTableX = 130;
    const rightTableW = pageW - mR - rightTableX;
    const rightLabelX = rightTableX;
    const rightValueX = pageW - mR;
    let ry = headerY - 5;

    doc.setFontSize(10);
    // 請求日
    doc.setTextColor(51, 51, 51);
    doc.text("請求日", rightLabelX, ry);
    doc.setTextColor(30, 30, 30);
    doc.text(issueDate, rightValueX, ry, { align: "right" });
    ry += 1;
    drawLine(doc, rightTableX, ry, rightValueX, ry, 0.2);
    ry += 5;

    // 請求書番号
    doc.setTextColor(51, 51, 51);
    doc.text("請求書番号", rightLabelX, ry);
    doc.setTextColor(30, 30, 30);
    doc.text(invoiceNumber, rightValueX, ry, { align: "right" });
    ry += 1;
    drawLine(doc, rightTableX, ry, rightValueX, ry, 0.2);
    ry += 5;

    // 登録番号
    if (settings.invoice_number) {
      doc.setTextColor(51, 51, 51);
      doc.text("登録番号", rightLabelX, ry);
      doc.setTextColor(30, 30, 30);
      doc.text(settings.invoice_number, rightValueX, ry, { align: "right" });
      ry += 1.5;
      drawLine(doc, rightTableX, ry, rightValueX, ry, 0.2);
      ry += 5.5;
    }

    // 自社情報（右寄せ）
    ry += 3;
    doc.setFontSize(13);
    doc.setTextColor(26, 26, 26);
    doc.text(settings.company_name || "", rightValueX, ry, { align: "right" });
    ry += 5;

    if (settings.company_address) {
      doc.setFontSize(9.5);
      doc.setTextColor(85, 85, 85);
      doc.text("（本店所在地）", rightValueX, ry, { align: "right" });
      ry += 4;
      doc.setFontSize(10);
      doc.setTextColor(51, 51, 51);
      const addrLines = settings.company_address.split("\n");
      for (const line of addrLines) {
        doc.text(line, rightValueX, ry, { align: "right" });
        ry += 4;
      }
    }

    // ===== 「下記の通り...」 =====
    y = Math.max(y + 6, ry + 3);
    doc.setFontSize(10);
    doc.setTextColor(26, 26, 26);
    doc.text("下記の通りご請求申し上げます。", mL, y);
    y += 8;

    // ===== 請求金額 =====
    doc.setFontSize(11);
    doc.setTextColor(26, 26, 26);
    const labelW = doc.getTextWidth("請求金額");
    doc.text("請求金額", mL, y);

    doc.setFontSize(20);
    const amountStr = fmt(inv.total);
    const amountW = doc.getTextWidth(amountStr);
    doc.text(amountStr, mL + labelW + 3, y);

    doc.setFontSize(12);
    doc.text("円", mL + labelW + 3 + amountW + 1, y);

    y += 3;
    drawLine(doc, mL, y, mL + contentW * 0.45, y, 0.9);
    y += 6;

    // ===== 明細テーブル =====
    const items = inv.items.filter((it) => it.amount > 0 || it.description);
    const maxRows = 8;
    const emptyRows = Math.max(0, maxRows - items.length);

    const colWidths = [contentW * 0.50, contentW * 0.12, contentW * 0.18, contentW * 0.20];
    const rowH = 6;
    const headerH = 7;

    // ヘッダー
    const tableStartY = y;
    drawRect(doc, mL, y, contentW, headerH);
    doc.setFontSize(10);
    doc.setTextColor(26, 26, 26);
    const headers = ["摘要", "数量", "単価", "明細金額"];
    let cx = mL;
    for (let c = 0; c < 4; c++) {
      doc.text(headers[c], cx + colWidths[c] / 2, y + headerH / 2 + 1.5, { align: "center" });
      if (c < 3) {
        drawLine(doc, cx + colWidths[c], y, cx + colWidths[c], y + headerH, 0.18);
      }
      cx += colWidths[c];
    }
    y += headerH;

    // データ行
    doc.setTextColor(30, 30, 30);
    const allRows = [
      ...items.map((item) => [
        item.description,
        `${item.quantity}${item.unit || ""}`,
        fmt(item.unitPrice),
        fmt(item.amount),
      ]),
      ...Array(emptyRows).fill(["", "", "", ""]),
    ];

    for (let r = 0; r < allRows.length; r++) {
      const row = allRows[r];
      const ry2 = y + r * rowH;
      // Row borders (all cells)
      drawRect(doc, mL, ry2, contentW, rowH);
      cx = mL;
      doc.setFontSize(10);
      // 摘要（左寄せ）
      doc.text(row[0], cx + 3, ry2 + rowH / 2 + 1.5);
      cx += colWidths[0];
      drawLine(doc, cx, ry2, cx, ry2 + rowH, 0.18);
      // 数量（右寄せ）
      doc.text(row[1], cx + colWidths[1] - 3, ry2 + rowH / 2 + 1.5, { align: "right" });
      cx += colWidths[1];
      drawLine(doc, cx, ry2, cx, ry2 + rowH, 0.18);
      // 単価（右寄せ）
      doc.text(row[2], cx + colWidths[2] - 3, ry2 + rowH / 2 + 1.5, { align: "right" });
      cx += colWidths[2];
      drawLine(doc, cx, ry2, cx, ry2 + rowH, 0.18);
      // 金額（右寄せ）
      doc.text(row[3], cx + colWidths[3] - 3, ry2 + rowH / 2 + 1.5, { align: "right" });
    }

    const tableBottom = y + allRows.length * rowH;
    y = tableBottom + 5;

    // ===== 左下: 入金期日 + 振込先 =====
    const bottomY = y;
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);

    let by = bottomY;
    if (dueDate) {
      doc.text("入金期日", mL, by);
      const labelEnd = mL + doc.getTextWidth("入金期日");
      doc.setFontSize(12.5);
      doc.text(`　${dueDate.replace(/-/g, "/")}`, labelEnd, by);
      by += 5;
    }

    doc.setFontSize(10);
    doc.text("振込先", mL, by);
    by += 4;

    if (settings.bank_info) {
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      const bankLines = settings.bank_info.split("\n");
      for (const line of bankLines) {
        doc.text(line, mL + 2, by);
        by += 5;
      }
    }

    // ===== 右下: 合計テーブル (小計/消費税/合計のみ) =====
    const sumW = 70;
    const sumX = pageW - mR - sumW;
    const sumRowH = 6;
    const sumData: [string, string, boolean][] = [
      ["小計", `${fmt(inv.subtotal)}円`, false],
      ["消費税", `${fmt(inv.tax)}円`, false],
      ["合計", `${fmt(inv.total)}円`, true],
    ];

    let sy = bottomY - 2;
    for (const [label, value, bold] of sumData) {
      drawRect(doc, sumX, sy, sumW, sumRowH);
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(bold ? 10 : 9.5);
      const midColX = sumX + sumW * 0.4;
      drawLine(doc, midColX, sy, midColX, sy + sumRowH, 0.18);
      doc.text(label, sumX + 3, sy + sumRowH / 2 + 1.5);
      doc.text(value, sumX + sumW - 3, sy + sumRowH / 2 + 1.5, { align: "right" });
      sy += sumRowH;
    }

    // ===== 備考 =====
    const notesY = Math.max(sy + 5, by + 3);
    doc.setFontSize(9);
    doc.setTextColor(68, 68, 68);
    drawRect(doc, mL, notesY - 3, contentW, 22);
    doc.text("備考", mL + 3, notesY + 1);
    doc.setTextColor(30, 30, 30);
    if (templateNotes) {
      const noteLines = templateNotes.split("\n");
      let ny = notesY + 7;
      for (const line of noteLines) {
        doc.text(line, mL + 3, ny);
        ny += 5;
      }
    }
  }

  doc.save(`請求書_${invoiceMonth}.pdf`);
}
