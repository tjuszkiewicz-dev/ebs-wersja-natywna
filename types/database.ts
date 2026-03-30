// ── Typy TypeScript dla schematu Supabase ────────────────────────────────────
// Odzwierciedlają dokładnie tabele z migracji 001_initial_schema.sql
// Wzorzec zgodny z Supabase CLI v2 (wymaga Relationships i Views)

export type DbRole =
  | 'superadmin'
  | 'pracodawca'
  | 'pracownik'
  | 'partner'
  | 'menedzer'
  | 'dyrektor';

export type VoucherStatus =
  | 'created'
  | 'reserved'
  | 'active'
  | 'distributed'
  | 'consumed'
  | 'expired'
  | 'buyback_pending'
  | 'buyback_complete';

export type OrderStatus = 'pending' | 'approved' | 'paid' | 'rejected' | 'cancelled';
export type CommissionType = 'acquisition' | 'recurring' | 'renewal';
export type TransactionType = 'zakup' | 'przekazanie' | 'wykorzystanie' | 'zwrot' | 'emisja' | 'odkup';

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id:                 string;
          role:               DbRole;
          full_name:          string | null;
          company_name:       string | null;
          company_id:         string | null;
          pesel:              string | null;
          phone_number:       string | null;
          iban:               string | null;
          iban_verified:      boolean;
          iban_verified_at:   string | null;
          department:         string | null;
          position:           string | null;
          hire_date:          string | null;
          contract_type:      'UOP' | 'UZ' | null;
          status:             'active' | 'inactive' | 'anonymized';
          terms_accepted:     boolean;
          terms_accepted_at:  string | null;
          anonymized_at:      string | null;
          two_fa_enabled:     boolean;
          created_at:         string;
          updated_at:         string;
        };
        Insert: {
          id:                  string;
          role:                DbRole;
          full_name?:          string | null;
          company_name?:       string | null;
          company_id?:         string | null;
          pesel?:              string | null;
          phone_number?:       string | null;
          iban?:               string | null;
          iban_verified?:      boolean;
          iban_verified_at?:   string | null;
          department?:         string | null;
          position?:           string | null;
          hire_date?:          string | null;
          contract_type?:      'UOP' | 'UZ' | null;
          status?:             'active' | 'inactive' | 'anonymized';
          terms_accepted?:     boolean;
          terms_accepted_at?:  string | null;
          anonymized_at?:      string | null;
          two_fa_enabled?:     boolean;
          created_at?:         string;
          updated_at?:         string;
        };
        Update: {
          id?:                 string;
          role?:               DbRole;
          full_name?:          string | null;
          company_name?:       string | null;
          company_id?:         string | null;
          pesel?:              string | null;
          phone_number?:       string | null;
          iban?:               string | null;
          iban_verified?:      boolean;
          iban_verified_at?:   string | null;
          department?:         string | null;
          position?:           string | null;
          hire_date?:          string | null;
          contract_type?:      'UOP' | 'UZ' | null;
          status?:             'active' | 'inactive' | 'anonymized';
          terms_accepted?:     boolean;
          terms_accepted_at?:  string | null;
          anonymized_at?:      string | null;
          two_fa_enabled?:     boolean;
          created_at?:         string;
          updated_at?:         string;
        };
        Relationships: [];
      };

      companies: {
        Row: {
          id:                           string;
          name:                         string;
          nip:                          string;
          address_street:               string | null;
          address_city:                 string | null;
          address_zip:                  string | null;
          balance_pending:              number;
          balance_active:               number;
          advisor_id:                   string | null;
          manager_id:                   string | null;
          director_id:                  string | null;
          custom_voucher_validity_days: number | null;
          custom_payment_terms_days:    number | null;
          origin:                       'NATIVE' | 'CRM_SYNC';
          external_crm_id:              string | null;
          is_sync_managed:              boolean;
          created_at:                   string;
          updated_at:                   string;
        };
        Insert: {
          id?:                           string;
          name:                          string;
          nip:                           string;
          address_street?:               string | null;
          address_city?:                 string | null;
          address_zip?:                  string | null;
          balance_pending?:              number;
          balance_active?:               number;
          advisor_id?:                   string | null;
          manager_id?:                   string | null;
          director_id?:                  string | null;
          custom_voucher_validity_days?: number | null;
          custom_payment_terms_days?:    number | null;
          origin?:                       'NATIVE' | 'CRM_SYNC';
          external_crm_id?:              string | null;
          is_sync_managed?:              boolean;
          created_at?:                   string;
          updated_at?:                   string;
        };
        Update: {
          id?:                           string;
          name?:                         string;
          nip?:                          string;
          address_street?:               string | null;
          address_city?:                 string | null;
          address_zip?:                  string | null;
          balance_pending?:              number;
          balance_active?:               number;
          advisor_id?:                   string | null;
          manager_id?:                   string | null;
          director_id?:                  string | null;
          custom_voucher_validity_days?: number | null;
          custom_payment_terms_days?:    number | null;
          origin?:                       'NATIVE' | 'CRM_SYNC';
          external_crm_id?:              string | null;
          is_sync_managed?:              boolean;
          created_at?:                   string;
          updated_at?:                   string;
        };
        Relationships: [];
      };

      voucher_accounts: {
        Row: {
          id:         string;
          user_id:    string;
          balance:    number;
          created_at: string;
        };
        Insert: {
          id?:         string;
          user_id:     string;
          balance?:    number;
          created_at?: string;
        };
        Update: {
          id?:         string;
          user_id?:    string;
          balance?:    number;
          created_at?: string;
        };
        Relationships: [];
      };

      voucher_orders: {
        Row: {
          id:                 string;
          company_id:         string;
          hr_user_id:         string | null;
          amount_pln:         number;
          amount_vouchers:    number;
          fee_pln:            number;
          total_pln:          number;
          status:             OrderStatus;
          is_first_invoice:   boolean;
          doc_voucher_id:     string | null;
          doc_fee_id:         string | null;
          payroll_snapshots:  unknown | null;
          distribution_plan:  unknown | null;
          created_at:         string;
          updated_at:         string;
        };
        Insert: {
          id?:                string;
          company_id:         string;
          hr_user_id?:        string | null;
          amount_pln:         number;
          amount_vouchers:    number;
          fee_pln:            number;
          total_pln:          number;
          status?:            OrderStatus;
          is_first_invoice?:  boolean;
          doc_voucher_id?:    string | null;
          doc_fee_id?:        string | null;
          payroll_snapshots?: unknown | null;
          distribution_plan?: unknown | null;
          created_at?:        string;
          updated_at?:        string;
        };
        Update: {
          id?:                string;
          company_id?:        string;
          hr_user_id?:        string | null;
          amount_pln?:        number;
          amount_vouchers?:   number;
          fee_pln?:           number;
          total_pln?:         number;
          status?:            OrderStatus;
          is_first_invoice?:  boolean;
          doc_voucher_id?:    string | null;
          doc_fee_id?:        string | null;
          payroll_snapshots?: unknown | null;
          distribution_plan?: unknown | null;
          created_at?:        string;
          updated_at?:        string;
        };
        Relationships: [];
      };

      vouchers: {
        Row: {
          id:                   string;
          serial_number:        string;
          face_value_pln:       number;
          order_id:             string;
          company_id:           string;
          current_owner_id:     string;
          status:               VoucherStatus;
          issuer_name:          string;
          issuer_nip:           string;
          issuer_address:       string;
          redemption_scope:     string;
          legal_basis:          string;
          issued_at:            string;
          valid_until:          string;
          redeemed_at:          string | null;
          redeemed_by_user_id:  string | null;
          redeemed_order_id:    string | null;
          buyback_agreement_id: string | null;
          metadata:             unknown | null;
          created_at:           string;
        };
        Insert: {
          id?:                   string;
          serial_number:         string;
          face_value_pln:        number;
          order_id:              string;
          company_id:            string;
          current_owner_id:      string;
          status?:               VoucherStatus;
          issuer_name:           string;
          issuer_nip:            string;
          issuer_address:        string;
          redemption_scope:      string;
          legal_basis:           string;
          issued_at?:            string;
          valid_until:           string;
          redeemed_at?:          string | null;
          redeemed_by_user_id?:  string | null;
          redeemed_order_id?:    string | null;
          buyback_agreement_id?: string | null;
          metadata?:             unknown | null;
          created_at?:           string;
        };
        Update: {
          id?:                   string;
          serial_number?:        string;
          face_value_pln?:       number;
          order_id?:             string;
          company_id?:           string;
          current_owner_id?:     string;
          status?:               VoucherStatus;
          issuer_name?:          string;
          issuer_nip?:           string;
          issuer_address?:       string;
          redemption_scope?:     string;
          legal_basis?:          string;
          issued_at?:            string;
          valid_until?:          string;
          redeemed_at?:          string | null;
          redeemed_by_user_id?:  string | null;
          redeemed_order_id?:    string | null;
          buyback_agreement_id?: string | null;
          metadata?:             unknown | null;
          created_at?:           string;
        };
        Relationships: [];
      };

      voucher_transactions: {
        Row: {
          id:           string;
          from_user_id: string | null;
          to_user_id:   string;
          amount:       number;
          type:         TransactionType;
          status:       'completed' | 'pending' | 'failed';
          order_id:     string | null;
          service_id:   string | null;
          service_name: string | null;
          metadata:     unknown | null;
          created_at:   string;
        };
        // Tylko INSERT — immutable ledger: UPDATE zabroniony w kodzie aplikacji (enforced by DB trigger)
        Insert: {
          id?:           string;
          from_user_id?: string | null;
          to_user_id:    string;
          amount:        number;
          type:          TransactionType;
          status?:       'completed' | 'pending' | 'failed';
          order_id?:     string | null;
          service_id?:   string | null;
          service_name?: string | null;
          metadata?:     unknown | null;
          created_at?:   string;
        };
        Update: {
          id?:           string;
          from_user_id?: string | null;
          to_user_id?:   string;
          amount?:       number;
          type?:         TransactionType;
          status?:       'completed' | 'pending' | 'failed';
          order_id?:     string | null;
          service_id?:   string | null;
          service_name?: string | null;
          metadata?:     unknown | null;
          created_at?:   string;
        };
        Relationships: [];
      };

      commissions: {
        Row: {
          id:              string;
          agent_id:        string;
          agent_name:      string;
          agent_role:      'partner' | 'menedzer' | 'dyrektor';
          commission_type: CommissionType;
          order_id:        string | null;
          amount_pln:      number;
          rate:            string;
          quarter:         string | null;
          is_paid:         boolean;
          paid_at:         string | null;
          created_at:      string;
        };
        Insert: {
          id?:             string;
          agent_id:        string;
          agent_name:      string;
          agent_role:      'partner' | 'menedzer' | 'dyrektor';
          commission_type: CommissionType;
          order_id?:       string | null;
          amount_pln:      number;
          rate:            string;
          quarter?:        string | null;
          is_paid?:        boolean;
          paid_at?:        string | null;
          created_at?:     string;
        };
        Update: {
          id?:              string;
          agent_id?:        string;
          agent_name?:      string;
          agent_role?:      'partner' | 'menedzer' | 'dyrektor';
          commission_type?: CommissionType;
          order_id?:        string | null;
          amount_pln?:      number;
          rate?:            string;
          quarter?:         string | null;
          is_paid?:         boolean;
          paid_at?:         string | null;
          created_at?:      string;
        };
        Relationships: [];
      };

      buyback_agreements: {
        Row: {
          id:              string;
          user_id:         string;
          voucher_count:   number;
          total_value_pln: number;
          status:          'pending_approval' | 'approved' | 'paid';
          snapshot:        unknown;
          date_generated:  string;
          approved_at:     string | null;
          paid_at:         string | null;
          created_at:      string;
        };
        Insert: {
          id?:             string;
          user_id:         string;
          voucher_count:   number;
          total_value_pln: number;
          status?:         'pending_approval' | 'approved' | 'paid';
          snapshot:        unknown;
          date_generated?: string;
          approved_at?:    string | null;
          paid_at?:        string | null;
          created_at?:     string;
        };
        Update: {
          id?:              string;
          user_id?:         string;
          voucher_count?:   number;
          total_value_pln?: number;
          status?:          'pending_approval' | 'approved' | 'paid';
          snapshot?:        unknown;
          date_generated?:  string;
          approved_at?:     string | null;
          paid_at?:         string | null;
          created_at?:      string;
        };
        Relationships: [];
      };

      support_tickets: {
        Row: {
          id:                  string;
          subject:             string;
          category:            'TECHNICAL' | 'FINANCIAL' | 'VOUCHER' | 'OTHER';
          priority:            'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
          status:              'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
          creator_id:          string;
          creator_name:        string;
          company_id:          string | null;
          related_entity_id:   string | null;
          related_entity_type: string | null;
          created_at:          string;
          updated_at:          string;
        };
        Insert: {
          id?:                  string;
          subject:              string;
          category:             'TECHNICAL' | 'FINANCIAL' | 'VOUCHER' | 'OTHER';
          priority?:            'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
          status?:              'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
          creator_id:           string;
          creator_name:         string;
          company_id?:          string | null;
          related_entity_id?:   string | null;
          related_entity_type?: string | null;
          created_at?:          string;
          updated_at?:          string;
        };
        Update: {
          id?:                  string;
          subject?:             string;
          category?:            'TECHNICAL' | 'FINANCIAL' | 'VOUCHER' | 'OTHER';
          priority?:            'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
          status?:              'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
          creator_id?:          string;
          creator_name?:        string;
          company_id?:          string | null;
          related_entity_id?:   string | null;
          related_entity_type?: string | null;
          created_at?:          string;
          updated_at?:          string;
        };
        Relationships: [];
      };

      notifications: {
        // Schemat z 002_notifications.sql — user_id TEXT (nie UUID), kolumna `read` (nie is_read)
        Row: {
          id:                 string;
          user_id:            string;   // TEXT: auth.uid()::text LUB 'ALL_ADMINS'
          message:            string;
          type:               'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
          read:               boolean;
          priority:           'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | null;
          action:             Record<string, unknown> | null;  // JSONB
          target_entity_id:   string | null;
          target_entity_type: string | null;
          date:               string;
          created_at:         string;
        };
        Insert: {
          id?:                 string;
          user_id:             string;
          message:             string;
          type:                'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
          read?:               boolean;
          priority?:           'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | null;
          action?:             Record<string, unknown> | null;
          target_entity_id?:   string | null;
          target_entity_type?: string | null;
          date?:               string;
          created_at?:         string;
        };
        Update: {
          id?:                 string;
          user_id?:            string;
          message?:            string;
          type?:               'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';
          read?:               boolean;
          priority?:           'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | null;
          action?:             Record<string, unknown> | null;
          target_entity_id?:   string | null;
          target_entity_type?: string | null;
          date?:               string;
          created_at?:         string;
        };
        Relationships: [];
      };

      services: {
        Row: {
          id:          string;
          name:        string;
          description: string;
          price:       number;
          type:        'SUBSCRIPTION' | 'ONE_TIME';
          icon:        string;
          image_url:   string | null;
          is_active:   boolean;
          created_at:  string;
          updated_at:  string;
        };
        Insert: {
          id:           string;
          name:         string;
          description:  string;
          price:        number;
          type:         'SUBSCRIPTION' | 'ONE_TIME';
          icon:         string;
          image_url?:   string | null;
          is_active?:   boolean;
          created_at?:  string;
          updated_at?:  string;
        };
        Update: {
          id?:          string;
          name?:        string;
          description?: string;
          price?:       number;
          type?:        'SUBSCRIPTION' | 'ONE_TIME';
          icon?:        string;
          image_url?:   string | null;
          is_active?:   boolean;
          created_at?:  string;
          updated_at?:  string;
        };
        Relationships: [];
      };

      audit_log: {
        Row: {
          id:         string;
          table_name: string;
          operation:  'INSERT' | 'UPDATE' | 'DELETE';
          row_id:     string;
          changed_by: string | null;
          old_data:   unknown | null;
          new_data:   unknown | null;
          created_at: string;
        };
        // Wypełniany tylko przez triggery bazy — nie insertuj z poziomu aplikacji
        Insert: {
          id?:         string;
          table_name:  string;
          operation:   'INSERT' | 'UPDATE' | 'DELETE';
          row_id:      string;
          changed_by?: string | null;
          old_data?:   unknown | null;
          new_data?:   unknown | null;
          created_at?: string;
        };
        Update: {
          id?:         string;
          table_name?: string;
          operation?:  'INSERT' | 'UPDATE' | 'DELETE';
          row_id?:     string;
          changed_by?: string | null;
          old_data?:   unknown | null;
          new_data?:   unknown | null;
          created_at?: string;
        };
        Relationships: [];
      };

      import_history: {
        Row: {
          id:              string;
          company_id:      string;
          hr_user_id:      string | null;
          hr_name:         string;
          total_processed: number;
          status:          'SUCCESS' | 'PARTIAL' | 'ERROR';
          report_data:     unknown | null;
          created_at:      string;
        };
        Insert: {
          id?:              string;
          company_id:       string;
          hr_user_id?:      string | null;
          hr_name:          string;
          total_processed?: number;
          status?:          'SUCCESS' | 'PARTIAL' | 'ERROR';
          report_data?:     unknown | null;
          created_at?:      string;
        };
        Update: {
          id?:              string;
          company_id?:      string;
          hr_user_id?:      string | null;
          hr_name?:         string;
          total_processed?: number;
          status?:          'SUCCESS' | 'PARTIAL' | 'ERROR';
          report_data?:     unknown | null;
          created_at?:      string;
        };
        Relationships: [];
      };

      distribution_batches: {
        Row: {
          id:           string;
          company_id:   string;
          hr_user_id:   string | null;
          hr_name:      string;
          total_amount: number;
          status:       'completed';
          order_id:     string | null;
          created_at:   string;
        };
        Insert: {
          id:            string;
          company_id:    string;
          hr_user_id?:   string | null;
          hr_name:       string;
          total_amount:  number;
          status?:       'completed';
          order_id?:     string | null;
          created_at?:   string;
        };
        Update: {
          id?:           string;
          company_id?:   string;
          hr_user_id?:   string | null;
          hr_name?:      string;
          total_amount?: number;
          status?:       'completed';
          order_id?:     string | null;
          created_at?:   string;
        };
        Relationships: [];
      };

      distribution_batch_items: {
        Row: {
          id:         string;
          batch_id:   string;
          user_id:    string;
          user_name:  string;
          amount:     number;
          created_at: string;
        };
        Insert: {
          id?:         string;
          batch_id:    string;
          user_id:     string;
          user_name:   string;
          amount:      number;
          created_at?: string;
        };
        Update: {
          id?:         string;
          batch_id?:   string;
          user_id?:    string;
          user_name?:  string;
          amount?:     number;
          created_at?: string;
        };
        Relationships: [];
      };

      iban_change_requests: {
        Row: {
          id:               string;
          user_id:          string;
          new_iban:         string;
          reason:           string;
          status:           'pending' | 'approved' | 'rejected';
          rejection_reason: string | null;
          resolved_at:      string | null;
          created_at:       string;
        };
        Insert: {
          id?:               string;
          user_id:           string;
          new_iban:          string;
          reason:            string;
          status?:           'pending' | 'approved' | 'rejected';
          rejection_reason?: string | null;
          resolved_at?:      string | null;
          created_at?:       string;
        };
        Update: {
          id?:               string;
          user_id?:          string;
          new_iban?:         string;
          reason?:           string;
          status?:           'pending' | 'approved' | 'rejected';
          rejection_reason?: string | null;
          resolved_at?:      string | null;
          created_at?:       string;
        };
        Relationships: [];
      };

      notification_configs: {
        Row: {
          id:            string;
          user_id:       string;
          email_enabled: boolean;
          push_enabled:  boolean;
          types_enabled: string[];
          created_at:    string;
          updated_at:    string;
        };
        Insert: {
          id?:            string;
          user_id:        string;
          email_enabled?: boolean;
          push_enabled?:  boolean;
          types_enabled?: string[];
          created_at?:    string;
          updated_at?:    string;
        };
        Update: {
          id?:            string;
          user_id?:       string;
          email_enabled?: boolean;
          push_enabled?:  boolean;
          types_enabled?: string[];
          created_at?:    string;
          updated_at?:    string;
        };
        Relationships: [];
      };
    };

    Views: {
      [_ in never]: never;
    };

    Functions: {
      generate_voucher_serial: { Args: Record<PropertyKey, never>; Returns: string };
      mint_vouchers: {
        Args: {
          p_order_id:      string;
          p_company_id:    string;
          p_owner_id:      string;
          p_quantity:      number;
          p_valid_months?: number;
        };
        Returns: undefined;
      };
      transfer_vouchers: {
        Args: {
          p_from_user_id: string;
          p_to_user_id:   string;
          p_amount:       number;
          p_type:         string;
          p_order_id?:    string;
        };
        Returns: undefined;
      };
      redeem_voucher: {
        Args: {
          p_serial_number: string;
          p_user_id:       string;
          p_service_id?:   string;
          p_service_name?: string;
        };
        Returns: string;
      };
    };

    Enums: {
      [_ in never]: never;
    };

    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
