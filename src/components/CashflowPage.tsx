"use client";

import type { Contract, ProductType } from "@/lib/database.types";
import { PRODUCTS } from "@/lib/constants";
import { formatNumber, getCurrentMonth } from "@/lib/calc";
import { Badge } from "./Badge";

interface CashflowPageProps {
  contracts: Contract[];
  contractsFor: (pid: ProductType) => Contract[];
  allMonths: string[];
  revenueFor: (month: string, productFilter?: string) => number;
  companiesCount: number;
}

export function CashflowPage({
  contracts,
  contractsFor,
  allMonths,
  revenueFor,
  companiesCount,
}: CashflowPageProps) {
  const summaryCards = [
    {
      label: "企業数",
      value: companiesCount,
      unit: "社",
      color: "text-slate-800",
      bg: "bg-slate-100",
    },
    {
      label: "BAKUSOQ",
      value: contractsFor("bakusoq").length,
      unit: "件",
      color: "text-blue-600",
      bg: "bg-blue-100",
    },
    {
      label: "NiNKUBOXX",
      value: contractsFor("ninkuboxx").length,
      unit: "件",
      color: "text-violet-600",
      bg: "bg-violet-100",
    },
    {
      label: "その他",
      value: contractsFor("other").length,
      unit: "件",
      color: "text-emerald-600",
      bg: "bg-emerald-100",
    },
  ];

  const currentMonth = getCurrentMonth();

  return (
    <div>
      <h2 className="text-[22px] font-extrabold mb-2">資金繰り表</h2>

      {/* サマリーカード */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3.5 mb-7">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className={`${card.bg} rounded-[14px] px-5 py-[18px]`}
          >
            <div className="text-xs text-slate-500 font-semibold">
              {card.label}
            </div>
            <div className={`text-[28px] font-extrabold mt-1 ${card.color}`}>
              {card.value}
              <span className="text-sm font-medium ml-1">{card.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 月別テーブル */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-3.5 py-2.5 text-left font-bold sticky left-0 bg-slate-50 border-b-2 border-slate-200 min-w-[140px] z-10">
                項目
              </th>
              {allMonths.map((m) => (
                <th
                  key={m}
                  className={`px-2 py-2.5 text-right font-semibold text-slate-500 border-b-2 border-slate-200 whitespace-nowrap min-w-[90px] ${m === currentMonth ? "month-current" : ""}`}
                >
                  {parseInt(m.split("-")[1])}月
                  <br />
                  <span className="text-[10px] text-slate-400">
                    {m.split("-")[0]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRODUCTS.map((pr) => (
              <tr key={pr.id}>
                <td className="px-3.5 py-2 border-b border-slate-100 sticky left-0 bg-white z-10">
                  <Badge product={pr.id} />
                </td>
                {allMonths.map((m) => {
                  const v = revenueFor(m, pr.id);
                  return (
                    <td
                      key={m}
                      className={`px-2 py-2 text-right border-b border-slate-100 tabular-nums ${
                        v > 0 ? "text-slate-700" : "text-slate-200"
                      } ${m === currentMonth ? "month-current" : ""}`}
                    >
                      {v > 0 ? formatNumber(v) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* 売上合計行 */}
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
