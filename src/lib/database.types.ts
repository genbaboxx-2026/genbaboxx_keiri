export type ProductType = "bakusoq" | "ninkuboxx" | "other";
export type CloseOffset = "-1" | "0" | "1";
export type PayType = "same_end" | "next_end" | "next_10" | "next2_10";
export type BillingDay = "1" | "16";
export type BillingType = "monthly" | "lump_sum";
export type ContractStatus = "initial" | "renewed" | "auto_renewing";

export interface Company {
  id: string;
  name: string;
  contact: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: string;
  company_id: string;
  product_type: ProductType;
  billing_type: BillingType;
  contract_status: ContractStatus;
  contract_start_date: string;
  billing_month: string;
  billing_day: BillingDay;
  duration_months: number;
  monthly_fee: number;
  fee_months: number;
  monthly_close: CloseOffset;
  monthly_pay: PayType;
  has_initial_fee: boolean;
  initial_fee: number;
  initial_close: CloseOffset;
  initial_pay: PayType;
  has_option: boolean;
  option_name: string;
  option_fee: number;
  option_close: CloseOffset;
  option_pay: PayType;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  id: string;
  company_name: string;
  company_address: string;
  company_phone: string;
  bank_info: string;
  invoice_number: string;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  name: string;
  month: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export type UserRole = "admin" | "member";

export interface Profile {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: Company;
        Insert: Omit<Company, "created_at" | "updated_at">;
        Update: Partial<Omit<Company, "id" | "created_at" | "updated_at">>;
      };
      contracts: {
        Row: Contract;
        Insert: Omit<Contract, "created_at" | "updated_at">;
        Update: Partial<Omit<Contract, "id" | "created_at" | "updated_at">>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id" | "user_id" | "created_at" | "updated_at">>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      product_type: ProductType;
      close_offset: CloseOffset;
      pay_type: PayType;
      billing_day: BillingDay;
    };
    CompositeTypes: Record<string, never>;
  };
}
