"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Company, Contract, ProductType, Profile, Expense } from "@/lib/database.types";
import {
  fetchCompanies,
  fetchContracts,
  upsertCompany,
  upsertContract,
  deleteCompany,
  deleteContract,
  fetchExpenses,
  upsertExpense,
  deleteExpense,
} from "@/lib/api";
import { PRODUCTS, TABS, type TabId } from "@/lib/constants";
import { getAllMonths, getRevenue } from "@/lib/calc";
import { Modal } from "@/components/Modal";
import { CompanyForm } from "@/components/CompanyForm";
import { ContractForm } from "@/components/ContractForm";
import { CompanyDetailModal } from "@/components/CompanyDetailModal";
import { CompaniesPage } from "@/components/CompaniesPage";
import { ContractPage } from "@/components/ContractPage";
import { CashflowPage } from "@/components/CashflowPage";
import { LoginPage } from "@/components/LoginPage";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

type ModalState =
  | null
  | { type: "company"; item?: Company }
  | { type: "company-detail"; company: Company; productFilter?: ProductType }
  | { type: "contract"; productType: ProductType; item?: Contract; companyId?: string };

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tab, setTabState] = useState<TabId>("bakusoq");
  const [modal, setModalState] = useState<ModalState>(null);
  const [viewList, setViewListState] = useState(false);
  const [sideOpen, setSideOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const skipUrlSync = useRef(false);

  // URL → 状態の読み取り
  const readUrl = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab") as TabId | null;
    const companyId = params.get("company");
    const view = params.get("view");
    return { tab: t, companyId, view };
  }, []);

  // 状態 → URLの更新
  const buildUrl = useCallback(
    (t: TabId, m: ModalState, list = false) => {
      const params = new URLSearchParams();
      params.set("tab", t);
      if (list) params.set("view", "list");
      if (m?.type === "company-detail") {
        params.set("company", m.company.id);
        if (m.productFilter) params.set("product", m.productFilter);
      }
      return `?${params.toString()}`;
    },
    []
  );

  const pushUrl = useCallback(
    (t: TabId, m: ModalState, list = false, replace = false) => {
      const url = buildUrl(t, m, list);
      if (replace) {
        window.history.replaceState(null, "", url);
      } else {
        window.history.pushState(null, "", url);
      }
    },
    [buildUrl]
  );

  // タブ変更（URL同期）
  const setTab = useCallback(
    (t: TabId) => {
      setTabState(t);
      setModalState(null);
      setViewListState(false);
      pushUrl(t, null, false);
    },
    [pushUrl]
  );

  // ビュー切替（URL同期）
  const setViewList = useCallback(
    (show: boolean) => {
      setViewListState(show);
      pushUrl(tab, null, show);
    },
    [tab, pushUrl]
  );

  // モーダル変更（URL同期）
  const setModal = useCallback(
    (m: ModalState) => {
      setModalState(m);
      if (m?.type === "company-detail") {
        pushUrl(tab, m, viewList);
      } else if (m === null) {
        pushUrl(tab, null, viewList, true);
      }
    },
    [tab, viewList, pushUrl]
  );

  // 認証状態の監視
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (!session?.user) {
          setProfile(null);
          setAuthLoading(false);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // プロフィール取得
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setProfile(data as Profile | null);
        setAuthLoading(false);
      });
  }, [user]);

  // memberがcashflowタブにいる場合はリダイレクト
  useEffect(() => {
    if (profile?.role === "member" && tab === "cashflow") {
      setTab("bakusoq");
    }
  }, [profile, tab]);

  // 初回データ取得
  useEffect(() => {
    if (!user) return;
    Promise.all([fetchCompanies(), fetchContracts()])
      .then(([cos, cons]) => {
        setCompanies(cos);
        setContracts(cons);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    fetchExpenses()
      .then(setExpenses)
      .catch(() => {});
  }, [user]);

  // URLパラメータからの状態復元ヘルパー
  const restoreFromParams = useCallback(
    (params: URLSearchParams) => {
      const urlTab = params.get("tab") as TabId | null;
      const companyId = params.get("company");
      const view = params.get("view");
      if (urlTab) {
        const validTabs = TABS.map((t) => t.id) as string[];
        if (validTabs.includes(urlTab)) {
          setTabState(urlTab as TabId);
        }
      }
      setViewListState(view === "list");
      if (companyId) {
        const company = companies.find((c) => c.id === companyId);
        if (company) {
          const pf = params.get("product") as ProductType | null;
          setModalState({
            type: "company-detail",
            company,
            productFilter: pf || undefined,
          });
        }
      } else {
        setModalState(null);
      }
    },
    [companies]
  );

  // URLからの初期状態復元（データ読み込み後）
  useEffect(() => {
    if (loading || companies.length === 0) return;
    restoreFromParams(new URLSearchParams(window.location.search));
  }, [loading, companies, restoreFromParams]);

  // ブラウザの戻る/進む対応
  useEffect(() => {
    const handlePopState = () => {
      restoreFromParams(new URLSearchParams(window.location.search));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [restoreFromParams]);

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
      alert("企業の登録に失敗しました");
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

  const handleAddExpense = async (name: string, month: string, amount: number) => {
    try {
      // 同じname+monthがあれば更新、なければ新規
      const existing = expenses.find((e) => e.name === name && e.month === month);
      const saved = await upsertExpense({
        id: existing?.id || crypto.randomUUID(),
        name,
        month,
        amount,
      });
      setExpenses((prev) => {
        const filtered = prev.filter((e) => e.id !== saved.id);
        return [...filtered, saved];
      });
    } catch (e) {
      console.error(e);
      alert("支出の追加に失敗しました");
    }
  };

  const handleDeleteExpense = async (id: string) => {
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      console.error(e);
      alert("削除に失敗しました");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  // ロールに基づいてタブをフィルタリング
  const visibleTabs = useMemo(
    () =>
      profile?.role === "member"
        ? TABS.filter((t) => t.id !== "cashflow")
        : TABS,
    [profile]
  );

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="text-slate-400">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

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
        companies={companies}
        contractsFor={contractsFor}
        allMonths={allMonths}
        revenueFor={revenueFor}
        companiesCount={companies.length}
        expenses={expenses}
        onAddExpense={handleAddExpense}
        onDeleteExpense={handleDeleteExpense}
      />
    );
  } else if (tab === "companies") {
    content = (
      <CompaniesPage
        companies={companies}
        contracts={contracts}
        onAdd={() => setModal({ type: "company" })}
        onEdit={(co) => setModal({ type: "company-detail", company: co })}
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
        showList={viewList}
        onShowList={setViewList}
        onAdd={() => setModal({ type: "contract", productType: tab })}
        onEdit={(cn) => {
          const company = companies.find((c) => c.id === cn.company_id);
          if (company) {
            setModal({ type: "company-detail", company, productFilter: tab as ProductType });
          }
        }}
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
              契約管理
            </span>
          )}
        </div>
        <div className="p-2 flex-1">
          {visibleTabs.map((t, i) => {
            const showSeparator =
              i > 0 &&
              visibleTabs[i - 1]?.id !== "cashflow" &&
              visibleTabs[i - 1]?.id !== "companies" &&
              (t.id === "cashflow" || t.id === "companies");
            return (
              <div key={t.id}>
                {showSeparator && (
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
            );
          })}
        </div>
        <div className="border-t border-slate-800 p-2">
          {sideOpen && profile && (
            <div className="px-2.5 py-2 mb-1">
              <div className="text-[11px] text-slate-400 truncate">
                {profile.name || profile.email}
              </div>
              <div className="text-[10px] text-slate-600">
                {profile.role === "admin" ? "管理者" : "メンバー"}
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-2.5 rounded-[10px] text-[13px] cursor-pointer border-none bg-transparent text-slate-400 font-medium hover:text-red-400 ${
              sideOpen ? "px-3.5 py-2.5 justify-start" : "px-0 py-2.5 justify-center"
            }`}
          >
            <span className="text-base">🚪</span>
            {sideOpen && <span className="whitespace-nowrap">ログアウト</span>}
          </button>
        </div>
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
        open={modal?.type === "company-detail"}
        onClose={() => setModal(null)}
        title="企業詳細"
      >
        {modal?.type === "company-detail" && (
          <CompanyDetailModal
            company={modal.company}
            contracts={contracts}
            productFilter={modal.productFilter}
            onSave={handleSaveCompany}
            onAddContract={(productType) =>
              setModal({
                type: "contract",
                productType,
                companyId: modal.company.id,
              })
            }
            onEditContract={(cn) =>
              setModal({
                type: "contract",
                productType: cn.product_type,
                item: cn,
                companyId: modal.company.id,
              })
            }
            onDeleteContract={handleDeleteContract}
            onClose={() => setModal(null)}
          />
        )}
      </Modal>
      <Modal
        open={modal?.type === "contract"}
        onClose={() => setModal(null)}
        onBack={
          modal?.type === "contract" && modal.companyId
            ? () => {
                const company = companies.find((c) => c.id === modal.companyId);
                if (company) {
                  setModal({ type: "company-detail", company, productFilter: modal.productType });
                }
              }
            : undefined
        }
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
            fixedCompanyId={modal.companyId}
            onSave={handleSaveContract}
            onAddCompany={handleAddCompanyInline}
            onClose={() => setModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}
