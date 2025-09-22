import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Database types
export interface Database {
  public: {
    Tables: {
      licenses: {
        Row: {
          id: string;
          company: string;
          vendor: string;
          item: string;
          item_description: string;
          serial_number: string;
          project_name: string;
          customer_name: string;
          business_unit: string;
          license_start_date: string;
          license_end_date: string;
          license_cost: number;
          quantity: number;
          auto_renew: boolean;
          user_name: string;
          url: string | null;
          activation_link: string | null;
          remark: string | null;
          custom_fields: Record<string, any>;
          tags: string[];
          priority: 'low' | 'medium' | 'high' | 'critical';
          status: 'active' | 'expired' | 'suspended' | 'pending';
          created_at: string;
          updated_at: string;
          created_by: string;
          last_modified_by: string;
        };
        Insert: Omit<Database['public']['Tables']['licenses']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['licenses']['Insert']>;
      };
      audit_logs: {
        Row: {
          id: string;
          action: 'create' | 'update' | 'delete' | 'view' | 'export' | 'login' | 'logout';
          entity_type: 'license' | 'user' | 'report' | 'notification';
          entity_id: string;
          user_id: string;
          user_name: string;
          changes: Record<string, any> | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
      };
      notifications: {
        Row: {
          id: string;
          type: 'expiry' | 'renewal' | 'comment' | 'system' | 'warning' | 'info';
          title: string;
          message: string;
          license_id: string | null;
          user_id: string;
          is_read: boolean;
          priority: 'low' | 'medium' | 'high';
          action_required: boolean;
          action_url: string | null;
          created_at: string;
          expires_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };
      license_comments: {
        Row: {
          id: string;
          license_id: string;
          content: string;
          author_id: string;
          author_name: string;
          created_at: string;
          is_edited: boolean;
          edited_at: string | null;
          mentions: string[];
        };
        Insert: Omit<Database['public']['Tables']['license_comments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['license_comments']['Insert']>;
      };
      license_attachments: {
        Row: {
          id: string;
          license_id: string;
          file_name: string;
          file_type: string;
          file_size: number;
          file_url: string;
          uploaded_by: string;
          uploaded_at: string;
          description: string | null;
        };
        Insert: Omit<Database['public']['Tables']['license_attachments']['Row'], 'id' | 'uploaded_at'>;
        Update: Partial<Database['public']['Tables']['license_attachments']['Insert']>;
      };
      renewal_history: {
        Row: {
          id: string;
          license_id: string;
          renewal_date: string;
          previous_end_date: string;
          new_end_date: string;
          cost: number;
          renewed_by: string;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['renewal_history']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['renewal_history']['Insert']>;
      };
    };
  };
}