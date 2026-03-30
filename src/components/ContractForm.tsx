"use client";

import { useState, useEffect } from "react";
import type {
  Company,
  Contract,
  ProductType,
  CloseOffset,
  PayType,
  BillingDay,
  BillingType,
  ContractStatus,
} from "@/lib/database.types";
import {
  makeBillingStart,
  calcEndDate,
  formatDate,
  formatNumber,
  suggestBillingMonth,
} from "@/lib/calc";
import { MoneyInput } from "./MoneyInput";
import { PayConfig } from "./PayConfig";

interface ContractFormProps {
  contract?: Contract;
  productType: ProductType;
  companies: Company[];
  fixedCompanyId?: string;
  onSave: (contract: Omit<Contract, "created_at" | "updated_at">) => void;
  onAddCompany: (
    company: Omit<Company, "created_at" | "updated_at">
  ) => void;
  onClose: () => void;
}

export function ContractForm({
  contract,
  productType,
  companies,
  fixedCompanyId,
  onSave,
  onAddCompany,
  onClose,
}: ContractFormProps) {
  const [companyId, setCompanyId] = useState(contract?.company_id || fixedCompanyId || "");
  const [billingType, setBillingType] = useState<BillingType>(
    contract?.billing_type || "monthly"
  );
  const [contractStatus, setContractStatus] = useState<ContractStatus>(
    contract?.contract_status || "initial"
  );
  const [contractStartDate, setContractStartDate] = useState(
    contract?.contract_start_date || ""
  );
  const [billingMonth, setBillingMonth] = useState(
    contract?.billing_month || ""
  );
  const [billingDay, setBillingDay] = useState<BillingDay>(
    contract?.billing_day || "1"
  );
  const [durationMonths, setDurationMonths] = useState(
    contract?.duration_months || 12
  );
  const [monthlyFee, setMonthlyFee] = useState(contract?.monthly_fee || 0);
  const [feeMonths, setFeeMonths] = useState(contract?.fee_months || contract?.duration_months || 12);
  const [monthlyClose, setMonthlyClose] = useState<CloseOffset>(
    contract?.monthly_close || "0"
  );
  const [monthlyPay, setMonthlyPay] = useState<PayType>(
    contract?.monthly_pay || "same_end"
  );
  const [hasInitialFee, setHasInitialFee] = useState(
    contract?.has_initial_fee || false
  );
  const [initialFee, setInitialFee] = useState(contract?.initial_fee || 0);
  const [initialClose, setInitialClose] = useState<CloseOffset>(
    contract?.initial_close || "0"
  );
  const [initialPay, setInitialPay] = useState<PayType>(
    contract?.initial_pay || "same_end"
  );
  const [hasOption, setHasOption] = useState(contract?.has_option || false);
  const [optionName, setOptionName] = useState(contract?.option_name || "");
  const [optionFee, setOptionFee] = useState(contract?.option_fee || 0);
  const [optionClose, setOptionClose] = useState<CloseOffset>(
    contract?.option_close || "0"
  );
  const [optionPay, setOptionPay] = useState<PayType>(
    contract?.option_pay || "same_end"
  );
  const [note, setNote] = useState(contract?.note || "");

  // 新規企業インライン登録
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyContact, setNewCompanyContact] = useState("");

  // 起算月の自動提案
  useEffect(() => {
    if (!contractStartDate || billingMonth) return;
    setBillingMonth(suggestBillingMonth(contractStartDate, billingDay));
  }, [contractStartDate, billingDay, billingMonth]);

  const billingStart = makeBillingStart(billingMonth, billingDay);
  const endDate = calcEndDate(billingStart, durationMonths);
  const baseMonthNum = billingMonth
    ? parseInt(billingMonth.split("-")[1])
    : 0;
  const valid = companyId && contractStartDate && billingMonth && (contractStatus === "auto_renewing" || durationMonths > 0);

  const handleAddCompany = () => {
    if (!newCompanyName.trim()) return;
    const co = {
      id: crypto.randomUUID(),
      name: newCompanyName.trim(),
      contact: newCompanyContact.trim(),
      note: "",
      invoice_contact_name: "",
      invoice_email: "",
    };
    onAddCompany(co);
    setCompanyId(co.id);
    setShowNewCompany(false);
    setNewCompanyName("");
    setNewCompanyContact("");
  };

  const handleSave = () => {
    onSave({
      id: contract?.id || crypto.randomUUID(),
      product_type: productType,
      billing_type: billingType,
      contract_status: contractStatus,
      company_id: companyId,
      contract_start_date: contractStartDate,
      billing_month: billingMonth,
      billing_day: billingDay,
      duration_months: durationMonths,
      monthly_fee: monthlyFee,
      fee_months: billingType === "monthly" ? feeMonths : 1,
      monthly_close: monthlyClose,
      monthly_pay: monthlyPay,
      has_initial_fee: hasInitialFee,
      initial_fee: hasInitialFee ? initialFee : 0,
      initial_close: initialClose,
      initial_pay: initialPay,
      has_option: hasOption,
      option_name: hasOption ? optionName : "",
      option_fee: hasOption ? optionFee : 0,
      option_close: optionClose,
      option_pay: optionPay,
      note,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 契約企業選択 */}
      <div>
        <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
          契約企業 *
        </label>
        {fixedCompanyId ? (
          <div className="px-3.5 py-2.5 bg-slate-100 border-[1.5px] border-slate-200 rounded-[10px] text-sm text-slate-700 font-medium">
            {companies.find((c) => c.id === fixedCompanyId)?.name || "企業名"}
          </div>
        ) : !showNewCompany ? (
          <div className="flex gap-2">
            <select
              className="flex-1 px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">-- 選択 --</option>
              {companies.map((co) => (
                <option key={co.id} value={co.id}>
                  {co.name}
                </option>
              ))}
            </select>
            <button
              className="px-4 py-2.5 bg-green-50 text-emerald-600 border-[1.5px] border-green-200 rounded-[10px] text-[13px] font-bold cursor-pointer whitespace-nowrap hover:bg-green-100"
              onClick={() => setShowNewCompany(true)}
            >
              + 新規企業
            </button>
          </div>
        ) : (
          <div className="bg-green-50 border-[1.5px] border-green-200 rounded-xl p-4 flex flex-col gap-2.5">
            <div className="text-[13px] font-bold text-emerald-600">
              新しい企業を登録
            </div>
            <input
              className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400"
              placeholder="会社名 *"
              value={newCompanyName}
              onChange={(e) => setNewCompanyName(e.target.value)}
            />
            <input
              className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400"
              placeholder="担当者（任意）"
              value={newCompanyContact}
              onChange={(e) => setNewCompanyContact(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-[10px] text-[13px] font-medium cursor-pointer"
                onClick={() => {
                  setShowNewCompany(false);
                  setNewCompanyName("");
                  setNewCompanyContact("");
                }}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-emerald-600 text-white rounded-[10px] text-[13px] font-semibold cursor-pointer disabled:opacity-40"
                disabled={!newCompanyName.trim()}
                onClick={handleAddCompany}
              >
                登録して選択
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 契約期間セクション */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="text-sm font-bold text-blue-800 mb-3.5">
          契約期間
        </div>
        {/* 契約ステータス */}
        <div className="flex gap-1.5 mb-3">
          {([
            { value: "initial", label: "初回契約", color: "blue" },
            { value: "renewed", label: "継続契約中", color: "emerald" },
            { value: "auto_renewing", label: "自動更新中", color: "amber" },
          ] as const).map((s) => {
            const active = contractStatus === s.value;
            const colors = {
              blue: active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
              emerald: active ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
              amber: active ? "bg-amber-500 text-white border-amber-500" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
            };
            return (
              <button
                key={s.value}
                type="button"
                className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold cursor-pointer border-[1.5px] transition-colors ${colors[s.color]}`}
                onClick={() => setContractStatus(s.value)}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        {contractStatus === "auto_renewing" && (
          <div className="text-[11px] text-amber-600 font-medium">
            ※ 自動更新中：当月まで自動的に請求月が延長されます
          </div>
        )}
        <div>
          <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
            契約開始日 *
          </label>
          <input
            type="date"
            className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400"
            value={contractStartDate}
            onChange={(e) => {
              setContractStartDate(e.target.value);
              setBillingMonth("");
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
              起算月 *
            </label>
            <input
              type="month"
              className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400"
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
              起算日 *
            </label>
            <select
              className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400"
              value={billingDay}
              onChange={(e) => setBillingDay(e.target.value as BillingDay)}
            >
              <option value="1">1日</option>
              <option value="16">16日</option>
            </select>
          </div>
        </div>
        {contractStatus !== "auto_renewing" && (
          <>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                  契約期間（ヶ月）*
                </label>
                <input
                  className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400"
                  inputMode="numeric"
                  value={durationMonths || ""}
                  onChange={(e) => {
                    const v = parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0;
                    setDurationMonths(v);
                    setFeeMonths(v);
                  }}
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                  契約完了日（自動計算）
                </label>
                <div className="w-full px-3.5 py-2.5 bg-indigo-100 text-blue-800 font-bold rounded-[10px] text-sm flex items-center">
                  {endDate ? formatDate(endDate) : "—"}
                </div>
              </div>
            </div>
            {billingStart && (
              <div className="mt-2.5 text-xs text-blue-500">
                起算日: {formatDate(billingStart)} → 完了日:{" "}
                {endDate ? formatDate(endDate) : "—"}
              </div>
            )}
          </>
        )}
      </div>

      {/* 料金タイプ選択 + 料金セクション */}
      <div className="bg-slate-50 rounded-xl p-4">
        <div className="text-sm font-bold text-slate-700 mb-3">
          料金
        </div>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            className={`flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer border-[1.5px] transition-colors ${
              billingType === "monthly"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            }`}
            onClick={() => setBillingType("monthly")}
          >
            月額
          </button>
          <button
            type="button"
            className={`flex-1 py-2 rounded-lg text-sm font-semibold cursor-pointer border-[1.5px] transition-colors ${
              billingType === "lump_sum"
                ? "bg-amber-500 text-white border-amber-500"
                : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
            }`}
            onClick={() => setBillingType("lump_sum")}
          >
            一括
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <MoneyInput
              label={billingType === "monthly" ? "月額料金（税別）*" : "月額単価（税別）*"}
              value={monthlyFee}
              onChange={setMonthlyFee}
              placeholder="30,000"
            />
            {billingType === "monthly" && contractStatus !== "auto_renewing" && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[11px] text-slate-500">×</span>
                <input
                  className="w-16 px-2 py-1 border-[1.5px] border-slate-200 rounded-lg text-[13px] text-center outline-none focus:border-blue-400"
                  inputMode="numeric"
                  value={feeMonths || ""}
                  onChange={(e) =>
                    setFeeMonths(parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0)
                  }
                />
                <span className="text-[11px] text-slate-500">ヶ月分</span>
                {feeMonths > 1 && (
                  <span className="text-[11px] text-blue-600 font-medium">
                    = ¥{formatNumber(monthlyFee)}/月 × {feeMonths}ヶ月
                  </span>
                )}
              </div>
            )}
          </div>
          <PayConfig
            label="お客様お振込日"
            close={monthlyClose}
            pay={monthlyPay}
            onCloseChange={setMonthlyClose}
            onPayChange={setMonthlyPay}
            baseMonth={baseMonthNum}
          />
        </div>
        {billingType === "lump_sum" && (
          <div className="mt-2 text-[11px] text-amber-600 font-medium">
            ※ 一括総額: ¥{formatNumber(monthlyFee * durationMonths)}（月額 ¥{formatNumber(monthlyFee)} × {durationMonths}ヶ月）→ お支払い月にのみ計上
          </div>
        )}
      </div>

      {/* 初期導入費セクション */}
      <div className="bg-slate-50 rounded-xl p-4">
        <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold">
          <input
            type="checkbox"
            checked={hasInitialFee}
            onChange={(e) => setHasInitialFee(e.target.checked)}
          />
          初期導入費あり
        </label>
        {hasInitialFee && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <MoneyInput
              label="初期導入費（税別）"
              value={initialFee}
              onChange={setInitialFee}
              placeholder="200,000"
            />
            <PayConfig
              label="初月お客様お振込日"
              close={initialClose}
              pay={initialPay}
              onCloseChange={setInitialClose}
              onPayChange={setInitialPay}
              baseMonth={baseMonthNum}
            />
          </div>
        )}
      </div>

      {/* オプションセクション */}
      <div className="bg-slate-50 rounded-xl p-4">
        <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold">
          <input
            type="checkbox"
            checked={hasOption}
            onChange={(e) => setHasOption(e.target.checked)}
          />
          オプションあり
        </label>
        {hasOption && (
          <div className="mt-3 flex flex-col gap-2.5">
            <div>
              <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                オプション名
              </label>
              <input
                className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400"
                value={optionName}
                onChange={(e) => setOptionName(e.target.value)}
                placeholder="追加機能名"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MoneyInput
                label="オプション月額（税別）"
                value={optionFee}
                onChange={setOptionFee}
              />
              <PayConfig
                label="お客様お振込日"
                close={optionClose}
                pay={optionPay}
                onCloseChange={setOptionClose}
                onPayChange={setOptionPay}
                baseMonth={baseMonthNum}
              />
            </div>
          </div>
        )}
      </div>

      {/* メモ */}
      <div>
        <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
          メモ
        </label>
        <textarea
          className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400 min-h-[50px] resize-y"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {/* ボタン */}
      <div className="flex gap-2.5 justify-end mt-2">
        <button
          className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-[10px] text-sm font-medium cursor-pointer hover:bg-slate-200"
          onClick={onClose}
        >
          キャンセル
        </button>
        <button
          className="px-7 py-2.5 bg-slate-800 text-white rounded-[10px] text-sm font-semibold cursor-pointer hover:bg-slate-700 disabled:opacity-40"
          disabled={!valid}
          onClick={handleSave}
        >
          {contract ? "更新" : "登録"}
        </button>
      </div>
    </div>
  );
}
