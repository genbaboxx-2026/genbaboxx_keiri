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
  payDescription,
  getCurrentMonth,
  effectiveDuration,
} from "@/lib/calc";

interface ContractPageProps {
  productType: ProductType;
  contracts: Contract[];
  allMonths: string[];
  getCompanyName: (id: string) => string;
  revenueFor: (month: string, productFilter?: string) => number;
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
  onAdd,
  onEdit,
  onDelete,
}: ContractPageProps) {
  const [showDetail, setShowDetail] = useState(false);
  const product = PRODUCTS.find((p) => p.id === productType)!;

  if (showDetail) {
    return (
      <ContractDetailView
        product={product}
        productType={productType}
        contracts={contracts}
        getCompanyName={getCompanyName}
        onBack={() => setShowDetail(false)}
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
            onClick={() => setShowDetail(true)}
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
            return (
              <tr key={c.id}>
                <td className="px-3 py-2.5 font-semibold border-b border-slate-100 sticky left-0 bg-white whitespace-nowrap z-10">
                  {getCompanyName(c.company_id)}
                </td>
                {allMonths.map((month) => {
                  let amt = 0;
                  const unitFee = c.monthly_fee * (c.fee_months || 1);
                  if (isLump) {
                    if (ms.length > 0 && shiftMonth(ms[0], mo) === month) amt += c.monthly_fee * c.duration_months;
                  } else {
                    ms.forEach((bm) => {
                      if (shiftMonth(bm, mo) === month) amt += unitFee;
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
                  return (
                    <td
                      key={month}
                      className={`px-2 py-2.5 text-right border-b border-slate-100 tabular-nums ${
                        amt > 0 ? "text-slate-700" : "text-slate-200"
                      } ${month === currentMonth ? "month-current" : ""}`}
                    >
                      {amt > 0 ? formatNumber(amt) : "—"}
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
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-slate-50">
                {[
                  "企業名",
                  "状態",
                  "開始",
                  "起算",
                  "期間",
                  "完了",
                  "月額",
                  "条件",
                  "初期",
                  "OP",
                  "",
                ].map((h, i) => (
                  <th
                    key={i}
                    className="px-3 py-2.5 text-left font-bold text-slate-600 border-b-2 border-slate-200 whitespace-nowrap text-xs"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => {
                const bs = makeBillingStart(c.billing_month, c.billing_day);
                const end = calcEndDate(bs, c.duration_months);
                const bm = c.billing_month
                  ? parseInt(c.billing_month.split("-")[1])
                  : 0;
                return (
                  <tr
                    key={c.id}
                    className="cursor-pointer hover:bg-slate-50 border-b border-slate-100"
                    onClick={() => onEdit(c)}
                  >
                    <td className="px-3 py-2.5 font-semibold">
                      {getCompanyName(c.company_id)}
                    </td>
                    <td className="px-3 py-2.5">
                      {(() => {
                        const st = c.contract_status || "initial";
                        const cfg = {
                          initial: { label: "初回", cls: "text-blue-600 bg-blue-50 border-blue-200" },
                          renewed: { label: "継続", cls: "text-emerald-600 bg-emerald-50 border-emerald-200" },
                          auto_renewing: { label: "自動更新", cls: "text-amber-600 bg-amber-50 border-amber-200" },
                        }[st] || { label: "初回", cls: "text-blue-600 bg-blue-50 border-blue-200" };
                        return (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {formatDate(c.contract_start_date)}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {formatDate(bs)}
                    </td>
                    <td className="px-3 py-2.5">{c.duration_months}ヶ月</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-blue-800">
                      {formatDate(end)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold">
                      {formatYen(c.monthly_fee)}
                      {c.billing_type === "lump_sum" && (
                        <span className="ml-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                          一括
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[10px] text-slate-500">
                      {payDescription(c.monthly_close, c.monthly_pay, bm)}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {c.has_initial_fee ? (
                        <span>
                          {formatYen(c.initial_fee)}
                          <br />
                          <span className="text-[9px] text-slate-500">
                            {payDescription(c.initial_close, c.initial_pay, bm)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {c.has_option ? (
                        <span>
                          {c.option_name} {formatYen(c.option_fee)}/月
                          <br />
                          <span className="text-[9px] text-slate-500">
                            {payDescription(c.option_close, c.option_pay, bm)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-[13px] font-medium cursor-pointer hover:bg-red-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(c.id);
                        }}
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
      )}
    </div>
  );
}
