import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'super_user' | 'user' | 'viewer';
  isVerified: boolean;
  department?: string;
  phone?: string;
  avatar?: string;
  createdAt: string;
  lastLogin?: string;
  preferences?: any;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  profileStatus: 'pending' | 'approved' | 'rejected' | null;
  assignments: string[];
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  getCurrentUser: () => Promise<User | null>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      profileStatus: null,
      assignments: [],

      getCurrentUser: async () => {
        try {
          const { data: { user }, error } = await supabase.auth.getUser();
          
          // If there's an error but it's just because no session exists, that's normal
          if (error && error.message !== 'Auth session missing!') {
            console.error('Error getting current user:', error);
          }
          
          if (user) {
            // Fetch user_profile and assignments
            const { data: profileRow } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', user.id)
              .single();

            const { data: assignsRows } = await supabase
              .from('user_project_assigns')
              .select('project_assign')
              .eq('user_id', user.id);

            const assignments = (assignsRows || []).map((r: any) => r.project_assign as string);

            const roleFromProfile = (profileRow?.role as any) || user.user_metadata?.role || 'user';
            const statusFromProfile = (profileRow?.status as any) || null;

            const userData: User = {
              id: user.id,
              name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
              email: user.email || '',
              role: roleFromProfile,
              isVerified: user.email_confirmed_at !== null,
              department: user.user_metadata?.department || 'General',
              phone: user.user_metadata?.phone || '',
              avatar: user.user_metadata?.avatar || '',
              createdAt: user.created_at || new Date().toISOString(),
              lastLogin: new Date().toISOString(),
              preferences: user.user_metadata?.preferences || {}
            };

            set({ user: userData, isAuthenticated: true, profileStatus: statusFromProfile, assignments });
            return userData;
          }
          
          // No user found - this is normal for unauthenticated state
          set({ user: null, isAuthenticated: false, profileStatus: null, assignments: [] });
          return null;
        } catch (error) {
          // Only log unexpected errors
          console.error('Unexpected error getting current user:', error);
          set({ user: null, isAuthenticated: false });
          return null;
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
          });

          if (error) throw error;

          if (data.user) {
            // Fetch profile and assignments after login
            const { data: profileRow } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', data.user.id)
              .single();

            const { data: assignsRows } = await supabase
              .from('user_project_assigns')
              .select('project_assign')
              .eq('user_id', data.user.id);

            const assignments = (assignsRows || []).map((r: any) => r.project_assign as string);

            const roleFromProfile = (profileRow?.role as any) || data.user.user_metadata?.role || 'user';
            const statusFromProfile = (profileRow?.status as any) || null;

            const userData: User = {
              id: data.user.id,
              name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
              email: data.user.email || '',
              role: roleFromProfile,
              isVerified: data.user.email_confirmed_at !== null,
              department: data.user.user_metadata?.department || 'General',
              phone: data.user.user_metadata?.phone || '',
              avatar: data.user.user_metadata?.avatar || '',
              createdAt: data.user.created_at || new Date().toISOString(),
              lastLogin: new Date().toISOString(),
              preferences: data.user.user_metadata?.preferences || {}
            };

            set({ user: userData, isAuthenticated: true, isLoading: false, profileStatus: statusFromProfile, assignments });
          }
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      signup: async (name: string, email: string, password: string) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/pending-approval`,
              data: {
                name,
                role: 'user',
                department: 'General'
              }
            }
          });

          if (error) throw error;

          set({ isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await supabase.auth.signOut();
          set({ user: null, isAuthenticated: false, profileStatus: null, assignments: [] });
        } catch (error) {
          console.error('Error logging out:', error);
          set({ user: null, isAuthenticated: false });
        }
      },

      updateProfile: async (updates: Partial<User>) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.updateUser({
            data: updates
          });

          if (error) throw error;

          set(state => ({ 
            user: state.user ? { ...state.user, ...updates } : null,
            isLoading: false 
          }));
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      changePassword: async (currentPassword: string, newPassword: string) => {
        set({ isLoading: true });
        try {
          const { error } = await supabase.auth.updateUser({
            password: newPassword
          });

          if (error) throw error;
          set({ isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        profileStatus: state.profileStatus,
        assignments: state.assignments
      })
    }
  )
);