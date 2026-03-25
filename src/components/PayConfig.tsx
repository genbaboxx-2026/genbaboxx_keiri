"use client";

import type { CloseOffset, PayType } from "@/lib/database.types";
import { monthAt, payDescriptionGeneric } from "@/lib/calc";

const CLOSE_OPTIONS: { value: CloseOffset; label: string }[] = [
  { value: "-1", label: "前月" },
  { value: "0", label: "当月" },
  { value: "1", label: "翌月" },
];

const PAY_OPTIONS: { value: PayType; label: string }[] = [
  { value: "same_end", label: "当月末" },
  { value: "next_end", label: "翌月末" },
  { value: "next_10", label: "翌月10日" },
];

interface PayConfigProps {
  label: string;
  close: CloseOffset;
  pay: PayType;
  onCloseChange: (v: CloseOffset) => void;
  onPayChange: (v: PayType) => void;
  baseMonth?: number; // 1-12の月番号
}

export function PayConfig({
  label,
  close,
  pay,
  onCloseChange,
  onPayChange,
  baseMonth,
}: PayConfigProps) {
  const bm = baseMonth || 0;
  const clM = bm ? monthAt(bm, parseInt(close)) : 0;

  return (
    <div>
      <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
        {label}
      </label>
      <div className="flex gap-1 items-center">
        <select
          className="flex-1 min-w-0 px-2.5 py-2 border-[1.5px] border-slate-200 rounded-lg text-[13px] outline-none focus:border-blue-400"
          value={close}
          onChange={(e) => onCloseChange(e.target.value as CloseOffset)}
        >
          {CLOSE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {bm ? `${monthAt(bm, parseInt(o.value))}月` : o.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500 whitespace-nowrap">締め</span>
        <select
          className="flex-1 min-w-0 px-2.5 py-2 border-[1.5px] border-slate-200 rounded-lg text-[13px] outline-none focus:border-blue-400"
          value={pay}
          onChange={(e) => onPayChange(e.target.value as PayType)}
        >
          {PAY_OPTIONS.map((o) => {
            const pm = clM
              ? o.value === "same_end"
                ? clM
                : monthAt(clM, 1)
              : 0;
            const dayLabel = o.value.includes("10") ? "10日" : "末";
            return (
              <option key={o.value} value={o.value}>
                {pm ? `${pm}月${dayLabel}` : o.label}
              </option>
            );
          })}
        </select>
        <span className="text-xs text-slate-500 whitespace-nowrap">払い</span>
      </div>
      {bm > 0 && (
        <div className="mt-1.5 text-[11px] text-blue-500 font-medium">
          → {payDescriptionGeneric(close, pay)}
        </div>
      )}
    </div>
  );
}
