export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "owner" | "admin" | "salesman";

export type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type Partner = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Expense = {
  id: string;
  name: string;
  amount: number;
  expense_date: string;
  created_by: string;
  created_by_name: string;
  created_by_role: UserRole;
  created_at: string;
};

export type SalesMemo = {
  id: string;
  sale_date: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_phone_normalized: string | null;
  created_by: string;
  created_by_name: string;
  created_by_role: UserRole;
  grand_total: number;
  created_at: string;
  updated_at: string;
};

export type SalesMemoItem = {
  id: string;
  memo_id: string;
  position: number;
  partner_id: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  created_at: string;
};

export type MemoItemSummary = {
  id: string;
  partner_id: string | null;
  partner_name: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type SalesMemoListRow = {
  id: string;
  sale_date: string;
  customer_name: string | null;
  customer_phone: string | null;
  created_by: string;
  created_by_name: string;
  created_by_role: UserRole;
  grand_total: number;
  created_at: string;
  updated_at: string;
  items: MemoItemSummary[];
  total_count: number;
};

export type SalesSummaryRow = {
  grand_total: number;
  memo_count: number;
  item_count: number;
};

export type SalesByPartnerRow = {
  partner_id: string | null;
  partner_name: string;
  memo_count: number;
  grand_total: number;
};

export type SalesByDayRow = {
  day: string;
  memo_count: number;
  grand_total: number;
};

type NoRelationships = [];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: {
          id: string;
          full_name: string;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: NoRelationships;
      };
      partners: {
        Row: Partner;
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: NoRelationships;
      };
      sales_memos: {
        Row: SalesMemo;
        Insert: {
          id?: string;
          sale_date?: string;
          customer_name?: string | null;
          customer_phone?: string | null;
          created_by: string;
          created_by_name: string;
          created_by_role: UserRole;
          grand_total?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sale_date?: string;
          customer_name?: string | null;
          customer_phone?: string | null;
          created_by?: string;
          created_by_name?: string;
          grand_total?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: NoRelationships;
      };
      sales_memo_items: {
        Row: SalesMemoItem;
        Insert: {
          id?: string;
          memo_id: string;
          position?: number;
          partner_id?: string | null;
          item_name: string;
          quantity?: number;
          unit_price: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          memo_id?: string;
          position?: number;
          partner_id?: string | null;
          item_name?: string;
          quantity?: number;
          unit_price?: number;
          created_at?: string;
        };
        Relationships: NoRelationships;
      };
      expenses: {
        Row: Expense;
        Insert: {
          id?: string;
          name: string;
          amount: number;
          expense_date?: string;
          created_by: string;
          created_by_name: string;
          created_by_role: UserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          amount?: number;
          expense_date?: string;
          created_by?: string;
          created_by_name?: string;
          created_by_role?: UserRole;
          created_at?: string;
        };
        Relationships: NoRelationships;
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_sales_memo: {
        Args: {
          p_sale_date: string;
          p_customer_name?: string | null;
          p_customer_phone?: string | null;
          p_items?: Json;
        };
        Returns: string;
      };
      update_sales_memo: {
        Args: {
          p_memo_id: string;
          p_sale_date: string;
          p_customer_name?: string | null;
          p_customer_phone?: string | null;
          p_items?: Json;
        };
        Returns: undefined;
      };
      list_sales_memos: {
        Args: {
          p_from?: string | null;
          p_to?: string | null;
          p_query?: string | null;
          p_partner_id?: string | null;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: SalesMemoListRow[];
      };
      sales_summary: {
        Args: {
          p_from: string;
          p_to: string;
          p_partner_id?: string | null;
        };
        Returns: SalesSummaryRow[];
      };
      sales_by_partner: {
        Args: {
          p_from: string;
          p_to: string;
          p_partner_id?: string | null;
        };
        Returns: SalesByPartnerRow[];
      };
      sales_by_day: {
        Args: {
          p_from: string;
          p_to: string;
          p_partner_id?: string | null;
        };
        Returns: SalesByDayRow[];
      };
      set_user_role: {
        Args: {
          p_user_id: string;
          p_role: UserRole;
        };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: UserRole;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
