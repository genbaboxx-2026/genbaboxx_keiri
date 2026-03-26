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
              invoice_contact_name: company?.invoice_contact_name || "",
              invoice_email: company?.invoice_email || "",
            })
          }
        >
          {company ? "更新" : "登録"}
        </button>
      </div>
    </div>
  );
}
