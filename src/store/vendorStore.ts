import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Vendor {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
}

interface VendorState {
    vendors: Vendor[];
    isLoading: boolean;
    fetchVendors: () => Promise<void>;
    addVendor: (name: string) => Promise<void>;
    updateVendor: (id: string, name: string) => Promise<Vendor>;
    deleteVendor: (id: string) => Promise<void>;
}

export const useVendorStore = create<VendorState>((set, get) => ({
    vendors: [],
    isLoading: false,
  
    fetchVendors: async () => {
      set({ isLoading: true });
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('name', { ascending: true });
  
      if (error) {
        console.error('Error fetching vendors:', error);
        set({ isLoading: false });
        return;
      }
      set({ vendors: data || [], isLoading: false });
    },
  
    addVendor: async (name) => {
      const { data, error } = await supabase
        .from('vendors')
        .insert([{ name }])
        .select()
        .single();
  
      if (error) throw error;
      await get().fetchVendors();
      return data!;
    },
  
    updateVendor: async (id, name) => {
      const { data, error } = await supabase
        .from('vendors')
        .update({ name })
        .eq('id', id)
        .select()
        .single();
  
      if (error) throw error;
      await get().fetchVendors();
      return data!;
    },
  
    deleteVendor: async (id) => {
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', id);
  
      if (error) throw error;
      await get().fetchVendors();
    },
  }));