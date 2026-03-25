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
        <div className="grid gap-3">
          {companies.map((c) => {
            const productTypes = [
              ...new Set(
                contracts
                  .filter((x) => x.company_id === c.id)
                  .map((x) => x.product_type)
              ),
            ] as ProductType[];
            return (
              <div
                key={c.id}
                className="bg-white border border-slate-200 rounded-[14px] px-[22px] py-[18px] flex justify-between items-center cursor-pointer hover:border-slate-300 transition-colors"
                onClick={() => onEdit(c)}
              >
                <div>
                  <div className="text-base font-bold">{c.name}</div>
                  <div className="flex gap-1.5 mt-1.5">
                    {productTypes.map((p) => (
                      <Badge key={p} product={p} />
                    ))}
                    {productTypes.length === 0 && (
                      <span className="text-xs text-slate-400">契約なし</span>
                    )}
                  </div>
                  {c.contact && (
                    <div className="text-xs text-slate-500 mt-1">
                      {c.contact}
                    </div>
                  )}
                </div>
                <button
                  className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-[13px] font-medium cursor-pointer hover:bg-red-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(c.id);
                  }}
                >
                  削除
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
