import type { Settings } from "./database.types";
import type { CompanyInvoice } from "./invoiceCalc";

const fmt = (n: number) => n.toLocaleString();

function generateInvoiceNumber(): string {
  const ts = Date.now().toString();
  const last10 = ts.slice(-10).padStart(10, "0");
  return `INV-${last10}`;
}

/**
 * InvoicePageのHTMLを生成（invoice-preview.jsxと完全一致）
 */
function buildInvoiceHTML(
  inv: CompanyInvoice,
  settings: Settings,
  issueDate: string,
  invoiceNumber: string,
  dueDate?: string,
  notes?: string
): string {
  const subtotal = inv.subtotal;
  const tax = inv.tax;
  const total = inv.total;
  const items = inv.items.filter((it) => it.amount > 0 || it.description);
  const emptyRows = Math.max(0, 8 - items.length);
  const cb = "0.5px solid #333";

  const itemRows = items
    .map(
      (item) => `
    <tr>
      <td style="padding:8px 8px;border-bottom:${cb};border-left:${cb};border-right:${cb}">${item.description}</td>
      <td style="padding:8px 8px;text-align:right;border-bottom:${cb};border-right:${cb}">${item.quantity}${item.unit || ""}</td>
      <td style="padding:8px 8px;text-align:right;border-bottom:${cb};border-right:${cb}">${fmt(item.unitPrice)}</td>
      <td style="padding:8px 8px;text-align:right;border-bottom:${cb};border-right:${cb}">${fmt(item.amount)}</td>
    </tr>`
    )
    .join("");

  const emptyRowsHTML = Array.from({ length: emptyRows })
    .map(
      () => `
    <tr>
      <td style="padding:8px 8px;border-bottom:${cb};border-left:${cb};border-right:${cb}">&nbsp;</td>
      <td style="padding:8px 8px;border-bottom:${cb};border-right:${cb}"></td>
      <td style="padding:8px 8px;border-bottom:${cb};border-right:${cb}"></td>
      <td style="padding:8px 8px;border-bottom:${cb};border-right:${cb}"></td>
    </tr>`
    )
    .join("");

  const infoRows = [
    ["請求日", issueDate],
    ["請求書番号", invoiceNumber],
    ...(settings.invoice_number ? [["登録番号", settings.invoice_number]] : []),
  ]
    .map(
      ([l, v]) => `
    <tr style="border-bottom:0.5px solid #999">
      <td style="padding:3px 12px 3px 6px;text-align:left;color:#333;font-weight:500">${l}</td>
      <td style="padding:3px 6px 3px 12px;text-align:right;font-weight:600">${v}</td>
    </tr>`
    )
    .join("");

  return `
<div style="width:700px;height:990px;background:#fff;font-family:'Noto Sans JP',sans-serif;padding:42px 48px 34px;box-sizing:border-box;position:relative;font-size:13px;color:#1a1a1a;line-height:1.65;overflow:hidden">
  <!-- タイトル -->
  <div style="text-align:center;margin-bottom:28px">
    <div style="font-size:24px;font-weight:700;letter-spacing:8px;display:inline-block">
      請求書
      <div style="border-bottom:2px solid #1a1a1a;margin-top:4px"></div>
    </div>
  </div>

  <!-- ヘッダー -->
  <div style="display:flex;justify-content:space-between;margin-bottom:10px">
    <div style="max-width:290px">
      <div style="font-size:18px;font-weight:700;margin-bottom:3px">${inv.companyName}　御中</div>
    </div>
    <div style="text-align:right">
      <table style="margin-left:auto;border-collapse:collapse;font-size:12.5px;margin-bottom:14px">
        <tbody>${infoRows}</tbody>
      </table>
      <div style="font-size:15px;font-weight:700;margin-bottom:4px">${settings.company_name || ""}</div>
      ${
        settings.company_address
          ? `<div style="font-size:11.5px;color:#555">（本店所在地）</div>
             <div style="font-size:12.5px;white-space:pre-line">${settings.company_address}</div>`
          : ""
      }
    </div>
  </div>

  <!-- 本文 -->
  <div style="font-size:13px;margin-top:14px;margin-bottom:16px">下記の通りご請求申し上げます。</div>

  <!-- 請求金額 -->
  <div style="margin-bottom:18px">
    <div style="display:flex;align-items:baseline;gap:12px">
      <span style="font-size:13px;font-weight:700">請求金額</span>
      <span style="font-size:24px;font-weight:700;letter-spacing:1px">${fmt(total)}<span style="font-size:14px">円</span></span>
    </div>
    <div style="border-bottom:2.5px solid #1a1a1a;margin-top:4px;width:45%"></div>
  </div>

  <!-- 明細テーブル -->
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead>
      <tr>
        <th style="padding:8px 8px;text-align:center;font-weight:700;width:48%;border-top:${cb};border-bottom:${cb};border-left:${cb};border-right:${cb}">摘要</th>
        <th style="padding:8px 8px;text-align:center;font-weight:700;width:10%;border-top:${cb};border-bottom:${cb};border-right:${cb}">数量</th>
        <th style="padding:8px 8px;text-align:center;font-weight:700;width:18%;border-top:${cb};border-bottom:${cb};border-right:${cb}">単価</th>
        <th style="padding:8px 8px;text-align:center;font-weight:700;width:18%;border-top:${cb};border-bottom:${cb};border-right:${cb}">明細金額</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      ${emptyRowsHTML}
    </tbody>
  </table>

  <!-- 下部 -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:10px">
    <div style="font-size:12.5px;margin-top:18px">
      ${dueDate ? `<div style="margin-bottom:5px"><span style="font-weight:700">入金期日</span><span style="margin-left:14px">${dueDate}</span></div>` : ""}
      <div>
        <span style="font-weight:700">振込先</span>
        <span style="margin-left:14px;white-space:pre-line">${settings.bank_info || ""}</span>
      </div>
    </div>
    <table style="border-collapse:collapse;font-size:13px;margin-top:6px">
      <tbody>
        <tr>
          <td style="padding:6px 14px;font-weight:600;border-top:${cb};border-bottom:${cb};border-left:${cb}">小計</td>
          <td style="padding:6px 18px;text-align:right;border-top:${cb};border-bottom:${cb};border-right:${cb}">${fmt(subtotal)}円</td>
        </tr>
        <tr>
          <td style="padding:6px 14px;font-weight:600;border-bottom:${cb};border-left:${cb}">消費税</td>
          <td style="padding:6px 18px;text-align:right;border-bottom:${cb};border-right:${cb}">${fmt(tax)}円</td>
        </tr>
        <tr>
          <td style="padding:6px 14px;font-weight:700;border-bottom:${cb};border-left:${cb}">合計</td>
          <td style="padding:6px 18px;text-align:right;font-weight:700;border-bottom:${cb};border-right:${cb}">${fmt(total)}円</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- 備考 -->
  <div style="margin-top:16px;border:0.5px solid #999;border-radius:2px;padding:10px 12px;min-height:80px">
    <div style="font-size:11.5px;font-weight:700;color:#444;margin-bottom:2px">備考</div>
    <div style="white-space:pre-line;font-size:12.5px">${notes || ""}</div>
  </div>
</div>`;
}

