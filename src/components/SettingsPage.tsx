"use client";

import { useState, useEffect } from "react";
import type { Settings } from "@/lib/database.types";

function Field({
  label,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
        {label}
      </label>
      {multiline ? (
        <textarea
          className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400 min-h-[80px] resize-y"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

interface SettingsPageProps {
  settings: Settings | null;
  onSave: (settings: Omit<Settings, "created_at" | "updated_at">) => void;
}

export function SettingsPage({ settings, onSave }: SettingsPageProps) {
  const [companyName, setCompanyName] = useState(settings?.company_name ?? "");
  const [companyAddress, setCompanyAddress] = useState(settings?.company_address ?? "");
  const [companyPhone, setCompanyPhone] = useState(settings?.company_phone ?? "");
  const [bankInfo, setBankInfo] = useState(settings?.bank_info ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(settings?.invoice_number ?? "");
  const [saved, setSaved] = useState(false);
  const [initialized, setInitialized] = useState(!!settings);

  useEffect(() => {
    if (settings && !initialized) {
      setCompanyName(settings.company_name);
      setCompanyAddress(settings.company_address);
      setCompanyPhone(settings.company_phone);
      setBankInfo(settings.bank_info);
      setInvoiceNumber(settings.invoice_number);
      setInitialized(true);
    }
  }, [settings, initialized]);

  const handleSave = () => {
    onSave({
      id: "default",
      company_name: companyName,
      company_address: companyAddress,
      company_phone: companyPhone,
      bank_info: bankInfo,
      invoice_number: invoiceNumber,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h2 className="text-[22px] font-extrabold mb-6">設定</h2>

      <div className="max-w-[600px] space-y-6">
        <div className="bg-slate-50 rounded-xl p-5">
          <div className="text-sm font-bold text-slate-700 mb-4">
            自社情報（請求書に表示）
          </div>
          <div className="space-y-3">
            <Field
              label="会社名"
              value={companyName}
              onChange={setCompanyName}
              placeholder="株式会社〇〇"
            />
            <Field
              label="住所"
              value={companyAddress}
              onChange={setCompanyAddress}
              multiline
              placeholder="東京都渋谷区..."
            />
            <Field
              label="電話番号"
              value={companyPhone}
              onChange={setCompanyPhone}
              placeholder="03-1234-5678"
            />
            <Field
              label="登録番号（インボイス）"
              value={invoiceNumber}
              onChange={setInvoiceNumber}
              placeholder="T1234567890123"
            />
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-5">
          <div className="text-sm font-bold text-slate-700 mb-4">
            振込先情報
          </div>
          <Field
            label="振込先"
            value={bankInfo}
            onChange={setBankInfo}
            multiline
            placeholder={"〇〇銀行 △△支店\n普通 1234567\n口座名義 カ）〇〇"}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            className="px-7 py-2.5 bg-slate-800 text-white rounded-[10px] text-sm font-semibold cursor-pointer hover:bg-slate-700"
            onClick={handleSave}
          >
            保存
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">
              保存しました
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
