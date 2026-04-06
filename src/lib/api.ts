import { supabase } from "./supabase";
import type { Company, Contract, Expense, Settings, InvoiceTemplate } from "./database.types";

// ========== Companies ==========

export async function fetchCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as Company[];
}

export async function upsertCompany(
  company: Omit<Company, "created_at" | "updated_at">
): Promise<Company> {
  const { data, error } = await supabase
    .from("companies")
    .upsert(company as Record<string, unknown>)
    .select()
    .single();
  if (error) throw error;
  return data as Company;
}

export async function deleteCompany(id: string): Promise<void> {
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) throw error;
}

// ========== Contracts ==========

export async function fetchContracts(): Promise<Contract[]> {
  const { data, error } = await supabase
    .from("contracts")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as Contract[];
}

export async function upsertContract(
  contract: Omit<Contract, "created_at" | "updated_at">
): Promise<Contract> {
  const { data, error } = await supabase
    .from("contracts")
    .upsert(contract as Record<string, unknown>)
    .select()
    .single();
  if (error) throw error;
  return data as Contract;
}

export async function deleteContract(id: string): Promise<void> {
  const { error } = await supabase.from("contracts").delete().eq("id", id);
  if (error) throw error;
}

// ========== Expenses ==========

export async function fetchExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Expense[];
}

export async function upsertExpense(
  expense: Omit<Expense, "created_at" | "updated_at">
): Promise<Expense> {
  const { data, error } = await supabase
    .from("expenses")
    .upsert(expense as Record<string, unknown>)
    .select()
    .single();
  if (error) throw error;
  return data as Expense;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

// ========== Settings ==========

export async function fetchSettings(): Promise<Settings | null> {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", "default")
    .single();
  if (error) return null;
  return data as Settings;
}

// ========== Invoice Templates ==========

export async function fetchInvoiceTemplates(): Promise<InvoiceTemplate[]> {
  const { data, error } = await supabase
    .from("invoice_templates")
    .select("*")
    .order("product_type");
  if (error) throw error;
  return data as InvoiceTemplate[];
}

export async function upsertInvoiceTemplate(
  template: Omit<InvoiceTemplate, "created_at" | "updated_at">
): Promise<InvoiceTemplate> {
  const { data, error } = await supabase
    .from("invoice_templates")
    .upsert(template as Record<string, unknown>)
    .select()
    .single();
  if (error) throw error;
  return data as InvoiceTemplate;
}

export async function upsertSettings(
  settings: Omit<Settings, "created_at" | "updated_at">
): Promise<Settings> {
  const { data, error } = await supabase
    .from("settings")
    .upsert({ ...settings, id: "default" } as Record<string, unknown>)
    .select()
    .single();
  if (error) throw error;
  return data as Settings;
}

// ========== Invoice Notes ==========

export async function fetchInvoiceNotes(month: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("invoice_notes")
    .select("company_id, note")
    .eq("month", month);
  if (error) return {};
  const map: Record<string, string> = {};
  for (const row of data || []) {
    map[row.company_id] = row.note;
  }
  return map;
}

export async function upsertInvoiceNote(companyId: string, month: string, note: string): Promise<void> {
  const { error } = await supabase
    .from("invoice_notes")
    .upsert(
      { company_id: companyId, month, note } as Record<string, unknown>,
      { onConflict: "company_id,month" }
    );
  if (error) throw error;
}

// ========== Invoice Sent Status ==========

export async function fetchSentStatus(month: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("invoice_sent_status")
    .select("company_id, sent_at")
    .eq("month", month);
  if (error) return {};
  const map: Record<string, string> = {};
  for (const row of data || []) {
    map[row.company_id] = row.sent_at;
  }
  return map;
}

export async function markAsSent(companyId: string, month: string): Promise<void> {
  const { error } = await supabase
    .from("invoice_sent_status")
    .upsert(
      { company_id: companyId, month, sent_at: new Date().toISOString() } as Record<string, unknown>,
      { onConflict: "company_id,month" }
    );
  if (error) throw error;
}

export async function unmarkAsSent(companyId: string, month: string): Promise<void> {
  const { error } = await supabase
    .from("invoice_sent_status")
    .delete()
    .eq("company_id", companyId)
    .eq("month", month);
  if (error) throw error;
}
