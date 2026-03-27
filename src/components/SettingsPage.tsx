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
  const [logoUrl, setLogoUrl] = useState(settings?.logo_url ?? "");
  const [stampUrl, setStampUrl] = useState(settings?.stamp_url ?? "");
  const defaultSubject = "【{会社名}】{月}分 請求書送付のご案内";
  const defaultBody = "いつもお世話になっております。\n○○です。\n\n○月分の請求書を添付にてお送りいたします。\nご確認のほど、よろしくお願いいたします。\n\n何かご不明な点がございましたら、お気軽にお問い合わせください。\n\n○○";
  const [emailSubjectTemplate, setEmailSubjectTemplate] = useState(settings?.email_subject_template || defaultSubject);
  const [emailBodyTemplate, setEmailBodyTemplate] = useState(settings?.email_body_template || defaultBody);
  const [saved, setSaved] = useState(false);
  const [initialized, setInitialized] = useState(!!settings);

  useEffect(() => {
    if (settings && !initialized) {
      setCompanyName(settings.company_name);
      setCompanyAddress(settings.company_address);
      setCompanyPhone(settings.company_phone);
      setBankInfo(settings.bank_info);
      setInvoiceNumber(settings.invoice_number);
      setLogoUrl(settings.logo_url || "");
      setStampUrl(settings.stamp_url || "");
      setEmailSubjectTemplate(settings.email_subject_template || defaultSubject);
      setEmailBodyTemplate(settings.email_body_template || defaultBody);
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
      logo_url: logoUrl,
      stamp_url: stampUrl,
      email_subject_template: emailSubjectTemplate,
      email_body_template: emailBodyTemplate,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h2 className="text-[22px] font-extrabold mb-6">設定</h2>

      <div className="flex gap-8">
        {/* 左カラム: 自社情報 */}
        <div className="flex-1 space-y-6">
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
        </div>

        {/* 右カラム: 振込先 + ロゴ・社印 */}
        <div className="flex-1 space-y-6">
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

          <div className="bg-slate-50 rounded-xl p-5">
            <div className="text-sm font-bold text-slate-700 mb-4">
              ロゴ・社印
            </div>
            <div className="space-y-3">
              <Field
                label="ロゴ画像URL"
                value={logoUrl}
                onChange={setLogoUrl}
                placeholder="https://example.com/logo.png"
              />
              {logoUrl && (
                <div className="flex items-center gap-2">
                  <img src={logoUrl} alt="ロゴ" className="h-10 object-contain" />
                  <span className="text-xs text-slate-400">プレビュー</span>
                </div>
              )}
              <Field
                label="社印画像URL"
                value={stampUrl}
                onChange={setStampUrl}
                placeholder="https://example.com/stamp.png"
              />
              {stampUrl && (
                <div className="flex items-center gap-2">
                  <img src={stampUrl} alt="社印" className="h-12 object-contain" />
                  <span className="text-xs text-slate-400">プレビュー</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 rounded-xl p-5 mt-6">
        <div className="text-sm font-bold text-slate-700 mb-4">
          メール設定（請求書送付時のデフォルト）
        </div>
        <div className="text-[10px] text-slate-400 mb-4 bg-slate-100 rounded-lg px-3 py-2">
          置換変数: <code className="font-mono bg-white px-1 rounded">○○</code> → 会社名、<code className="font-mono bg-white px-1 rounded">○月</code> → 対象月、<code className="font-mono bg-white px-1 rounded">{"{会社名}"}</code> → 会社名、<code className="font-mono bg-white px-1 rounded">{"{月}"}</code> → 対象月
        </div>
        <div className="flex gap-6">
          {/* 左: テンプレート入力 */}
          <div className="flex-1 space-y-3">
            <div className="text-xs font-bold text-slate-500 mb-1">テンプレート</div>
            <Field
              label="件名"
              value={emailSubjectTemplate}
              onChange={setEmailSubjectTemplate}
              placeholder="空欄時はデフォルトが適用されます"
            />
            <Field
              label="本文"
              value={emailBodyTemplate}
              onChange={setEmailBodyTemplate}
              multiline
              placeholder="空欄時はデフォルトが適用されます"
            />
          </div>
          {/* 右: 送信プレビュー */}
          <div className="flex-1">
            <div className="text-xs font-bold text-slate-500 mb-1">送信時の内容（プレビュー）</div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div>
                <div className="text-[10px] text-slate-400 mb-1">件名</div>
                <div className="text-sm font-medium text-slate-800">
                  {(emailSubjectTemplate || defaultSubject)
                    .replace(/\{会社名\}/g, companyName || "（会社名）")
                    .replace(/\{月\}/g, "3月")
                    .replace(/○○/g, companyName || "（会社名）")
                    .replace(/○月/g, "3月")}
                </div>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <div className="text-[10px] text-slate-400 mb-1">本文</div>
                <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                  {(emailBodyTemplate || defaultBody)
                    .replace(/○○/g, companyName || "（会社名）")
                    .replace(/○月/g, "3月")
                    .replace(/\{会社名\}/g, companyName || "（会社名）")
                    .replace(/\{月\}/g, "3月")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-6">
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
  );
}
