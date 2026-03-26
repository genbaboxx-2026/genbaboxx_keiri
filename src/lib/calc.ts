import type { CloseOffset, PayType, ContractStatus } from "./database.types";

/** 締め+払いから入金月オフセットを計算 */
export function calcPayOffset(close: CloseOffset, pay: PayType): number {
  const payOffset = pay === "next2_10" ? 2 : pay.startsWith("next") ? 1 : 0;
  return parseInt(close) + payOffset;
}

/** base月にoffsetを足した月番号(1-12)を返す */
export function monthAt(base: number, offset: number): number {
  const m = base + offset;
  return ((m - 1 + 120) % 12) + 1;
}

/** 締め/払い条件の説明テキスト（例: "4月締5月末払"） */
export function payDescription(
  close: CloseOffset,
  pay: PayType,
  baseMonth: number
): string {
  if (!baseMonth) return "";
  const clM = monthAt(baseMonth, parseInt(close));
  const pyM = pay === "same_end" ? clM : pay === "next2_10" ? monthAt(clM, 2) : monthAt(clM, 1);
  const dayLabel = pay.includes("10") ? "10日" : "末";
  return `${clM}月締${pyM}月${dayLabel}払`;
}

/** 締め/払い条件の汎用説明テキスト（例: "当月締翌月末払い"） */
export function payDescriptionGeneric(close: CloseOffset, pay: PayType): string {
  const closeLabel = close === "-1" ? "前月" : close === "0" ? "当月" : "翌月";
  const payLabel =
    pay === "same_end" ? "当月末" : pay === "next_end" ? "翌月末" : pay === "next2_10" ? "翌々月10日" : "翌月10日";
  return `${closeLabel}締${payLabel}払い`;
}

