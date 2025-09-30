import { create } from "zustand";
import { supabase } from "../lib/supabase";

export interface ProjectAssign {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
}

interface ProjectAssignState {
    assigns: ProjectAssign[];
    isLoading: boolean;
    fetchProjectAssigns: () => Promise<void>;
    addProjectAssign: (name: string) => Promise<ProjectAssign>;
    updateProjectAssign: (id: string, name: string) => Promise<ProjectAssign>;
    deleteProjectAssign: (id: string) => Promise<void>;
}

export const useProjectAssignStore = create<ProjectAssignState>((set, get) => ({
    assigns: [],
    isLoading: false,
  
    fetchProjectAssigns: async () => {
      set({ isLoading: true });
      const { data, error } = await supabase
        .from('project_assigns')
        .select('*')
        .order('name', { ascending: true });
      if (error) {
        console.error('Error fetching project assigns:', error);
        set({ isLoading: false });
        return;
      }
      set({ assigns: data || [], isLoading: false });
    },
  
    addProjectAssign: async (name) => {
      const { data, error } = await supabase
        .from('project_assigns')
        .insert([{ name }])
        .select()
        .single();
      if (error) throw error;
      await get().fetchProjectAssigns();
      return data!;
    },
  
    updateProjectAssign: async (id, name) => {
      const { data, error } = await supabase
        .from('project_assigns')
        .update({ name })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      await get().fetchProjectAssigns();
      return data!;
    },
  
    deleteProjectAssign: async (id) => {
      const { error } = await supabase
        .from('project_assigns')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await get().fetchProjectAssigns();
    },
  }));