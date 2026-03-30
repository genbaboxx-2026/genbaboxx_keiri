"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { Contract, Company, ProductType, ContractStatus, Settings, InvoiceTemplate } from "@/lib/database.types";
import { PRODUCTS } from "@/lib/constants";

const ALL_PRODUCT_IDS = new Set<ProductType>(PRODUCTS.map((p) => p.id));
import { Badge } from "./Badge";
import { InvoiceSection } from "./InvoiceSection";
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
  contracts: Contract[];
  companies: Company[];
  settings: Settings | null;
  invoiceTemplates: InvoiceTemplate[];
  allMonths: string[];
  getCompanyName: (id: string) => string;
  revenueFor: (month: string, productFilter?: string) => number;
  showList: boolean;
  onShowList: (show: boolean) => void;
  onAdd: (productType: ProductType) => void;
  onEdit: (contract: Contract) => void;
  onDelete: (id: string) => void;
  onStatusChange: (contract: Contract, cancelled: boolean) => void;
}

export function ContractPage({
  contracts,
  companies,
  settings,
  invoiceTemplates,
  allMonths,
  getCompanyName,
  revenueFor,
  showList,
  onShowList,
  onAdd,
  onEdit,
  onDelete,
  onStatusChange,
}: ContractPageProps) {
  const [selectedProducts, setSelectedProducts] = useState<Set<ProductType>>(new Set(ALL_PRODUCT_IDS));
  const [addDropdownOpen, setAddDropdownOpen] = useState(false);

  const isAllSelected = selectedProducts.size === ALL_PRODUCT_IDS.size;

  const filteredContracts = isAllSelected
    ? contracts
    : contracts.filter((c) => selectedProducts.has(c.product_type));

  const toggleProduct = (id: ProductType) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedProducts((prev) =>
      prev.size === ALL_PRODUCT_IDS.size ? prev : new Set(ALL_PRODUCT_IDS)
    );
  };

  const handleAdd = () => {
    if (selectedProducts.size === 1) {
      onAdd([...selectedProducts][0]);
    } else {
      setAddDropdownOpen((prev) => !prev);
    }
  };

  if (showList) {
    return (
      <ContractDetailView
        contracts={contracts}
        productFilter={selectedProducts}
        getCompanyName={getCompanyName}
        onBack={() => onShowList(false)}
        onAdd={onAdd}
        onEdit={onEdit}
        onStatusChange={onStatusChange}
        addDropdownOpen={addDropdownOpen}
        setAddDropdownOpen={setAddDropdownOpen}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-[22px] font-extrabold">契約</h2>
        <div className="flex gap-2.5">
          <button
            className="px-5 py-2 bg-white rounded-[10px] text-sm font-semibold cursor-pointer hover:bg-slate-50 border-[1.5px] text-slate-600 border-slate-300"
            onClick={() => onShowList(true)}
          >
            契約一覧
          </button>
          <div className="relative">
            <button
              className="px-7 py-2 text-white rounded-[10px] text-sm font-semibold cursor-pointer hover:opacity-90 bg-slate-800"
              onClick={handleAdd}
            >
              + 契約を追加
            </button>
            {addDropdownOpen && selectedProducts.size !== 1 && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 min-w-[180px]">
                {PRODUCTS.map((p) => (
                  <button
                    key={p.id}
                    className="w-full px-4 py-2 text-left text-sm font-semibold hover:bg-slate-50 cursor-pointer flex items-center gap-2 first:rounded-t-xl last:rounded-b-xl"
                    onClick={() => {
                      setAddDropdownOpen(false);
                      onAdd(p.id);
                    }}
                  >
                    <Badge product={p.id} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {filteredContracts.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-slate-50 rounded-2xl">
          <div className="text-[40px] mb-3">📄</div>
          <div>契約がまだありません</div>
          <button
            className="mt-4 px-7 py-2 text-white rounded-[10px] text-sm font-semibold cursor-pointer bg-slate-800"
            onClick={handleAdd}
          >
            最初の契約を追加
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">月別売上</h3>
            <div className="flex gap-1.5">
              <button
                className={`px-4 py-2 rounded-lg text-[13px] font-semibold cursor-pointer border transition-colors ${
                  isAllSelected
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
                onClick={toggleAll}
              >
                全て
              </button>
              {PRODUCTS.map((p) => {
                const isActive = selectedProducts.has(p.id);
                return (
                  <button
                    key={p.id}
                    className={`px-4 py-2 rounded-lg text-[13px] font-semibold cursor-pointer border transition-colors ${
                      isActive
                        ? `${p.bgClass} ${p.colorClass} ${p.borderClass}`
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                    }`}
                    onClick={() => toggleProduct(p.id)}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <MonthlyRevenueTable
            contracts={filteredContracts}
            allMonths={allMonths}
            getCompanyName={getCompanyName}
            revenueFor={revenueFor}
            selectedProducts={selectedProducts}
          />
          <InvoiceSection
            contracts={contracts}
            companies={companies}
            settings={settings}
            invoiceTemplates={invoiceTemplates}
            allMonths={allMonths}
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
  selectedProducts,
}: {
  contracts: Contract[];
  allMonths: string[];
  getCompanyName: (id: string) => string;
  revenueFor: (month: string, productFilter?: string) => number;
  selectedProducts: Set<ProductType>;
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
      container.scrollLeft = cell.offsetLeft - 166;
    }
  }, [allMonths, contracts]);

  return (
    <div ref={scrollRef} className="overflow-auto rounded-xl border border-slate-200 max-h-[720px]">
      <table className="w-full border-collapse text-[11px]">
        <thead className="sticky top-0 z-20">
          <tr className="bg-slate-50">
            <th className="px-2 py-2 text-center font-bold border-b-2 border-slate-200 sticky left-0 bg-slate-50 min-w-[36px] z-30">
              No
            </th>
            <th className="px-3 py-2 text-left font-bold border-b-2 border-slate-200 sticky left-[36px] bg-slate-50 min-w-[130px] z-30">
              企業名
            </th>
            <th className="px-1 py-2 text-left font-bold border-b-2 border-slate-200 sticky left-[166px] bg-slate-50 min-w-[90px] z-30">
              製品
            </th>
            {allMonths.map((m) => (
              <th
                key={m}
                {...(m === prevMonth ? { "data-scroll-target": true } : {})}
                className={`px-2 py-2 text-right font-semibold text-slate-500 border-b-2 border-slate-200 whitespace-nowrap min-w-[85px] ${m === currentMonth ? "month-current" : ""}`}
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
          {contracts.map((c, idx) => {
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
                <td className="px-2 py-2 text-center text-slate-400 border-b border-slate-100 sticky left-0 bg-white z-10">
                  {idx + 1}
                </td>
                <td className="px-3 py-2 font-semibold border-b border-slate-100 sticky left-[36px] bg-white whitespace-nowrap z-10">
                  {getCompanyName(c.company_id)}
                </td>
                <td className="px-1 py-2 border-b border-slate-100 sticky left-[166px] bg-white z-10">
                  <Badge product={c.product_type} />
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
                      className={`px-2 py-2 text-right border-b tabular-nums ${
                        inService
                          ? "bg-amber-50 border-b-amber-100"
                          : "border-b-slate-100"
                      } ${amt > 0 ? "text-slate-700" : "text-slate-300"} ${month === currentMonth ? "month-current" : ""}`}
                    >
                      {amt > 0 ? formatNumber(amt) : "—"}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {/* 合計行 */}
          <tr className="bg-slate-50">
            <td className="px-2 py-2 sticky left-0 bg-slate-50 z-10" />
            <td colSpan={2} className="px-3 py-2 font-extrabold sticky left-[36px] bg-slate-50 z-10">
              合計
            </td>
            {allMonths.map((m) => {
              const total = selectedProducts.size === ALL_PRODUCT_IDS.size
                ? revenueFor(m)
                : [...selectedProducts].reduce((sum, p) => sum + revenueFor(m, p), 0);
              return (
                <td
                  key={m}
                  className={`px-2 py-2 text-right font-extrabold tabular-nums text-slate-800 ${m === currentMonth ? "month-current" : ""}`}
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
  contracts,
  productFilter: initialFilter,
  getCompanyName,
  onBack,
  onAdd,
  onEdit,
  onStatusChange,
  addDropdownOpen,
  setAddDropdownOpen,
}: {
  contracts: Contract[];
  productFilter: Set<ProductType>;
  getCompanyName: (id: string) => string;
  onBack: () => void;
  onAdd: (productType: ProductType) => void;
  onEdit: (contract: Contract) => void;
  onStatusChange: (contract: Contract, cancelled: boolean) => void;
  addDropdownOpen: boolean;
  setAddDropdownOpen: (open: boolean) => void;
}) {
  const [selectedProducts, setSelectedProducts] = useState<Set<ProductType>>(initialFilter);
  const isAllSelected = selectedProducts.size === ALL_PRODUCT_IDS.size;
  const displayContracts = isAllSelected ? contracts : contracts.filter((c) => selectedProducts.has(c.product_type));

  const toggleProduct = (id: ProductType) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedProducts((prev) =>
      prev.size === ALL_PRODUCT_IDS.size ? prev : new Set(ALL_PRODUCT_IDS)
    );
  };

  const handleAdd = () => {
    if (selectedProducts.size === 1) {
      onAdd([...selectedProducts][0]);
    } else {
      setAddDropdownOpen(!addDropdownOpen);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <button
            className="bg-slate-100 border-none rounded-lg px-3.5 py-2 text-[13px] font-semibold cursor-pointer text-slate-600 hover:bg-slate-200"
            onClick={onBack}
          >
            ← 戻る
          </button>
          <h2 className="text-[22px] font-extrabold">
            契約一覧
          </h2>
        </div>
        <div className="relative">
          <button
            className="px-7 py-2 text-white rounded-[10px] text-sm font-semibold cursor-pointer hover:opacity-90 bg-slate-800"
            onClick={handleAdd}
          >
            + 契約を追加
          </button>
          {addDropdownOpen && selectedProducts.size !== 1 && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 min-w-[180px]">
              {PRODUCTS.map((p) => (
                <button
                  key={p.id}
                  className="w-full px-4 py-2 text-left text-sm font-semibold hover:bg-slate-50 cursor-pointer flex items-center gap-2 first:rounded-t-xl last:rounded-b-xl"
                  onClick={() => {
                    setAddDropdownOpen(false);
                    onAdd(p.id);
                  }}
                >
                  <Badge product={p.id} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* フィルター */}
      <div className="flex gap-2 mb-4">
        <button
          className={`px-4 py-2 rounded-lg text-[13px] font-semibold cursor-pointer border transition-colors ${isAllSelected ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
          onClick={toggleAll}
        >
          全て
        </button>
        {PRODUCTS.map((p) => {
          const isActive = selectedProducts.has(p.id);
          return (
            <button
              key={p.id}
              className={`px-4 py-2 rounded-lg text-[13px] font-semibold cursor-pointer border transition-colors ${isActive ? `${p.bgClass} ${p.colorClass} ${p.borderClass}` : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"}`}
              onClick={() => toggleProduct(p.id)}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {displayContracts.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-slate-50 rounded-2xl">
          <div className="text-[40px] mb-3">📄</div>
          <div>契約がまだありません</div>
        </div>
      ) : (
        <>
          {/* ステータス別サマリーカード */}
          {(() => {
            const statusGroups = [
              { key: "initial" as ContractStatus, label: "初回契約", color: "blue", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", accent: "text-blue-900" },
              { key: "renewed" as ContractStatus, label: "継続契約", color: "emerald", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", accent: "text-emerald-900" },
              { key: "auto_renewing" as ContractStatus, label: "自動更新", color: "amber", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", accent: "text-amber-900" },
              { key: "cancelled" as ContractStatus, label: "解約", color: "red", bg: "bg-red-50", border: "border-red-200", text: "text-red-600", accent: "text-red-800" },
            ];
            const grouped = statusGroups.map((sg) => {
              const items = displayContracts.filter((c) => (c.contract_status || "initial") === sg.key);
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
                  {["企業名", "製品", "ステータス", "開始", "起算", "期間", "完了", "月額", "条件", "初期", "OP", "契約状態"].map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-bold text-slate-600 border-b-2 border-slate-200 whitespace-nowrap text-xs">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayContracts.map((c) => {
                  const bs = makeBillingStart(c.billing_month, c.billing_day);
                  const end = calcEndDate(bs, c.duration_months);
                  const status = c.contract_status || "initial";
                  const statusConfig = {
                    initial: { label: "初回", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
                    renewed: { label: "継続", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
                    auto_renewing: { label: "自動更新", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
                    cancelled: { label: "解約", bg: "bg-red-50", text: "text-red-600", border: "border-red-200" },
                  }[status];
                  return (
                    <tr key={c.id} className="cursor-pointer hover:bg-slate-50 border-b border-slate-100" onClick={() => onEdit(c)}>
                      <td className="px-3 py-2 font-semibold">{getCompanyName(c.company_id)}</td>
                      <td className="px-3 py-2">
                        <Badge product={c.product_type} />
                      </td>
                      <td className="px-3 py-2">
                        <span className={`${statusConfig.bg} ${statusConfig.text} ${statusConfig.border} border text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap`}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">{formatDate(c.contract_start_date)}</td>
                      <td className="px-3 py-2 text-xs">{formatDate(bs)}</td>
                      <td className="px-3 py-2">{c.duration_months}ヶ月</td>
                      <td className="px-3 py-2 text-xs font-semibold text-blue-800">{formatDate(end)}</td>
                      <td className="px-3 py-2 font-semibold">
                        {formatYen(c.monthly_fee)}
                        {c.fee_months > 1 && (
                          <span className="ml-1 text-[10px] text-slate-500">{c.fee_months}ヶ月</span>
                        )}
                        {c.billing_type === "lump_sum" && (
                          <span className="ml-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">一括</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[10px] text-slate-500">{payDescriptionGeneric(c.monthly_close, c.monthly_pay)}</td>
                      <td className="px-3 py-2 text-xs">
                        {c.has_initial_fee ? (
                          <span>
                            {formatYen(c.initial_fee)}
                            <br />
                            <span className="text-[9px] text-slate-500">{payDescriptionGeneric(c.initial_close, c.initial_pay)}</span>
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {c.has_option ? (
                          <span>
                            {c.option_name} {formatYen(c.option_fee)}/月
                            <br />
                            <span className="text-[9px] text-slate-500">{payDescriptionGeneric(c.option_close, c.option_pay)}</span>
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-2 py-2">
                        <select
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer outline-none ${
                            status === "cancelled"
                              ? "bg-red-50 text-red-600 border-red-200"
                              : "bg-emerald-50 text-emerald-600 border-emerald-200"
                          }`}
                          value={status === "cancelled" ? "cancelled" : "active"}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            onStatusChange(c, e.target.value === "cancelled");
                          }}
                        >
                          <option value="active">契約中</option>
                          <option value="cancelled">解約</option>
                        </select>
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
