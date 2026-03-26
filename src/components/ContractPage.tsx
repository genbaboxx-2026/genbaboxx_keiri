"use client";

import { useState, useEffect, useRef } from "react";
import type { Contract, ProductType, ContractStatus } from "@/lib/database.types";
import { PRODUCTS } from "@/lib/constants";
import {
  makeBillingStart,
  calcEndDate,
  billingMonths,
  calcPayOffset,
  shiftMonth,
  formatNumber,
  formatDate,
  formatYen,
  payDescriptionGeneric,
  getCurrentMonth,
  effectiveDuration,
} from "@/lib/calc";

interface ContractPageProps {
  productType: ProductType;
  contracts: Contract[];
  allMonths: string[];
  getCompanyName: (id: string) => string;
  revenueFor: (month: string, productFilter?: string) => number;
  showList: boolean;
  onShowList: (show: boolean) => void;
  onAdd: () => void;
  onEdit: (contract: Contract) => void;
  onDelete: (id: string) => void;
}

export function ContractPage({
  productType,
  contracts,
  allMonths,
  getCompanyName,
  revenueFor,
  showList,
  onShowList,
  onAdd,
  onEdit,
  onDelete,
}: ContractPageProps) {
  const product = PRODUCTS.find((p) => p.id === productType)!;

  if (showList) {
    return (
      <ContractDetailView
        product={product}
        productType={productType}
        contracts={contracts}
        getCompanyName={getCompanyName}
        onBack={() => onShowList(false)}
        onAdd={onAdd}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-[22px] font-extrabold">
          {product.label} 契約
        </h2>
        <div className="flex gap-2.5">
          <button
            className="px-5 py-2.5 bg-white rounded-[10px] text-sm font-semibold cursor-pointer hover:bg-slate-50 border-[1.5px]"
            style={{ color: product.hex, borderColor: product.hex }}
            onClick={() => onShowList(true)}
          >
            契約一覧
          </button>
          <button
            className="px-7 py-2.5 text-white rounded-[10px] text-sm font-semibold cursor-pointer hover:opacity-90"
            style={{ background: product.hex }}
            onClick={onAdd}
          >
            + 契約を追加
          </button>
        </div>
      </div>

      {contracts.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-slate-50 rounded-2xl">
          <div className="text-[40px] mb-3">📄</div>
          <div>{product.label}の契約がまだありません</div>
          <button
            className="mt-4 px-7 py-2.5 text-white rounded-[10px] text-sm font-semibold cursor-pointer"
            style={{ background: product.hex }}
            onClick={onAdd}
          >
            最初の契約を追加
          </button>
        </div>
      ) : (
        <div>
          <h3 className="text-lg font-bold mb-4">
            月別売上（{product.label}）
          </h3>
          <MonthlyRevenueTable
            contracts={contracts}
            allMonths={allMonths}
            getCompanyName={getCompanyName}
            revenueFor={revenueFor}
            productType={productType}
            product={product}
          />
        </div>
      )}
    </div>
  );
}

