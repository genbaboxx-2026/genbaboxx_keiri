"use client";

import { useState } from "react";
import type { Company, Contract, ProductType, Expense } from "@/lib/database.types";
import { PRODUCTS } from "@/lib/constants";
import {
  formatNumber,
  getCurrentMonth,
  getRevenue as getRevenueCalc,
  billingMonths,
  makeBillingStart,
  calcPayOffset,
  shiftMonth,
  effectiveDuration,
} from "@/lib/calc";
import { Badge } from "./Badge";

interface CashflowPageProps {
  contracts: Contract[];
  companies: Company[];
  contractsFor: (pid: ProductType) => Contract[];
  allMonths: string[];
  revenueFor: (month: string, productFilter?: string) => number;
  companiesCount: number;
  expenses: Expense[];
  onAddExpense: (name: string, month: string, amount: number) => void;
  onDeleteExpense: (id: string) => void;
}

/** 企業単位の月別売上を計算 */
function companyRevenueForMonth(
  contracts: Contract[],
  companyId: string,
  month: string
): number {
  return contracts
    .filter((c) => c.company_id === companyId)
    .reduce((sum, c) => {
      let amt = 0;
      const bs = makeBillingStart(c.billing_month, c.billing_day);
      const dur = effectiveDuration(c.billing_month, c.billing_day, c.duration_months, c.contract_status);
      const ms = billingMonths(bs, dur);
      const mo = calcPayOffset(c.monthly_close, c.monthly_pay);
      const isLump = c.billing_type === "lump_sum";
      const feeMs = c.fee_months && c.fee_months > 1 ? ms.slice(0, c.fee_months) : ms;

      if (isLump) {
        if (ms.length > 0 && shiftMonth(ms[0], mo) === month)
          amt += c.monthly_fee * c.duration_months;
      } else {
        feeMs.forEach((bm) => {
          if (shiftMonth(bm, mo) === month) amt += c.monthly_fee;
        });
      }
      if (c.has_option) {
        const oo = calcPayOffset(c.option_close, c.option_pay);
        ms.forEach((bm) => {
          if (shiftMonth(bm, oo) === month) amt += c.option_fee;
        });
      }
      if (c.has_initial_fee && ms.length > 0) {
        const io = calcPayOffset(c.initial_close, c.initial_pay);
        if (shiftMonth(ms[0], io) === month) amt += c.initial_fee;
      }
      return sum + amt;
    }, 0);
}

