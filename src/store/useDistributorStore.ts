import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Distributor {
  id: string;
  company_name: string;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_number?: string | null;
  created_at: string;
  updated_at: string;
}

interface DistributorState {
  distributors: Distributor[];
  isLoading: boolean;
  fetchDistributors: () => Promise<void>;
  addDistributor: (payload: Omit<Distributor, 'id' | 'created_at' | 'updated_at'>) => Promise<Distributor>;
  updateDistributor: (id: string, payload: Partial<Omit<Distributor, 'id'>>) => Promise<Distributor>;
  deleteDistributor: (id: string) => Promise<void>;
}

export const useDistributorStore = create<DistributorState>((set, get) => ({
  distributors: [],
  isLoading: false,

  fetchDistributors: async () => {
    set({ isLoading: true });
    const { data, error } = await supabase
      .from('distributors')
      .select('*')
      .order('company_name', { ascending: true });
    if (error) {
      console.error('Error fetching distributors:', error);
      set({ isLoading: false });
      return;
    }
    set({ distributors: data || [], isLoading: false });
  },

  addDistributor: async (payload) => {
    const { data, error } = await supabase
      .from('distributors')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    await get().fetchDistributors();
    return data!;
  },

  updateDistributor: async (id, payload) => {
    const { data, error } = await supabase
      .from('distributors')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    await get().fetchDistributors();
    return data!;
  },

  deleteDistributor: async (id) => {
    const { error } = await supabase
      .from('distributors')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await get().fetchDistributors();
  },
}));