// ====== 月別売上テーブル ======
function MonthlyRevenueTable({
  contracts,
  allMonths,
  getCompanyName,
  revenueFor,
  productType,
  product,
}: {
  contracts: Contract[];
  allMonths: string[];
  getCompanyName: (id: string) => string;
  revenueFor: (month: string, productFilter?: string) => number;
  productType: ProductType;
  product: (typeof PRODUCTS)[number];
}) {
  const currentMonth = getCurrentMonth();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1ヶ月前のYYYY-MM
  const prevMonth = (() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const cell = container.querySelector<HTMLElement>("[data-scroll-target]");
    if (cell) {
      container.scrollLeft = cell.offsetLeft - 130;
    }
  }, [allMonths, contracts]);

  return (
    <div ref={scrollRef} className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-slate-50">
            <th className="px-3 py-2.5 text-left font-bold border-b-2 border-slate-200 sticky left-0 bg-slate-50 min-w-[120px] z-10">
              企業名
            </th>
            {allMonths.map((m) => (
              <th
                key={m}
                {...(m === prevMonth ? { "data-scroll-target": true } : {})}
                className={`px-2 py-2.5 text-right font-semibold text-slate-500 border-b-2 border-slate-200 whitespace-nowrap min-w-[85px] ${m === currentMonth ? "month-current" : ""}`}
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
          {contracts.map((c) => {
            const bs = makeBillingStart(c.billing_month, c.billing_day);
            const dur = effectiveDuration(c.billing_month, c.billing_day, c.duration_months, c.contract_status);
            const ms = billingMonths(bs, dur);
            const mo = calcPayOffset(c.monthly_close, c.monthly_pay);
            const oo = c.has_option
              ? calcPayOffset(c.option_close, c.option_pay)
              : 0;
            const io = c.has_initial_fee
              ? calcPayOffset(c.initial_close, c.initial_pay)
              : 0;
            const isLump = c.billing_type === "lump_sum";
            // 役務提供期間の月セット
            const serviceMonths = new Set(ms);
            return (
              <tr key={c.id}>
                <td className="px-3 py-2.5 font-semibold border-b border-slate-100 sticky left-0 bg-white whitespace-nowrap z-10">
                  {getCompanyName(c.company_id)}
                </td>
                {allMonths.map((month) => {
                  let amt = 0;
                  const feeMs = (c.fee_months && c.fee_months > 1) ? ms.slice(0, c.fee_months) : ms;
                  if (isLump) {
                    if (ms.length > 0 && shiftMonth(ms[0], mo) === month) amt += c.monthly_fee * c.duration_months;
                  } else {
                    feeMs.forEach((bm) => {
                      if (shiftMonth(bm, mo) === month) amt += c.monthly_fee;
                    });
                  }
                  if (c.has_option) {
                    ms.forEach((bm) => {
                      if (shiftMonth(bm, oo) === month) amt += c.option_fee;
                    });
                  }
                  if (
                    c.has_initial_fee &&
                    ms.length > 0 &&
                    shiftMonth(ms[0], io) === month
                  ) {
                    amt += c.initial_fee;
                  }
                  const inService = serviceMonths.has(month);
                  return (
                    <td
                      key={month}
                      className={`px-2 py-2.5 text-right border-b border-slate-100 tabular-nums ${
                        amt > 0 ? "text-slate-700" : inService ? "text-slate-300" : "text-slate-200"
                      } ${month === currentMonth ? "month-current" : ""} ${inService ? "bg-blue-50/60" : ""}`}
                    >
                      {amt > 0 ? formatNumber(amt) : inService ? "·" : "—"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {/* 合計行 */}
          <tr style={{ background: product.id === "bakusoq" ? "#dbeafe" : product.id === "ninkuboxx" ? "#ede9fe" : "#d1fae5" }}>
            <td
              className="px-3 py-2.5 font-extrabold sticky left-0 z-10"
              style={{ background: product.id === "bakusoq" ? "#dbeafe" : product.id === "ninkuboxx" ? "#ede9fe" : "#d1fae5" }}
            >
              合計
            </td>
            {allMonths.map((m) => {
              const total = revenueFor(m, productType);
              return (
                <td
                  key={m}
                  className={`px-2 py-2.5 text-right font-extrabold tabular-nums ${m === currentMonth ? "!bg-amber-100" : ""}`}
                  style={{ color: product.hex }}
                >
                  {total > 0 ? formatNumber(total) : "—"}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ====== 契約一覧サブ画面 ======
function ContractDetailView({
  product,
  productType,
  contracts,
  getCompanyName,
  onBack,
  onAdd,
  onEdit,
  onDelete,
}: {
  product: (typeof PRODUCTS)[number];
  productType: ProductType;
  contracts: Contract[];
  getCompanyName: (id: string) => string;
  onBack: () => void;
  onAdd: () => void;
  onEdit: (contract: Contract) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <button
            className="bg-slate-100 border-none rounded-lg px-3.5 py-2 text-[13px] font-semibold cursor-pointer text-slate-600 hover:bg-slate-200"
            onClick={onBack}
          >
            ← 戻る
          </button>
          <h2 className="text-[22px] font-extrabold">
            {product.label} 契約一覧
          </h2>
        </div>
        <button
          className="px-7 py-2.5 text-white rounded-[10px] text-sm font-semibold cursor-pointer hover:opacity-90"
          style={{ background: product.hex }}
          onClick={onAdd}
        >
          + 契約を追加
        </button>
      </div>

      {contracts.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-slate-50 rounded-2xl">
          <div className="text-[40px] mb-3">📄</div>
          <div>{product.label}の契約がまだありません</div>
        </div>
      ) : (
        <>
          {/* ステータス別サマリーカード */}
          {(() => {
            const statusGroups = [
              { key: "initial" as ContractStatus, label: "初回契約", color: "blue", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", accent: "text-blue-900" },
              { key: "renewed" as ContractStatus, label: "継続契約", color: "emerald", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", accent: "text-emerald-900" },
              { key: "auto_renewing" as ContractStatus, label: "自動更新", color: "amber", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", accent: "text-amber-900" },
            ];
            const grouped = statusGroups.map((sg) => {
              const items = contracts.filter((c) => (c.contract_status || "initial") === sg.key);
              const monthlyTotal = items.reduce((s, c) => s + c.monthly_fee, 0);
              const initialTotal = items.reduce((s, c) => s + (c.has_initial_fee ? c.initial_fee : 0), 0);
              const optionTotal = items.reduce((s, c) => s + (c.has_option ? c.option_fee : 0), 0);
              return { ...sg, items, monthlyTotal, initialTotal, optionTotal };
            }).filter((g) => g.items.length > 0);
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {grouped.map((g) => (
                  <div key={g.key} className={`${g.bg} ${g.border} border rounded-xl px-4 py-3`}>
                    <div className={`text-xs font-bold ${g.text} mb-2`}>
                      {g.label}
                      <span className="ml-1.5 text-[10px] font-normal opacity-70">{g.items.length}社</span>
                    </div>
                    <div className={`text-lg font-extrabold ${g.accent}`}>
                      {formatYen(g.monthlyTotal)}<span className="text-xs font-normal opacity-60">/月</span>
                    </div>
                    {g.optionTotal > 0 && (
                      <div className={`text-xs ${g.text} mt-0.5`}>
                        + OP {formatYen(g.optionTotal)}/月
                      </div>
                    )}
                    {g.initialTotal > 0 && (
                      <div className={`text-[10px] ${g.text} opacity-70 mt-0.5`}>
                        初期費用合計 {formatYen(g.initialTotal)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* 契約テーブル（全ステータス統合） */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-slate-50">
                  {["企業名", "ステータス", "開始", "起算", "期間", "完了", "月額", "条件", "初期", "OP", ""].map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-bold text-slate-600 border-b-2 border-slate-200 whitespace-nowrap text-xs">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => {
                  const bs = makeBillingStart(c.billing_month, c.billing_day);
                  const end = calcEndDate(bs, c.duration_months);
                  const status = c.contract_status || "initial";
                  const statusConfig = {
                    initial: { label: "初回", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
                    renewed: { label: "継続", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
                    auto_renewing: { label: "自動更新", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
                  }[status];
                  return (
                    <tr key={c.id} className="cursor-pointer hover:bg-slate-50 border-b border-slate-100" onClick={() => onEdit(c)}>
                      <td className="px-3 py-2.5 font-semibold">{getCompanyName(c.company_id)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`${statusConfig.bg} ${statusConfig.text} ${statusConfig.border} border text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap`}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{formatDate(c.contract_start_date)}</td>
                      <td className="px-3 py-2.5 text-xs">{formatDate(bs)}</td>
                      <td className="px-3 py-2.5">{c.duration_months}ヶ月</td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-blue-800">{formatDate(end)}</td>
                      <td className="px-3 py-2.5 font-semibold">
                        {formatYen(c.monthly_fee)}
                        {c.fee_months > 1 && (
                          <span className="ml-1 text-[10px] text-slate-500">{c.fee_months}ヶ月</span>
                        )}
                        {c.billing_type === "lump_sum" && (
                          <span className="ml-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">一括</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-slate-500">{payDescriptionGeneric(c.monthly_close, c.monthly_pay)}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {c.has_initial_fee ? (
                          <span>
                            {formatYen(c.initial_fee)}
                            <br />
                            <span className="text-[9px] text-slate-500">{payDescriptionGeneric(c.initial_close, c.initial_pay)}</span>
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        {c.has_option ? (
                          <span>
                            {c.option_name} {formatYen(c.option_fee)}/月
                            <br />
                            <span className="text-[9px] text-slate-500">{payDescriptionGeneric(c.option_close, c.option_pay)}</span>
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-[13px] font-medium cursor-pointer hover:bg-red-100"
                          onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