export function CashflowPage({
  contracts,
  companies,
  contractsFor,
  allMonths,
  revenueFor,
  companiesCount,
  expenses,
  onAddExpense,
  onDeleteExpense,
}: CashflowPageProps) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [newExpenseName, setNewExpenseName] = useState("");
  const [newExpenseMonth, setNewExpenseMonth] = useState("");
  const [newExpenseAmount, setNewExpenseAmount] = useState("");

  const currentMonth = getCurrentMonth();

  const toggleProduct = (pid: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  // 支出の月別集計
  const expenseForMonth = (month: string) =>
    expenses
      .filter((e) => e.month === month)
      .reduce((s, e) => s + e.amount, 0);

  // 支出項目名のユニークリスト
  const expenseNames = [...new Set(expenses.map((e) => e.name))];

  const handleAddExpense = () => {
    if (!newExpenseName || !newExpenseMonth || !newExpenseAmount) return;
    onAddExpense(newExpenseName, newExpenseMonth, parseInt(newExpenseAmount.replace(/[^0-9]/g, "")) || 0);
    setNewExpenseAmount("");
  };

  const summaryCards = [
    { label: "企業数", value: companiesCount, unit: "社", color: "text-slate-800", bg: "bg-slate-100" },
    { label: "BAKUSOQ", value: contractsFor("bakusoq").length, unit: "件", color: "text-blue-600", bg: "bg-blue-100" },
    { label: "NiNKUBOXX", value: contractsFor("ninkuboxx").length, unit: "件", color: "text-violet-600", bg: "bg-violet-100" },
    { label: "その他", value: contractsFor("other").length, unit: "件", color: "text-emerald-600", bg: "bg-emerald-100" },
  ];

  return (
    <div>
      <h2 className="text-[22px] font-extrabold mb-2">資金繰り表</h2>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3.5 mb-7">
        {summaryCards.map((card) => (
          <div key={card.label} className={`${card.bg} rounded-[14px] px-5 py-[18px]`}>
            <div className="text-xs text-slate-500 font-semibold">{card.label}</div>
            <div className={`text-[28px] font-extrabold mt-1 ${card.color}`}>
              {card.value}
              <span className="text-sm font-medium ml-1">{card.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-3.5 py-2.5 text-left font-bold sticky left-0 bg-slate-50 border-b-2 border-slate-200 min-w-[160px] z-10">
                項目
              </th>
              {allMonths.map((m) => (
                <th
                  key={m}
                  className={`px-2 py-2.5 text-right font-semibold text-slate-500 border-b-2 border-slate-200 whitespace-nowrap min-w-[90px] ${m === currentMonth ? "month-current" : ""}`}
                >
                  {parseInt(m.split("-")[1])}月
                  <br />
                  <span className="text-[10px] text-slate-400">{m.split("-")[0]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* === 売上セクション === */}
            {PRODUCTS.map((pr) => {
              const isExpanded = expandedProducts.has(pr.id);
              const productContracts = contractsFor(pr.id);
              // この商品に契約がある企業のリスト
              const companyIds = [...new Set(productContracts.map((c) => c.company_id))];

              return (
                <ProductRows
                  key={pr.id}
                  product={pr}
                  isExpanded={isExpanded}
                  onToggle={() => toggleProduct(pr.id)}
                  companyIds={companyIds}
                  companies={companies}
                  contracts={productContracts}
                  allMonths={allMonths}
                  revenueFor={revenueFor}
                  currentMonth={currentMonth}
                />
              );
            })}

            {/* 売上合計 */}
            <tr className="bg-green-50">
              <td className="px-3.5 py-3 font-extrabold text-sm sticky left-0 bg-green-50 text-emerald-600 z-10">
                売上合計
              </td>
              {allMonths.map((m) => {
                const v = revenueFor(m);
                return (
                  <td
                    key={m}
                    className={`px-2 py-3 text-right font-extrabold text-[13px] text-emerald-600 tabular-nums ${m === currentMonth ? "!bg-amber-100" : ""}`}
                  >
                    {v > 0 ? formatNumber(v) : "—"}
                  </td>
                );
              })}
            </tr>

            {/* === 支出セクション === */}
            <tr>
              <td
                colSpan={allMonths.length + 1}
                className="px-3.5 py-2 bg-slate-100 font-bold text-sm text-slate-600 sticky left-0"
              >
                支出
              </td>
            </tr>
            {expenseNames.map((name) => (
              <tr key={name} className="border-b border-slate-100">
                <td className="px-3.5 py-2 sticky left-0 bg-white z-10 font-medium text-slate-700">
                  {name}
                </td>
                {allMonths.map((m) => {
                  const items = expenses.filter((e) => e.name === name && e.month === m);
                  const total = items.reduce((s, e) => s + e.amount, 0);
                  return (
                    <td
                      key={m}
                      className={`px-2 py-2 text-right tabular-nums ${total > 0 ? "text-red-600" : "text-slate-200"} ${m === currentMonth ? "month-current" : ""}`}
                    >
                      {total > 0 ? formatNumber(total) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* 支出合計 */}
            <tr className="bg-red-50">
              <td className="px-3.5 py-3 font-extrabold text-sm sticky left-0 bg-red-50 text-red-600 z-10">
                支出合計
              </td>
              {allMonths.map((m) => {
                const v = expenseForMonth(m);
                return (
                  <td
                    key={m}
                    className={`px-2 py-3 text-right font-extrabold text-[13px] text-red-600 tabular-nums ${m === currentMonth ? "!bg-amber-100" : ""}`}
                  >
                    {v > 0 ? formatNumber(v) : "—"}
                  </td>
                );
              })}
            </tr>

            {/* 収支 */}
            <tr className="bg-blue-50">
              <td className="px-3.5 py-3 font-extrabold text-sm sticky left-0 bg-blue-50 text-blue-700 z-10">
                収支
              </td>
              {allMonths.map((m) => {
                const rev = revenueFor(m);
                const exp = expenseForMonth(m);
                const diff = rev - exp;
                return (
                  <td
                    key={m}
                    className={`px-2 py-3 text-right font-extrabold text-[13px] tabular-nums ${diff >= 0 ? "text-blue-700" : "text-red-600"} ${m === currentMonth ? "!bg-amber-100" : ""}`}
                  >
                    {diff !== 0 ? formatNumber(diff) : "—"}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* 支出追加フォーム */}
      <div className="mt-6 bg-slate-50 rounded-xl p-4">
        <div className="text-sm font-bold text-slate-700 mb-3">支出を追加</div>
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">項目名</label>
            <input
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-[160px]"
              value={newExpenseName}
              onChange={(e) => setNewExpenseName(e.target.value)}
              placeholder="家賃、人件費など"
              list="expense-names"
            />
            <datalist id="expense-names">
              {expenseNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">月</label>
            <input
              type="month"
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
              value={newExpenseMonth}
              onChange={(e) => setNewExpenseMonth(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">金額</label>
            <input
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-[120px]"
              inputMode="numeric"
              value={newExpenseAmount}
              onChange={(e) => setNewExpenseAmount(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="100000"
            />
          </div>
          <button
            className="px-5 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold cursor-pointer hover:bg-slate-700 disabled:opacity-40"
            disabled={!newExpenseName || !newExpenseMonth || !newExpenseAmount}
            onClick={handleAddExpense}
          >
            追加
          </button>
        </div>
      </div>

      {/* 支出一覧（削除用） */}
      {expenses.length > 0 && (
        <div className="mt-4 bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 text-xs font-bold text-slate-600">
            登録済み支出
          </div>
          <div className="divide-y divide-slate-100">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div className="flex gap-4">
                  <span className="font-medium">{e.name}</span>
                  <span className="text-slate-500">{e.month}</span>
                  <span className="font-semibold">¥{formatNumber(e.amount)}</span>
                </div>
                <button
                  className="text-red-500 text-xs hover:text-red-700 cursor-pointer"
                  onClick={() => onDeleteExpense(e.id)}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** プロダクト行 + 展開時の企業内訳 */
function ProductRows({
  product,
  isExpanded,
  onToggle,
  companyIds,
  companies,
  contracts,
  allMonths,
  revenueFor,
  currentMonth,
}: {
  product: (typeof PRODUCTS)[number];
  isExpanded: boolean;
  onToggle: () => void;
  companyIds: string[];
  companies: Company[];
  contracts: Contract[];
  allMonths: string[];
  revenueFor: (month: string, productFilter?: string) => number;
  currentMonth: string;
}) {
  return (
    <>
      {/* プロダクト合計行 */}
      <tr className="cursor-pointer hover:bg-slate-50" onClick={onToggle}>
        <td className="px-3.5 py-2 border-b border-slate-100 sticky left-0 bg-white z-10">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">{isExpanded ? "▼" : "▶"}</span>
            <Badge product={product.id} />
          </span>
        </td>
        {allMonths.map((m) => {
          const v = revenueFor(m, product.id);
          return (
            <td
              key={m}
              className={`px-2 py-2 text-right border-b border-slate-100 tabular-nums font-semibold ${
                v > 0 ? "text-slate-700" : "text-slate-200"
              } ${m === currentMonth ? "month-current" : ""}`}
            >
              {v > 0 ? formatNumber(v) : "—"}
            </td>
          );
        })}
      </tr>

      {/* 展開時：企業別内訳 */}
      {isExpanded &&
        companyIds.map((cid) => {
          const companyName = companies.find((c) => c.id === cid)?.name || "不明";
          return (
            <tr key={cid} className="bg-slate-50/50">
              <td className="pl-10 pr-3.5 py-1.5 border-b border-slate-50 sticky left-0 bg-slate-50/50 z-10 text-[11px] text-slate-500">
                {companyName}
              </td>
              {allMonths.map((m) => {
                const v = companyRevenueForMonth(contracts, cid, m);
                return (
                  <td
                    key={m}
                    className={`px-2 py-1.5 text-right border-b border-slate-50 tabular-nums text-[11px] ${
                      v > 0 ? "text-slate-500" : "text-slate-200"
                    } ${m === currentMonth ? "month-current" : ""}`}
                  >
                    {v > 0 ? formatNumber(v) : "—"}
                  </td>
                );
              })}
            </tr>
          );
        })}
    </>
  );
}
