"use client";

import { useState, useEffect, useRef } from "react";
import type { Company, Contract, ProductType, Expense } from "@/lib/database.types";
import { PRODUCTS } from "@/lib/constants";
import {
  formatNumber,
  getCurrentMonth,
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
  onRenameExpense: (oldName: string, newName: string) => void;
}

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
        if (ms.length > 0 && shiftMonth(ms[0], mo) === month) amt += c.monthly_fee * c.duration_months;
      } else {
        feeMs.forEach((bm) => { if (shiftMonth(bm, mo) === month) amt += c.monthly_fee; });
      }
      if (c.has_option) {
        const oo = calcPayOffset(c.option_close, c.option_pay);
        ms.forEach((bm) => { if (shiftMonth(bm, oo) === month) amt += c.option_fee; });
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
  onRenameExpense,
}: CashflowPageProps) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ name: string; month: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newRowName, setNewRowName] = useState("");
  const [showNewRow, setShowNewRow] = useState(false);
  const [expenseExpanded, setExpenseExpanded] = useState(true);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [adjustments, setAdjustments] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("cashflow_adjustments");
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [editingAdj, setEditingAdj] = useState<string | null>(null);
  const [editAdjValue, setEditAdjValue] = useState("");

  const currentMonth = getCurrentMonth();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1ヶ月前の位置へ自動スクロール
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
      container.scrollLeft = cell.offsetLeft - 160;
    }
  }, [allMonths]);

  const toggleProduct = (pid: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const expenseForMonth = (month: string) =>
    expenses.filter((e) => e.month === month).reduce((s, e) => s + e.amount, 0);

  // 行の名前リストをlocalStorageで管理（expenses有無に依存しない）
  const [expenseNames, setExpenseNames] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("expense_order");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // expensesに存在するがexpenseNamesにない名前を末尾に追加
  useEffect(() => {
    const dataNames = [...new Set(expenses.map((e) => e.name))];
    const missing = dataNames.filter((n) => !expenseNames.includes(n));
    if (missing.length > 0) {
      const next = [...expenseNames, ...missing];
      setExpenseNames(next);
      localStorage.setItem("expense_order", JSON.stringify(next));
    }
  }, [expenses]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveOrder = (newOrder: string[]) => {
    setExpenseNames(newOrder);
    localStorage.setItem("expense_order", JSON.stringify(newOrder));
  };

  const moveRow = (name: string, dir: -1 | 1) => {
    const idx = expenseNames.indexOf(name);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= expenseNames.length) return;
    const next = [...expenseNames];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    saveOrder(next);
  };

  const removeRow = (name: string) => {
    if (!confirm(`「${name}」の支出行を全て削除しますか？`)) return;
    expenses.filter((e) => e.name === name).forEach((e) => onDeleteExpense(e.id));
    saveOrder(expenseNames.filter((n) => n !== name));
  };

  // セルクリックで編集開始
  const startEdit = (name: string, month: string) => {
    const existing = expenses.find((e) => e.name === name && e.month === month);
    setEditingCell({ name, month });
    setEditValue(existing ? String(existing.amount) : "");
  };

  // 編集確定
  const commitEdit = () => {
    if (!editingCell) return;
    const amount = parseInt(editValue.replace(/[^0-9]/g, "")) || 0;
    const existing = expenses.find(
      (e) => e.name === editingCell.name && e.month === editingCell.month
    );
    if (amount === 0 && existing) {
      onDeleteExpense(existing.id);
    } else if (amount > 0) {
      onAddExpense(editingCell.name, editingCell.month, amount);
    }
    setEditingCell(null);
    setEditValue("");
  };

  // 新規行追加
  const addNewRow = () => {
    const trimmed = newRowName.trim();
    if (!trimmed) return;
    if (!expenseNames.includes(trimmed)) {
      saveOrder([...expenseNames, trimmed]);
    }
    setNewRowName("");
    setShowNewRow(false);
  };

  const startEditName = (name: string) => {
    setEditingName(name);
    setEditNameValue(name);
  };

  const commitEditName = () => {
    if (!editingName) return;
    const trimmed = editNameValue.trim();
    if (trimmed && trimmed !== editingName) {
      onRenameExpense(editingName, trimmed);
      saveOrder(expenseNames.map((n) => n === editingName ? trimmed : n));
    }
    setEditingName(null);
    setEditNameValue("");
  };

  const startEditAdj = (month: string) => {
    setEditingAdj(month);
    setEditAdjValue(adjustments[month] ? String(adjustments[month]) : "");
  };

  const commitAdj = () => {
    if (!editingAdj) return;
    const val = parseInt(editAdjValue.replace(/[^0-9-]/g, "")) || 0;
    const next = { ...adjustments };
    if (val === 0) {
      delete next[editingAdj];
    } else {
      next[editingAdj] = val;
    }
    setAdjustments(next);
    localStorage.setItem("cashflow_adjustments", JSON.stringify(next));
    setEditingAdj(null);
    setEditAdjValue("");
  };

  const summaryCards = [
    { label: "企業数", value: companiesCount, unit: "社" },
    { label: "BAKUSOQ", value: contractsFor("bakusoq").length, unit: "件" },
    { label: "NiNKUBOXX", value: contractsFor("ninkuboxx").length, unit: "件" },
    { label: "その他", value: contractsFor("other").length, unit: "件" },
  ];

  return (
    <div>
      <h2 className="text-[22px] font-extrabold mb-2">資金繰り表</h2>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3.5 mb-7">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-white border border-slate-200 rounded-xl px-5 py-[18px]">
            <div className="text-xs text-slate-400 font-semibold">{card.label}</div>
            <div className="text-[28px] font-extrabold mt-1 text-slate-800">
              {card.value}
              <span className="text-sm font-medium ml-1 text-slate-400">{card.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div ref={scrollRef} className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-3.5 py-2.5 text-left font-bold sticky left-0 bg-slate-50 border-b-2 border-slate-200 min-w-[160px] z-10">
                項目
              </th>
              {allMonths.map((m) => (
                <th
                  key={m}
                  {...(m === prevMonth ? { "data-scroll-target": true } : {})}
                  className={`px-2 py-2.5 text-right font-semibold text-slate-500 border-b-2 border-slate-200 whitespace-nowrap min-w-[90px]`}
                >
                  {parseInt(m.split("-")[1])}月<br />
                  <span className="text-[10px] text-slate-400">{m.split("-")[0]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 売上 */}
            {PRODUCTS.map((pr) => {
              const isExpanded = expandedProducts.has(pr.id);
              const productContracts = contractsFor(pr.id);
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

            {/* 売上合計(税別) */}
            <tr className="bg-slate-50 border-t-2 border-slate-300">
              <td className="px-3.5 py-2 font-extrabold text-sm sticky left-0 bg-slate-50 text-slate-800 z-10">
                売上合計<span className="text-[10px] font-normal text-slate-400 ml-1">(税別)</span>
              </td>
              {allMonths.map((m) => {
                const v = revenueFor(m);
                return (
                  <td key={m} className="px-2 py-2 text-right font-extrabold text-[13px] text-slate-800 tabular-nums">
                    {v > 0 ? formatNumber(v) : "—"}
                  </td>
                );
              })}
            </tr>
            {/* 売上合計(税込) */}
            <tr className="bg-slate-50">
              <td className="px-3.5 py-2 font-extrabold text-sm sticky left-0 bg-slate-50 text-blue-800 z-10">
                売上合計<span className="text-[10px] font-normal text-blue-400 ml-1">(税込)</span>
              </td>
              {allMonths.map((m) => {
                const v = Math.floor(revenueFor(m) * 1.1);
                return (
                  <td key={m} className="px-2 py-2 text-right font-extrabold text-[13px] text-blue-800 tabular-nums">
                    {v > 0 ? formatNumber(v) : "—"}
                  </td>
                );
              })}
            </tr>

            {/* スペーサー */}
            <tr>
              <td colSpan={allMonths.length + 1} className="h-4 bg-white border-none" />
            </tr>

            {/* 支出ヘッダー */}
            <tr className="cursor-pointer" onClick={() => setExpenseExpanded((p) => !p)}>
              <td className="px-3.5 py-2 bg-slate-100 font-bold text-sm text-slate-600 sticky left-0 z-10">
                <span className="inline-block w-4 text-[10px]">{expenseExpanded ? "▼" : "▶"}</span>
                支出
              </td>
              {allMonths.map((m) => (
                <td key={m} className="bg-slate-100" />
              ))}
            </tr>

            {/* 支出行 */}
            {expenseExpanded && expenseNames.map((name) => (
              <tr key={name} className="border-b border-slate-100">
                <td className="px-3.5 py-2 sticky left-0 bg-white z-10 font-medium text-slate-700 group">
                  {editingName === name ? (
                    <input
                      className="w-full px-2 py-1 border-2 border-blue-400 rounded text-xs outline-none bg-blue-50"
                      autoFocus
                      value={editNameValue}
                      onChange={(e) => setEditNameValue(e.target.value)}
                      onBlur={commitEditName}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEditName();
                        if (e.key === "Escape") { setEditingName(null); setEditNameValue(""); }
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className="flex flex-col opacity-0 group-hover:opacity-100">
                          <button
                            className="text-[9px] text-slate-400 hover:text-slate-700 cursor-pointer bg-transparent border-none leading-none"
                            onClick={() => moveRow(name, -1)}
                          >
                            ▲
                          </button>
                          <button
                            className="text-[9px] text-slate-400 hover:text-slate-700 cursor-pointer bg-transparent border-none leading-none"
                            onClick={() => moveRow(name, 1)}
                          >
                            ▼
                          </button>
                        </div>
                        <span
                          className="cursor-pointer hover:text-blue-600"
                          onClick={() => startEditName(name)}
                        >
                          {name}
                        </span>
                      </div>
                      <button
                        className="text-red-400 hover:text-red-600 text-[10px] cursor-pointer bg-transparent border-none opacity-0 group-hover:opacity-100"
                        onClick={() => removeRow(name)}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </td>
                {allMonths.map((m) => {
                  const items = expenses.filter((e) => e.name === name && e.month === m);
                  const total = items.reduce((s, e) => s + e.amount, 0);
                  const isEditing = editingCell?.name === name && editingCell?.month === m;
                  return (
                    <td
                      key={m}
                      className={`px-0 py-0 text-right tabular-nums border-b border-slate-100 ${!isEditing ? "cursor-pointer hover:bg-blue-50" : ""}`}
                      onClick={() => !isEditing && startEdit(name, m)}
                    >
                      {isEditing ? (
                        <input
                          className="w-full px-2 py-2 text-right text-xs border-2 border-blue-400 outline-none bg-blue-50"
                          autoFocus
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value.replace(/[^0-9]/g, ""))}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            if (e.key === "Escape") { setEditingCell(null); setEditValue(""); }
                          }}
                        />
                      ) : (
                        <div className="px-2 py-2">
                          {total > 0 ? (
                            <span className="text-slate-700">{formatNumber(total)}</span>
                          ) : (
                            <span className="text-slate-200">—</span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* 行を追加ボタン */}
            {expenseExpanded && !showNewRow && (
              <tr>
                <td className="px-3.5 py-1.5 sticky left-0 bg-white z-10">
                  <button
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer bg-transparent border-none"
                    onClick={() => setShowNewRow(true)}
                  >
                    + 行を追加
                  </button>
                </td>
                {allMonths.map((m) => (
                  <td key={m} />
                ))}
              </tr>
            )}

            {/* 新規行入力 */}
            {expenseExpanded && showNewRow && (
              <tr className="border-b border-slate-100">
                <td className="px-1 py-1 sticky left-0 bg-white z-10">
                  <div className="flex gap-1">
                    <input
                      className="flex-1 px-2 py-1.5 border border-blue-300 rounded text-xs outline-none"
                      autoFocus
                      placeholder="項目名（家賃など）"
                      value={newRowName}
                      onChange={(e) => setNewRowName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addNewRow();
                        if (e.key === "Escape") { setShowNewRow(false); setNewRowName(""); }
                      }}
                    />
                    <button
                      className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-semibold cursor-pointer disabled:opacity-40"
                      disabled={!newRowName.trim()}
                      onClick={addNewRow}
                    >
                      追加
                    </button>
                    <button
                      className="px-2 py-1 bg-slate-200 text-slate-600 rounded text-[10px] cursor-pointer"
                      onClick={() => { setShowNewRow(false); setNewRowName(""); }}
                    >
                      ✕
                    </button>
                  </div>
                </td>
                {allMonths.map((m) => (
                  <td key={m} className="border-b border-slate-100" />
                ))}
              </tr>
            )}

            {/* 支出合計 */}
            <tr className="bg-slate-50 border-t-2 border-slate-300">
              <td className="px-3.5 py-3 font-extrabold text-sm sticky left-0 bg-slate-50 text-slate-800 z-10">支出合計</td>
              {allMonths.map((m) => {
                const v = expenseForMonth(m);
                return (
                  <td key={m} className={`px-2 py-3 text-right font-extrabold text-[13px] text-slate-800 tabular-nums`}>
                    {v > 0 ? formatNumber(v) : "—"}
                  </td>
                );
              })}
            </tr>

            {/* 収支 */}
            <tr className="bg-slate-100 border-t-2 border-slate-400">
              <td className="px-3.5 py-3 font-extrabold text-sm sticky left-0 bg-slate-100 text-slate-900 z-10">収支<span className="text-[10px] font-normal text-slate-400 ml-1">(税込)</span></td>
              {allMonths.map((m) => {
                const rev = Math.floor(revenueFor(m) * 1.1);
                const exp = expenseForMonth(m);
                const diff = rev - exp;
                return (
                  <td key={m} className={`px-2 py-3 text-right font-extrabold text-[13px] tabular-nums ${diff < 0 ? "text-red-600" : "text-slate-900"}`}>
                    {diff !== 0 ? formatNumber(diff) : "—"}
                  </td>
                );
              })}
            </tr>

            {/* 調整 */}
            <tr className="border-b border-slate-200">
              <td className="px-3.5 py-2 font-semibold text-xs sticky left-0 bg-white text-slate-600 z-10">調整</td>
              {allMonths.map((m) => {
                const val = adjustments[m] || 0;
                const isEditing = editingAdj === m;
                return (
                  <td
                    key={m}
                    className={`px-0 py-0 text-right tabular-nums ${!isEditing ? "cursor-pointer hover:bg-blue-50" : ""}`}
                    onClick={() => !isEditing && startEditAdj(m)}
                  >
                    {isEditing ? (
                      <input
                        className="w-full px-2 py-2 text-right text-xs border-2 border-blue-400 outline-none bg-blue-50"
                        autoFocus
                        value={editAdjValue}
                        onChange={(e) => setEditAdjValue(e.target.value.replace(/[^0-9-]/g, ""))}
                        onBlur={commitAdj}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitAdj();
                          if (e.key === "Escape") { setEditingAdj(null); setEditAdjValue(""); }
                        }}
                      />
                    ) : (
                      <div className="px-2 py-2">
                        {val !== 0 ? (
                          <span className={val < 0 ? "text-red-600" : "text-blue-600"}>{formatNumber(val)}</span>
                        ) : (
                          <span className="text-slate-200">—</span>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* 累計残高 */}
            <tr className="bg-slate-200">
              <td className="px-3.5 py-3 font-extrabold text-sm sticky left-0 bg-slate-200 text-slate-900 z-10">累計残高</td>
              {(() => {
                let cumulative = 0;
                return allMonths.map((m) => {
                  const rev = Math.floor(revenueFor(m) * 1.1);
                  const exp = expenseForMonth(m);
                  const adj = adjustments[m] || 0;
                  cumulative += rev - exp + adj;
                  return (
                    <td key={m} className={`px-2 py-3 text-right font-extrabold text-[13px] tabular-nums ${cumulative < 0 ? "text-red-600" : "text-slate-900"}`}>
                      {formatNumber(cumulative)}
                    </td>
                  );
                });
              })()}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductRows({
  product, isExpanded, onToggle, companyIds, companies, contracts, allMonths, revenueFor, currentMonth,
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
            <td key={m} className={`px-2 py-2 text-right border-b border-slate-100 tabular-nums font-semibold ${v > 0 ? "text-slate-700" : "text-slate-200"}`}>
              {v > 0 ? formatNumber(v) : "—"}
            </td>
          );
        })}
      </tr>
      {isExpanded && companyIds.map((cid) => {
        const companyName = companies.find((c) => c.id === cid)?.name || "不明";
        return (
          <tr key={cid} className="bg-slate-50/50">
            <td className="pl-10 pr-3.5 py-1.5 border-b border-slate-50 sticky left-0 bg-slate-50/50 z-10 text-[11px] text-slate-500">
              {companyName}
            </td>
            {allMonths.map((m) => {
              const v = companyRevenueForMonth(contracts, cid, m);
              return (
                <td key={m} className={`px-2 py-1.5 text-right border-b border-slate-50 tabular-nums text-[11px] ${v > 0 ? "text-slate-500" : "text-slate-200"}`}>
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
