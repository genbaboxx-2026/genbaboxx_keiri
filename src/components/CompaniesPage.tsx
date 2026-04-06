"use client";

import type { Company, Contract, ProductType } from "@/lib/database.types";
import { Badge } from "./Badge";

interface CompaniesPageProps {
  companies: Company[];
  contracts: Contract[];
  onAdd: () => void;
  onEdit: (company: Company) => void;
  onDelete: (id: string) => void;
}

export function CompaniesPage({
  companies,
  contracts,
  onAdd,
  onEdit,
  onDelete,
}: CompaniesPageProps) {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-[22px] font-extrabold">企業マスタ</h2>
        <button
          className="px-7 py-2.5 bg-slate-800 text-white rounded-[10px] text-sm font-semibold cursor-pointer hover:bg-slate-700"
          onClick={onAdd}
        >
          + 企業を追加
        </button>
      </div>
      {companies.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-slate-50 rounded-2xl">
          <div className="text-[40px] mb-3">🏢</div>
          <div>まだ企業が登録されていません</div>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b-2 border-slate-200">
                <th className="px-4 py-2.5 text-left font-bold text-xs text-slate-600">企業名</th>
                <th className="px-4 py-2.5 text-left font-bold text-xs text-slate-600">プロダクト</th>
                <th className="px-4 py-2.5 text-left font-bold text-xs text-slate-600">担当者</th>
                <th className="px-4 py-2.5 text-left font-bold text-xs text-slate-600">請求担当者</th>
                <th className="px-4 py-2.5 text-left font-bold text-xs text-slate-600">請求メール</th>
                <th className="px-4 py-2.5 text-left font-bold text-xs text-slate-600 w-16">契約数</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const companyContracts = contracts.filter((x) => x.company_id === c.id);
                const productTypes = [
                  ...new Set(companyContracts.map((x) => x.product_type)),
                ] as ProductType[];
                return (
                  <tr
                    key={c.id}
                    className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => onEdit(c)}
                  >
                    <td className="px-4 py-2.5 font-semibold">{c.name}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        {productTypes.map((p) => (
                          <Badge key={p} product={p} />
                        ))}
                        {productTypes.length === 0 && (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{c.contact || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-500">{c.invoice_contact_name || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-2.5">
                      {c.invoice_email ? (
                        <div className="flex flex-col gap-0.5">
                          {c.invoice_email.split(",").map((e, i) => (
                            <span key={i} className="text-xs text-blue-600 truncate max-w-[200px]" title={e.trim()}>{e.trim()}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center tabular-nums">{companyContracts.length}</td>
                    <td className="px-2 py-2.5">
                      <button
                        className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded text-[11px] font-medium cursor-pointer hover:bg-red-100"
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
