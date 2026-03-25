"use client";

import { formatNumber } from "@/lib/calc";

interface MoneyInputProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
}

export function MoneyInput({
  label,
  value,
  onChange,
  placeholder,
}: MoneyInputProps) {
  return (
    <div>
      {label && (
        <label className="block text-[13px] font-semibold text-slate-600 mb-1.5">
          {label}
        </label>
      )}
      <input
        className="w-full px-3.5 py-2.5 border-[1.5px] border-slate-200 rounded-[10px] text-sm outline-none focus:border-blue-400 transition-colors"
        value={value ? formatNumber(value) : ""}
        onChange={(e) =>
          onChange(parseInt(e.target.value.replace(/[^0-9]/g, "")) || 0)
        }
        placeholder={placeholder || ""}
        inputMode="numeric"
      />
    </div>
  );
}
