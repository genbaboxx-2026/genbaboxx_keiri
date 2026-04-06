"use client";

import { useState } from "react";
import type { Company } from "@/lib/database.types";

interface CompanyFormProps {
  company?: Company;
  onSave: (company: Omit<Company, "created_at" | "updated_at">) => void;
  onClose: () => void;
}

export function CompanyForm({ company, onSave, onClose }: CompanyFormProps) {
  const [name, setName] = useState(company?.name || "");
  const [contact, setContact] = useState(company?.contact || "");
  const [note, setNote] = useState(company?.note || "");
  const [invoiceContactName, setInvoiceContactName] = useState(company?.invoice_contact_name || "");
  const [invoiceEmails, setInvoiceEmails] = useState<string[]>(
    company?.invoice_email ? company.invoice_email.split(",").map((e) => e.trim()).filter(Boolean) : [""]
  );

  const updateEmail = (index: number, value: string) => {
    setInvoiceEmails((prev) => prev.map((e, i) => (i === index ? value : e)));
  };
  const addEmail = () => setInvoiceEmails((prev) => [...prev, ""]);
  const removeEmail = (index: number) => {
    setInvoiceEmails((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-4">
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
          className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400 min-h-[60px] resize-y"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="border-t border-slate-200 pt-4 mt-1">
        <div className="text-[13px] font-bold text-slate-600 mb-3">請求書送付先</div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
              担当者名
            </label>
            <input
              className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400"
              value={invoiceContactName}
              onChange={(e) => setInvoiceContactName(e.target.value)}
              placeholder="経理部 山田太郎"
            />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
              メールアドレス（To）
            </label>
            <div className="flex flex-col gap-2">
              {invoiceEmails.map((email, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="email"
                    className="flex-1 px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400"
                    value={email}
                    onChange={(e) => updateEmail(i, e.target.value)}
                    placeholder="keiri@example.com"
                  />
                  {invoiceEmails.length > 1 && (
                    <button
                      type="button"
                      className="px-2 py-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer text-sm"
                      onClick={() => removeEmail(i)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="text-[12px] text-blue-500 hover:text-blue-700 cursor-pointer bg-transparent border-none text-left px-1 font-medium"
                onClick={addEmail}
              >
                + アドレスを追加
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-2.5 justify-end mt-2">
        <button
          className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-[10px] text-sm font-medium cursor-pointer hover:bg-slate-200"
          onClick={onClose}
        >
          キャンセル
        </button>
        <button
          className="px-7 py-2.5 bg-slate-800 text-white rounded-[10px] text-sm font-semibold cursor-pointer hover:bg-slate-700 disabled:opacity-40"
          disabled={!name}
          onClick={() =>
            onSave({
              id: company?.id || crypto.randomUUID(),
              name,
              contact,
              note,
              invoice_contact_name: invoiceContactName,
              invoice_email: invoiceEmails.map((e) => e.trim()).filter(Boolean).join(","),
            })
          }
        >
          {company ? "更新" : "登録"}
        </button>
      </div>
    </div>
  );
}