/** 起算日(YYYY-MM-DD) + 契約期間(ヶ月) → 契約完了日(YYYY-MM-DD) */
export function calcEndDate(
  startDate: string,
  durationMonths: number
): string {
  if (!startDate || !durationMonths) return "";
  const [y, m, d] = startDate.split("-").map(Number);
  const date = new Date(y, m - 1 + durationMonths, d);
  date.setDate(date.getDate() - 1);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** billing_month + billing_day → 起算日(YYYY-MM-DD) */
export function makeBillingStart(
  billingMonth: string,
  billingDay: string
): string {
  if (!billingMonth) return "";
  return `${billingMonth}-${String(parseInt(billingDay)).padStart(2, "0")}`;
}

/** 起算日から契約期間分の月リスト(YYYY-MM)を返す */
export function billingMonths(
  startDate: string,
  durationMonths: number
): string[] {
  if (!startDate || !durationMonths) return [];
  const [y, m] = startDate.split("-").map(Number);
  const result: string[] = [];
  for (let i = 0; i < durationMonths; i++) {
    const mm = ((m - 1 + i) % 12) + 1;
    const yy = y + Math.floor((m - 1 + i) / 12);
    result.push(`${yy}-${String(mm).padStart(2, "0")}`);
  }
  return result;
}

/** YYYY-MM にオフセット月を加算 */
export function shiftMonth(ym: string, offset: number): string {
  if (offset === 0) return ym;
  const [y, m] = ym.split("-").map(Number);
  const n = m + offset;
  const newY = y + Math.floor((n - 1) / 12);
  const newM = ((n - 1 + 120) % 12) + 1;
  return `${newY}-${String(newM).padStart(2, "0")}`;
}

/** 契約開始日 + 起算日 → 起算月の自動提案(YYYY-MM) */
export function suggestBillingMonth(
  contractStartDate: string,
  billingDay: string
): string {
  if (!contractStartDate) return "";
  const [y, m, d] = contractStartDate.split("-").map(Number);
  const bd = parseInt(billingDay);
  if (d <= bd) {
    return `${y}-${String(m).padStart(2, "0")}`;
  }
  // 翌月
  const nm = m + 1;
  const ny = y + Math.floor((nm - 1) / 12);
  const nmm = ((nm - 1) % 12) + 1;
  return `${ny}-${String(nmm).padStart(2, "0")}`;
}

/** 自動更新中の契約は翌月まで期間を延長 */
export function effectiveDuration(
  billingMonth: string,
  billingDay: string,
  durationMonths: number,
  contractStatus?: ContractStatus
): number {
  if (contractStatus !== "auto_renewing") return durationMonths;
  const bs = makeBillingStart(billingMonth, billingDay);
  if (!bs) return durationMonths;
  const [sy, sm] = bs.split("-").map(Number);
  const now = new Date();
  // 翌月まで延長（当月+1）
  const monthsToNext = (now.getFullYear() - sy) * 12 + (now.getMonth() + 1 - sm) + 2;
  return Math.max(durationMonths, monthsToNext);
}

/** 全契約から表示対象の全月リスト(sorted)を生成 */
export function getAllMonths(
  contracts: {
    billing_type?: string;
    contract_status?: ContractStatus;
    billing_month: string;
    billing_day: string;
    duration_months: number;
    monthly_close: CloseOffset;
    monthly_pay: PayType;
    has_option: boolean;
    option_close: CloseOffset;
    option_pay: PayType;
    has_initial_fee: boolean;
    initial_close: CloseOffset;
    initial_pay: PayType;
  }[]
): string[] {
  const set = new Set<string>();
  contracts.forEach((c) => {
    const bs = makeBillingStart(c.billing_month, c.billing_day);
    const dur = effectiveDuration(c.billing_month, c.billing_day, c.duration_months, c.contract_status);
    const ms = billingMonths(bs, dur);
    const mo = calcPayOffset(c.monthly_close, c.monthly_pay);
    const isLump = c.billing_type === "lump_sum";
    if (isLump) {
      // 一括: 初月のみ
      if (ms.length > 0) {
        set.add(ms[0]);
        set.add(shiftMonth(ms[0], mo));
      }
    } else {
      // 月額: 全月
      ms.forEach((m) => {
        set.add(m);
        set.add(shiftMonth(m, mo));
      });
    }
    if (c.has_option) {
      const oo = calcPayOffset(c.option_close, c.option_pay);
      ms.forEach((m) => set.add(shiftMonth(m, oo)));
    }
    if (c.has_initial_fee && ms.length > 0) {
      const io = calcPayOffset(c.initial_close, c.initial_pay);
      set.add(shiftMonth(ms[0], io));
    }
  });
  // 現在から18ヶ月分を追加
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    set.add(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  return [...set].sort();
}

/** 特定月の売上を計算（入金月ベース） */
export function getRevenue(
  month: string,
  contracts: {
    billing_type?: string;
    contract_status?: ContractStatus;
    billing_month: string;
    billing_day: string;
    duration_months: number;
    monthly_fee: number;
    fee_months: number;
    monthly_close: CloseOffset;
    monthly_pay: PayType;
    has_initial_fee: boolean;
    initial_fee: number;
    initial_close: CloseOffset;
    initial_pay: PayType;
    has_option: boolean;
    option_fee: number;
    option_close: CloseOffset;
    option_pay: PayType;
    product_type: string;
  }[],
  productFilter?: string
): number {
  return contracts
    .filter((c) => !productFilter || c.product_type === productFilter)
    .reduce((sum, c) => {
      const bs = makeBillingStart(c.billing_month, c.billing_day);
      const dur = effectiveDuration(c.billing_month, c.billing_day, c.duration_months, c.contract_status);
      const ms = billingMonths(bs, dur);
      let amt = 0;
      const mo = calcPayOffset(c.monthly_close, c.monthly_pay);
      const isLump = c.billing_type === "lump_sum";
      const feeMs = (c.fee_months && c.fee_months > 1) ? ms.slice(0, c.fee_months) : ms;
      if (isLump) {
        // 一括: 支払い月に総額を計上
        if (ms.length > 0 && shiftMonth(ms[0], mo) === month) {
          amt += c.monthly_fee * c.duration_months;
        }
      } else {
        // 月額: fee_monthsで請求月数を制限
        feeMs.forEach((m) => {
          if (shiftMonth(m, mo) === month) amt += c.monthly_fee;
        });
      }
      if (c.has_option) {
        const oo = calcPayOffset(c.option_close, c.option_pay);
        ms.forEach((m) => {
          if (shiftMonth(m, oo) === month) amt += c.option_fee;
        });
      }
      if (c.has_initial_fee && ms.length > 0) {
        const io = calcPayOffset(c.initial_close, c.initial_pay);
        if (shiftMonth(ms[0], io) === month) amt += c.initial_fee;
      }
      return sum + amt;
    }, 0);
}

/** 金額フォーマット（3桁カンマ区切り） */
export function formatNumber(n: number): string {
  if (n === 0) return "0";
  return n.toLocaleString("ja-JP");
}

/** 金額フォーマット（¥付き） */
export function formatYen(n: number): string {
  return "¥" + formatNumber(n);
}

/** 日付フォーマット YYYY-MM-DD → YYYY/M/D */
export function formatDate(d: string): string {
  if (!d) return "";
  const p = d.split("-");
  return `${p[0]}/${parseInt(p[1])}/${parseInt(p[2])}`;
}

/** 現在の年月を YYYY-MM 形式で返す */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
