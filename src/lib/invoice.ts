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

function generateInvoiceNumber(): string {
  const ts = Date.now().toString();
  const last10 = ts.slice(-10).padStart(10, "0");
  return `INV-${last10}`;
}

// 1px(700px canvas) = 0.3mm(A4 210mm)
// padding: left/right 48px = 14.4mm, top 42px = 12.6mm, bottom 34px = 10.2mm
// A4: 210 x 297 mm

export async function generateInvoicePDF(
  settings: Settings,
  invoices: CompanyInvoice[],
  invoiceMonth: string,
  templateNotes?: string,
  dueDate?: string
) {
  const { jsPDF } = await import("jspdf");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc: any = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  await loadJapaneseFont(doc);
  doc.setFont("NotoSansJP", "normal");

  const today = new Date();
  const issueDate = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;

  const mL = 14.4;   // 48px
  const mR = 14.4;   // 48px
  const mT = 12.6;   // 42px
  const pageW = 210;
  const contentW = pageW - mL - mR; // 181.2mm

  // 罫線ヘルパー
  const line = (x1: number, y1: number, x2: number, y2: number, w = 0.15) => {
    doc.setLineWidth(w);
    doc.setDrawColor(51, 51, 51);
    doc.line(x1, y1, x2, y2);
  };
  const rect = (x: number, y: number, w: number, h: number) => {
    doc.setLineWidth(0.15);
    doc.setDrawColor(51, 51, 51);
    doc.rect(x, y, w, h);
  };

  for (let idx = 0; idx < invoices.length; idx++) {
    const inv = invoices[idx];
    if (idx > 0) doc.addPage();

    const invoiceNumber = generateInvoiceNumber();
    let y = mT;

    // ===== タイトル「請求書」 =====
    // fontSize:24, letterSpacing:8px=2.4mm, marginBottom:28px=8.4mm
    doc.setFontSize(24);
    doc.setTextColor(26, 26, 26);
    doc.text("請 求 書", pageW / 2, y, { align: "center", charSpace: 2.4 });
    y += 4; // underline position
    line(pageW / 2 - 18, y, pageW / 2 + 18, y, 0.6);
    y += 8.4; // marginBottom 28px

    // ===== ヘッダー: 左=請求先, 右=請求情報+自社 =====
    const headerStartY = y;

    // 左: 請求先 (fontSize:18, fontWeight:700, marginBottom:3px=0.9mm)
    doc.setFontSize(18);
    doc.setTextColor(26, 26, 26);
    doc.text(`${inv.companyName}　御中`, mL, y);

    // 右: 請求情報テーブル (fontSize:12.5, marginBottom:14px=4.2mm)
    const rightX = 130; // テーブル左端
    const rightEnd = pageW - mR; // テーブル右端
    let ry = headerStartY - 3;

    doc.setFontSize(12.5);
    // 請求日
    doc.setTextColor(51, 51, 51);
    doc.text("請求日", rightX + 1.8, ry);
    doc.setTextColor(26, 26, 26);
    doc.text(issueDate, rightEnd - 1.8, ry, { align: "right" });
    ry += 1.5;
    line(rightX, ry, rightEnd, ry, 0.15);
    ry += 5;

    // 請求書番号
    doc.setTextColor(51, 51, 51);
    doc.text("請求書番号", rightX + 1.8, ry);
    doc.setTextColor(26, 26, 26);
    doc.text(invoiceNumber, rightEnd - 1.8, ry, { align: "right" });
    ry += 1.5;
    line(rightX, ry, rightEnd, ry, 0.15);
    ry += 5;

    // 登録番号
    if (settings.invoice_number) {
      doc.setTextColor(51, 51, 51);
      doc.text("登録番号", rightX + 1.8, ry);
      doc.setTextColor(26, 26, 26);
      doc.text(settings.invoice_number, rightEnd - 1.8, ry, { align: "right" });
      ry += 1.5;
      line(rightX, ry, rightEnd, ry, 0.15);
      ry += 5;
    }

    // 自社情報 (marginTop:14px=4.2mm from table)
    ry += 4.2;
    // 会社名 fontSize:15, fontWeight:700, marginBottom:4px=1.2mm
    doc.setFontSize(15);
    doc.setTextColor(26, 26, 26);
    doc.text(settings.company_name || "", rightEnd, ry, { align: "right" });
    ry += 5.5;

    // （本店所在地） fontSize:11.5, color:#555
    if (settings.company_address) {
      doc.setFontSize(11.5);
      doc.setTextColor(85, 85, 85);
      doc.text("（本店所在地）", rightEnd, ry, { align: "right" });
      ry += 4.5;
      // 住所 fontSize:12.5
      doc.setFontSize(12.5);
      doc.setTextColor(26, 26, 26);
      const addrLines = settings.company_address.split("\n");
      for (const addrLine of addrLines) {
        doc.text(addrLine, rightEnd, ry, { align: "right" });
        ry += 4.5;
      }
    }

    // ===== 「下記の通り...」 =====
    // marginTop:14px=4.2mm, marginBottom:16px=4.8mm, fontSize:13
    y = Math.max(headerStartY + 8, ry + 2);
    y += 4.2;
    doc.setFontSize(13);
    doc.setTextColor(26, 26, 26);
    doc.text("下記の通りご請求申し上げます。", mL, y);
    y += 4.8;

    // ===== 請求金額 =====
    // marginBottom:18px=5.4mm
    // 「請求金額」fontSize:13 fontWeight:700
    // 金額 fontSize:24 fontWeight:700 letterSpacing:1
    // 「円」fontSize:14
    y += 2;
    doc.setFontSize(13);
    doc.setTextColor(26, 26, 26);
    const lbl = "請求金額";
    const lblW = doc.getTextWidth(lbl);
    doc.text(lbl, mL, y);

    doc.setFontSize(24);
    const amtStr = fmt(inv.total);
    const amtW = doc.getTextWidth(amtStr);
    doc.text(amtStr, mL + lblW + 3.6, y); // gap:12px=3.6mm

    doc.setFontSize(14);
    doc.text("円", mL + lblW + 3.6 + amtW + 0.3, y);

    y += 2.5;
    // 2.5px=0.75mm underline, width:45%
    line(mL, y, mL + contentW * 0.45, y, 0.75);
    y += 5.4;

    // ===== 明細テーブル =====
    const items = inv.items.filter((it) => it.amount > 0 || it.description);
    const maxRows = 8;
    const emptyRows = Math.max(0, maxRows - items.length);

    // テーブル幅 = contentW, 列: 48% 10% 18% 18% (残り6%=rightに吸収→20%)
    const cols = [contentW * 0.48, contentW * 0.10, contentW * 0.18, contentW * 0.24];
    // padding:8px=2.4mm → rowH ≈ 7mm
    const hdrH = 7;
    const rowH = 7;
    const cb = 0.15; // border width

    // ヘッダー
    doc.setFontSize(13);
    doc.setTextColor(26, 26, 26);
    const hdrs = ["摘要", "数量", "単価", "明細金額"];
    let cx = mL;
    for (let c = 0; c < 4; c++) {
      rect(cx, y, cols[c], hdrH);
      doc.text(hdrs[c], cx + cols[c] / 2, y + hdrH / 2 + 1.8, { align: "center" });
      cx += cols[c];
    }
    y += hdrH;

    // データ行
    doc.setFontSize(13);
    const allRows = [
      ...items.map((item) => [
        item.description,
        `${item.quantity}${item.unit || ""}`,
        fmt(item.unitPrice),
        fmt(item.amount),
      ]),
      ...Array(emptyRows).fill(["", "", "", ""]),
    ];

    for (const row of allRows) {
      cx = mL;
      doc.setTextColor(26, 26, 26);
      for (let c = 0; c < 4; c++) {
        rect(cx, y, cols[c], rowH);
        if (c === 0) {
          // 摘要: 左寄せ
          doc.text(row[c], cx + 2.4, y + rowH / 2 + 1.8);
        } else {
          // 数量・単価・金額: 右寄せ
          doc.text(row[c], cx + cols[c] - 2.4, y + rowH / 2 + 1.8, { align: "right" });
        }
        cx += cols[c];
      }
      y += rowH;
    }

    y += 3; // marginTop:10px=3mm

    // ===== 下部: 左=入金期日+振込先, 右=合計テーブル =====
    const bottomY = y;

    // 左: 入金期日 + 振込先 (fontSize:12.5, marginTop:18px=5.4mm)
    let by = bottomY + 5.4;
    doc.setFontSize(12.5);
    doc.setTextColor(26, 26, 26);

    if (dueDate) {
      doc.text("入金期日", mL, by);
      doc.text(dueDate.replace(/-/g, "/"), mL + doc.getTextWidth("入金期日") + 4.2, by);
      by += 5;
    }

    doc.text("振込先", mL, by);
    if (settings.bank_info) {
      const bankText = settings.bank_info.replace(/\n/g, "　");
      doc.text(bankText, mL + doc.getTextWidth("振込先") + 4.2, by);
      by += 5;
      // 改行がある場合は各行も表示
      const bankLines = settings.bank_info.split("\n");
      if (bankLines.length > 1) {
        // 1行にまとめたので追加行は不要
      }
    }

    // 右: 合計テーブル (fontSize:13, marginTop:6px=1.8mm)
    // padding:6px 14px = 1.8mm 4.2mm (左) / 6px 18px = 1.8mm 5.4mm (右)
    const sumW = 60;
    const sumX = pageW - mR - sumW;
    const sumRowH = 7;
    const sumLabelW = sumW * 0.38;
    let sy = bottomY + 1.8;

    const sumData: [string, string, boolean][] = [
      ["小計", `${fmt(inv.subtotal)}円`, false],
      ["消費税", `${fmt(inv.tax)}円`, false],
      ["合計", `${fmt(inv.total)}円`, true],
    ];

    doc.setTextColor(26, 26, 26);
    for (const [label, value, bold] of sumData) {
      doc.setFontSize(13);
      // 左セル (label)
      line(sumX, sy, sumX, sy + sumRowH, cb); // 左枠
      line(sumX, sy + sumRowH, sumX + sumW, sy + sumRowH, cb); // 下枠
      if (sy === bottomY + 1.8) line(sumX, sy, sumX + sumW, sy, cb); // 上枠（最初の行のみ）
      line(sumX + sumLabelW, sy, sumX + sumLabelW, sy + sumRowH, cb); // 中間仕切り
      line(sumX + sumW, sy, sumX + sumW, sy + sumRowH, cb); // 右枠

      doc.text(label, sumX + 4.2, sy + sumRowH / 2 + 1.8);
      if (bold) {
        doc.text(value, sumX + sumW - 5.4, sy + sumRowH / 2 + 1.8, { align: "right" });
      } else {
        doc.text(value, sumX + sumW - 5.4, sy + sumRowH / 2 + 1.8, { align: "right" });
      }
      sy += sumRowH;
    }

    // ===== 備考 =====
    // marginTop:16px=4.8mm, border:0.5px solid #999, borderRadius:2, padding:10px 12px=3mm 3.6mm, minHeight:80px=24mm
    const notesTop = Math.max(sy + 4.8, by + 3);
    const notesH = 24;
    doc.setDrawColor(153, 153, 153);
    doc.setLineWidth(0.15);
    doc.rect(mL, notesTop, contentW, notesH);

    // 「備考」ラベル fontSize:11.5, fontWeight:700, color:#444
    doc.setFontSize(11.5);
    doc.setTextColor(68, 68, 68);
    doc.text("備考", mL + 3.6, notesTop + 4);

    // 備考テキスト
    if (templateNotes) {
      doc.setFontSize(12.5);
      doc.setTextColor(30, 30, 30);
      let ny = notesTop + 9;
      const noteLines = templateNotes.split("\n");
      for (const noteLine of noteLines) {
        doc.text(noteLine, mL + 3.6, ny);
        ny += 4.5;
      }
    }
  }

  doc.save(`請求書_${invoiceMonth}.pdf`);
}
