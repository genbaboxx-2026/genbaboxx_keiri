"use client";

import { useState } from "react";
import type {
  Company,
  Contract,
  ProductType,
  ContractStatus,
} from "@/lib/database.types";
import { PRODUCTS } from "@/lib/constants";
import { Badge } from "./Badge";
import { formatDate, formatNumber, calcEndDate, makeBillingStart } from "@/lib/calc";

interface CompanyDetailModalProps {
  company: Company;
  contracts: Contract[];
  productFilter?: ProductType;
  mode: "contract" | "master";
  onSave: (company: Omit<Company, "created_at" | "updated_at">) => void;
  onAddContract: (productType: ProductType) => void;
  onEditContract: (contract: Contract) => void;
  onDeleteContract: (id: string) => void;
  onClose: () => void;
}

const CONTRACT_STATUS_CONFIG: Record<
  ContractStatus,
  { label: string; color: string; bg: string }
> = {
  initial: { label: "初回契約", color: "text-blue-600", bg: "bg-blue-100" },
  renewed: { label: "継続契約中", color: "text-emerald-600", bg: "bg-emerald-100" },
  auto_renewing: { label: "自動更新中", color: "text-amber-600", bg: "bg-amber-100" },
  cancelled: { label: "解約", color: "text-red-600", bg: "bg-red-100" },
};

