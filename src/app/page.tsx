"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Company, Contract, ProductType } from "@/lib/database.types";
import {
  fetchCompanies,
  fetchContracts,
  upsertCompany,
  upsertContract,
  deleteCompany,
  deleteContract,
} from "@/lib/api";
import { PRODUCTS, TABS, type TabId } from "@/lib/constants";
import { getAllMonths, getRevenue } from "@/lib/calc";
import { Modal } from "@/components/Modal";
import { CompanyForm } from "@/components/CompanyForm";
import { ContractForm } from "@/components/ContractForm";
import { CompaniesPage } from "@/components/CompaniesPage";
import { ContractPage } from "@/components/ContractPage";
import { CashflowPage } from "@/components/CashflowPage";

type ModalState =
  | null
  | { type: "company"; item?: Company }
  | { type: "contract"; productType: ProductType; item?: Contract };

export default function Home() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [tab, setTab] = useState<TabId>("bakusoq");
  const [modal, setModal] = useState<ModalState>(null);
  const [sideOpen, setSideOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  // 初回データ取得
  useEffect(() => {
    Promise.all([fetchCompanies(), fetchContracts()])
      .then(([cos, cons]) => {
        setCompanies(cos);
        setContracts(cons);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const allMonths = useMemo(() => getAllMonths(contracts), [contracts]);

  const getCompanyName = useCallback(
    (id: string) => companies.find((c) => c.id === id)?.name || "不明",
    [companies]
  );

  const contractsFor = useCallback(
    (pid: ProductType) => contracts.filter((c) => c.product_type === pid),
    [contracts]
  );

  const revenueFor = useCallback(
    (month: string, productFilter?: string) =>
      getRevenue(month, contracts, productFilter),
    [contracts]
  );

  // ====== CRUD handlers ======
  const handleSaveCompany = async (
    co: Omit<Company, "created_at" | "updated_at">
  ) => {
    try {
      const saved = await upsertCompany(co);
      setCompanies((prev) => {
        const exists = prev.find((c) => c.id === saved.id);
        return exists
          ? prev.map((c) => (c.id === saved.id ? saved : c))
          : [...prev, saved];
      });
      setModal(null);
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
    }
  };

  const handleAddCompanyInline = async (
    co: Omit<Company, "created_at" | "updated_at">
  ) => {
    try {
      const saved = await upsertCompany(co);
      setCompanies((prev) => [...prev, saved]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCompany = async (id: string) => {
    if (!confirm("この企業を削除しますか？関連する契約も削除されます。")) return;
    try {
      await deleteCompany(id);
      setCompanies((prev) => prev.filter((c) => c.id !== id));
      setContracts((prev) => prev.filter((c) => c.company_id !== id));
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました");
    }
  };

  const handleSaveContract = async (
    cn: Omit<Contract, "created_at" | "updated_at">
  ) => {
    try {
      const saved = await upsertContract(cn);
      setContracts((prev) => {
        const exists = prev.find((c) => c.id === saved.id);
        return exists
          ? prev.map((c) => (c.id === saved.id ? saved : c))
          : [...prev, saved];
      });
      setModal(null);
    } catch (e) {
      console.error(e);
      alert("保存に失敗しました");
    }
  };

  const handleDeleteContract = async (id: string) => {
    if (!confirm("この契約を削除しますか？")) return;
    try {
      await deleteContract(id);
      setContracts((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="text-slate-400">読み込み中...</div>
      </div>
    );
  }

  // ====== Content routing ======
  let content: React.ReactNode;
  if (tab === "cashflow") {
    content = (
      <CashflowPage
        contracts={contracts}
        contractsFor={contractsFor}
        allMonths={allMonths}
        revenueFor={revenueFor}
        companiesCount={companies.length}
      />
    );
  } else if (tab === "companies") {
    content = (
      <CompaniesPage
        companies={companies}
        contracts={contracts}
        onAdd={() => setModal({ type: "company" })}
        onEdit={(co) => setModal({ type: "company", item: co })}
        onDelete={handleDeleteCompany}
      />
    );
  } else {
    content = (
      <ContractPage
        productType={tab}
        contracts={contractsFor(tab)}
        allMonths={allMonths}
        getCompanyName={getCompanyName}
        revenueFor={revenueFor}
        onAdd={() => setModal({ type: "contract", productType: tab })}
        onEdit={(cn) =>
          setModal({ type: "contract", productType: tab, item: cn })
        }
        onDelete={handleDeleteContract}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <div
        className="flex flex-col flex-shrink-0 bg-slate-900 text-white transition-all duration-300 overflow-hidden"
        style={{ width: sideOpen ? 220 : 56 }}
      >
        <div
          className={`flex items-center gap-2.5 border-b border-slate-800 ${sideOpen ? "px-[18px] py-5" : "px-2.5 py-5"}`}
        >
          <button
            onClick={() => setSideOpen(!sideOpen)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-white text-xl cursor-pointer"
          >
            {sideOpen ? "◀" : "▶"}
          </button>
          {sideOpen && (
            <span className="text-[15px] font-extrabold whitespace-nowrap">
              財務管理
            </span>
          )}
        </div>
        <div className="p-2 flex-1">
          {TABS.map((t, i) => (
            <div key={t.id}>
              {i === 3 && (
                <div
                  className={`border-t border-slate-700 ${sideOpen ? "mx-2.5 my-2.5" : "mx-1 my-2.5"}`}
                />
              )}
              <button
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-2.5 rounded-[10px] text-[13px] mb-0.5 cursor-pointer border-none ${
                  tab === t.id
                    ? "bg-blue-800 text-white font-bold"
                    : "bg-transparent text-slate-400 font-medium hover:text-slate-200"
                } ${sideOpen ? "px-3.5 py-2.5 justify-start" : "px-0 py-2.5 justify-center"}`}
              >
                <span className="text-base">{t.icon}</span>
                {sideOpen && <span className="whitespace-nowrap">{t.label}</span>}
              </button>
            </div>
          ))}
        </div>
        {sideOpen && (
          <div className="px-[18px] py-3 border-t border-slate-800 text-[11px] text-slate-500">
            自動保存
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto px-8 py-7">{content}</div>
      </div>

      {/* Modals */}
      <Modal
        open={modal?.type === "company"}
        onClose={() => setModal(null)}
        title={
          modal?.type === "company" && modal.item
            ? "企業を編集"
            : "企業を登録"
        }
      >
        {modal?.type === "company" && (
          <CompanyForm
            company={modal.item}
            onSave={handleSaveCompany}
            onClose={() => setModal(null)}
          />
        )}
      </Modal>
      <Modal
        open={modal?.type === "contract"}
        onClose={() => setModal(null)}
        title={
          modal?.type === "contract" && modal.item
            ? "契約を編集"
            : "契約を登録"
        }
      >
        {modal?.type === "contract" && (
          <ContractForm
            contract={modal.item}
            productType={modal.productType}
            companies={companies}
            onSave={handleSaveContract}
            onAddCompany={handleAddCompanyInline}
            onClose={() => setModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}
