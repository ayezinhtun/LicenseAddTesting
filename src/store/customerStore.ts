import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Customer {
  id: string;
  company_name: string;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_number?: string | null;
  address?: string | null;
  created_at: string;
  updated_at: string;
}

interface CustomerState {
  customers: Customer[];
  isLoading: boolean;

  fetchCustomers: () => Promise<void>;
  addCustomer: (payload: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => Promise<Customer>;
  updateCustomer: (id: string, payload: Partial<Omit<Customer, 'id'>>) => Promise<Customer>;
  deleteCustomer: (id: string) => Promise<void>;
}

export const useCustomerStore = create<CustomerState>((set, get) => ({
  customers: [],
  isLoading: false,

  fetchCustomers: async () => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('company_name', { ascending: true });
    if (error) {
      console.error('Error fetching customers:', error);
      set({ isLoading: false });
      return;
    }
    set({ customers: data || [], isLoading: false });
  },

  addCustomer: async (payload) => {
    const { data, error } = await supabase
      .from('customers')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    await get().fetchCustomers();
    return data!;
  },

  updateCustomer: async (id, payload) => {
    const { data, error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await get().fetchCustomers();
    return data!;
  },

  deleteCustomer: async (id) => {
    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await get().fetchCustomers();
  },
}));