export async function generateInvoicePDF(
  settings: Settings,
  invoices: CompanyInvoice[],
  invoiceMonth: string,
  templateNotes?: string,
  dueDate?: string
) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas-pro"),
  ]);

  const today = new Date();
  const issueDate = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // Noto Sans JP フォントをロード（html2canvasがレンダリングに使う）
  const fontLink = document.createElement("link");
  fontLink.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800&display=swap";
  fontLink.rel = "stylesheet";
  document.head.appendChild(fontLink);
  // フォントロード待ち
  await new Promise((r) => setTimeout(r, 500));

  // オフスクリーンコンテナ
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  document.body.appendChild(container);

  try {
    for (let idx = 0; idx < invoices.length; idx++) {
      const inv = invoices[idx];
      if (idx > 0) doc.addPage();

      const invoiceNumber = generateInvoiceNumber();
      const html = buildInvoiceHTML(inv, settings, issueDate, invoiceNumber, dueDate, templateNotes);

      container.innerHTML = html;

      // html2canvasでキャプチャ（scale:2で高解像度）
      const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: 700,
        height: 990,
      });

      // A4サイズに合わせて配置 (210mm x 297mm)
      const imgData = canvas.toDataURL("image/png");
      doc.addImage(imgData, "PNG", 0, 0, 210, 297);
    }

    doc.save(`請求書_${invoiceMonth}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * 単一企業のPDFをbase64で生成（メール添付用）
 */
export async function generateInvoicePDFBase64(
  settings: Settings,
  inv: CompanyInvoice,
  invoiceMonth: string,
  templateNotes?: string,
  dueDate?: string
): Promise<string> {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas-pro"),
  ]);

  const today = new Date();
  const issueDate = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  document.body.appendChild(container);

  try {
    const invoiceNumber = generateInvoiceNumber();
    const html = buildInvoiceHTML(inv, settings, issueDate, invoiceNumber, dueDate, templateNotes);
    container.innerHTML = html;

    const canvas = await html2canvas(container.firstElementChild as HTMLElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      width: 700,
      height: 990,
    });

    const imgData = canvas.toDataURL("image/png");
    doc.addImage(imgData, "PNG", 0, 0, 210, 297);

    // base64でPDFデータを返す（data:application/pdf;base64,... のプレフィックスなし）
    const pdfOutput = doc.output("datauristring");
    return pdfOutput.split(",")[1]; // base64部分のみ
  } finally {
    document.body.removeChild(container);
  }
}