function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const config = CONTRACT_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${config.color} ${config.bg}`}
    >
      {config.label}
    </span>
  );
}

function ContractCard({
  contract,
  isCurrent,
  onEdit,
  onDelete,
}: {
  contract: Contract;
  isCurrent: boolean;
  onEdit: (contract: Contract) => void;
  onDelete: (id: string) => void;
}) {
  const billingStart = makeBillingStart(contract.billing_month, contract.billing_day);
  const endDate = calcEndDate(billingStart, contract.duration_months);
  return (
    <div
      className={`rounded-lg px-4 py-3 cursor-pointer transition-colors ${
        isCurrent
          ? "bg-white border-2 border-blue-300 shadow-sm hover:border-blue-400"
          : "bg-slate-50 border border-slate-200 opacity-60 hover:opacity-80"
      }`}
      onClick={() => onEdit(contract)}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <ContractStatusBadge status={contract.contract_status} />
            {isCurrent && (
              <span className="text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 px-1.5 py-0.5 rounded-full">
                現在の契約
              </span>
            )}
            {!isCurrent && (
              <span className="text-[10px] text-slate-400">履歴</span>
            )}
          </div>
          <div className="text-sm text-slate-700">
            <span className="font-semibold">
              ¥{formatNumber(contract.monthly_fee)}
            </span>
            <span className="text-slate-500">/月</span>
            {contract.billing_type === "lump_sum" && (
              <span className="ml-1.5 text-xs text-amber-600 font-medium">
                (一括払い)
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {contract.contract_start_date && (
              <>
                {contract.contract_start_date} 〜{" "}
                {endDate ? formatDate(endDate) : "—"}
                <span className="ml-1.5">
                  ({contract.duration_months}ヶ月)
                </span>
              </>
            )}
          </div>
          {(contract.has_initial_fee || contract.has_option) && (
            <div className="flex gap-1.5 mt-1.5">
              {contract.has_initial_fee && (
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                  初期費用: ¥{formatNumber(contract.initial_fee)}
                </span>
              )}
              {contract.has_option && (
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                  {contract.option_name || "オプション"}: ¥{formatNumber(contract.option_fee)}/月
                </span>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded text-[11px] font-medium cursor-pointer hover:bg-red-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(contract.id);
          }}
        >
          削除
        </button>
      </div>
    </div>
  );
}

function HistoryContracts({
  contracts,
  onEdit,
  onDelete,
}: {
  contracts: Contract[];
  onEdit: (contract: Contract) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1.5">
      <button
        type="button"
        className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-none px-1"
        onClick={() => setOpen(!open)}
      >
        {open ? "▼" : "▶"} 過去の契約（{contracts.length}件）
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 mt-1.5">
          {contracts.map((c) => (
            <ContractCard
              key={c.id}
              contract={c}
              isCurrent={false}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CompanyDetailModal({
  company,
  contracts,
  productFilter,
  mode,
  onSave,
  onAddContract,
  onEditContract,
  onDeleteContract,
  onClose,
}: CompanyDetailModalProps) {
  const [name, setName] = useState(company.name);
  const [contact, setContact] = useState(company.contact);
  const [note, setNote] = useState(company.note);
  const [invoiceContactName, setInvoiceContactName] = useState(company.invoice_contact_name);
  const [invoiceEmail, setInvoiceEmail] = useState(company.invoice_email);
  const [showProductSelect, setShowProductSelect] = useState(false);

  const companyContracts = contracts.filter(
    (c) => c.company_id === company.id && (!productFilter || c.product_type === productFilter)
  );

  const filteredProducts = productFilter
    ? PRODUCTS.filter((p) => p.id === productFilter)
    : PRODUCTS;

  const handleSave = () => {
    onSave({
      id: company.id,
      name,
      contact: mode === "master" ? contact : company.contact,
      note: mode === "master" ? note : company.note,
      invoice_contact_name: mode === "master" ? invoiceContactName : company.invoice_contact_name,
      invoice_email: mode === "master" ? invoiceEmail : company.invoice_email,
    });
  };

  const handleAddContract = (productType: ProductType) => {
    setShowProductSelect(false);
    onAddContract(productType);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 企業情報セクション */}
      {mode === "contract" ? (
        /* 契約一覧からの表示: 会社名のみ */
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-lg font-bold text-slate-800">{company.name}</div>
        </div>
      ) : (
        /* 企業マスタからの表示: 全フィールド */
        <div className="bg-slate-50 rounded-xl p-4">
          <div className="text-sm font-bold text-slate-700 mb-3">企業情報</div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                会社名 *
              </label>
              <input
                className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="株式会社〇〇"
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                担当者・連絡先
              </label>
              <input
                className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
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
          </div>
        </div>
      )}

      {/* 請求書送付先セクション（企業マスタのみ） */}
      {mode === "master" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="text-sm font-bold text-emerald-800 mb-3">請求書送付先</div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                担当者名
              </label>
              <input
                className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400 bg-white"
                value={invoiceContactName}
                onChange={(e) => setInvoiceContactName(e.target.value)}
                placeholder="経理部 山田太郎"
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
                メールアドレス
              </label>
              <input
                type="email"
                className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400 bg-white"
                value={invoiceEmail}
                onChange={(e) => setInvoiceEmail(e.target.value)}
                placeholder="keiri@example.com"
              />
            </div>
          </div>
        </div>
      )}

      {/* 契約一覧セクション */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm font-bold text-blue-800">
            契約一覧
            <span className="ml-2 text-xs font-normal text-blue-600">
              ({companyContracts.length}件)
            </span>
          </div>
          <div className="relative">
            {productFilter ? (
              <button
                type="button"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-[13px] font-semibold cursor-pointer hover:bg-blue-700"
                onClick={() => handleAddContract(productFilter)}
              >
                + 契約追加
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-[13px] font-semibold cursor-pointer hover:bg-blue-700"
                  onClick={() => setShowProductSelect(!showProductSelect)}
                >
                  + 契約追加
                </button>
                {showProductSelect && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowProductSelect(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 min-w-[160px]">
                      {PRODUCTS.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 cursor-pointer flex items-center gap-2"
                          onClick={() => handleAddContract(p.id)}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${p.bgClass} border ${p.borderClass}`}
                          />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {companyContracts.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-white rounded-lg border border-blue-100">
            <div className="text-2xl mb-2">📄</div>
            <div className="text-sm">まだ契約がありません</div>
            <div className="text-xs mt-1">
              「契約追加」から新しい契約を登録してください
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* プロダクトごとにグループ化 */}
            {filteredProducts.map((product) => {
              const productContracts = companyContracts
                .filter((c) => c.product_type === product.id)
                .sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime()
                );
              if (productContracts.length === 0) return null;

              const [latest, ...history] = productContracts;

              return (
                <div key={product.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge product={product.id} />
                    <span className="text-xs text-slate-500">
                      {productContracts.length}件
                    </span>
                  </div>

                  {/* 最新（現在の契約） */}
                  <ContractCard
                    contract={latest}
                    isCurrent
                    onEdit={onEditContract}
                    onDelete={onDeleteContract}
                  />

                  {/* 過去の契約 */}
                  {history.length > 0 && (
                    <HistoryContracts
                      contracts={history}
                      onEdit={onEditContract}
                      onDelete={onDeleteContract}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ボタン */}
      <div className="flex gap-2.5 justify-end mt-2">
        <button
          className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-[10px] text-sm font-medium cursor-pointer hover:bg-slate-200"
          onClick={onClose}
        >
          {mode === "contract" ? "閉じる" : "キャンセル"}
        </button>
        {mode === "master" && (
          <button
            className="px-7 py-2.5 bg-slate-800 text-white rounded-[10px] text-sm font-semibold cursor-pointer hover:bg-slate-700 disabled:opacity-40"
            disabled={!name}
            onClick={handleSave}
          >
            企業情報を更新
          </button>
        )}
      </div>
    </div>
  );
}
