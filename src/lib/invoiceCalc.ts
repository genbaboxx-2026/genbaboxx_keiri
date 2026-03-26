import type { Contract, Company } from "./database.types";
import {
  makeBillingStart,
  billingMonths,
  calcPayOffset,
  shiftMonth,
  effectiveDuration,
} from "./calc";

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface CompanyInvoice {
  companyId: string;
  companyName: string;
  items: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentDueDate: string;
}

/**
 * 指定月の請求データを企業ごとに計算
 */
export function getInvoicesForMonth(
  month: string,
  contracts: Contract[],
  companies: Company[]
): CompanyInvoice[] {
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));
  const byCompany = new Map<string, InvoiceLineItem[]>();

  for (const c of contracts) {
    const bs = makeBillingStart(c.billing_month, c.billing_day);
    const dur = effectiveDuration(
      c.billing_month,
      c.billing_day,
      c.duration_months,
      c.contract_status
    );
    const ms = billingMonths(bs, dur);
    const mo = calcPayOffset(c.monthly_close, c.monthly_pay);
    const isLump = c.billing_type === "lump_sum";
    const feeMs =
      c.fee_months && c.fee_months > 1 ? ms.slice(0, c.fee_months) : ms;

    const items: InvoiceLineItem[] = [];

    // 月額料金
    if (isLump) {
      if (ms.length > 0 && shiftMonth(ms[0], mo) === month) {
        items.push({
          description: `月額料金（${c.duration_months}ヶ月一括）`,
          quantity: c.duration_months,
          unitPrice: c.monthly_fee,
          amount: c.monthly_fee * c.duration_months,
        });
      }
    } else {
      const matchingMonths = feeMs.filter(
        (bm) => shiftMonth(bm, mo) === month
      );
      if (matchingMonths.length > 0) {
        items.push({
          description: "月額料金",
          quantity: matchingMonths.length,
          unitPrice: c.monthly_fee,
          amount: c.monthly_fee * matchingMonths.length,
        });
      }
    }

    // 初期導入費
    if (c.has_initial_fee && ms.length > 0) {
      const io = calcPayOffset(c.initial_close, c.initial_pay);
      if (shiftMonth(ms[0], io) === month) {
        items.push({
          description: "初期導入費",
          quantity: 1,
          unitPrice: c.initial_fee,
          amount: c.initial_fee,
        });
      }
    }

    // オプション
    if (c.has_option) {
      const oo = calcPayOffset(c.option_close, c.option_pay);
      const optMonths = ms.filter((bm) => shiftMonth(bm, oo) === month);
      if (optMonths.length > 0) {
        items.push({
          description: c.option_name || "オプション",
          quantity: optMonths.length,
          unitPrice: c.option_fee,
          amount: c.option_fee * optMonths.length,
        });
      }
    }

    if (items.length > 0) {
      const existing = byCompany.get(c.company_id) || [];
      byCompany.set(c.company_id, [...existing, ...items]);
    }
  }

  const invoices: CompanyInvoice[] = [];
  for (const [companyId, items] of byCompany) {
    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const tax = Math.floor(subtotal * 0.1);
    invoices.push({
      companyId,
      companyName: companyMap.get(companyId) || "不明",
      items,
      subtotal,
      tax,
      total: subtotal + tax,
      paymentDueDate: "",
    });
  }

  return invoices.sort((a, b) => a.companyName.localeCompare(b.companyName));
}
