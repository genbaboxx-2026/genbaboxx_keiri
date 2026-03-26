import { supabase } from "./supabase";
import type { Company, Contract, Expense, Settings } from "./database.types";

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
