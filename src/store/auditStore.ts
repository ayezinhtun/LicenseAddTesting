import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from 'date-fns';

export interface AuditLog {
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
}

export interface AuditFilters {
  action?: string[];
  entity_type?: string[];
  user_id?: string;
  date_range?: {
    start: string;
    end: string;
  };
  search?: string;
  time_period?: 'recent' | 'week' | 'month' | 'year' | 'custom';
}

interface AuditState {
  logs: AuditLog[];
  isLoading: boolean;
  filters: AuditFilters;
  totalCount: number;
  currentPage: number;
  pageSize: number;
  
  // Actions
  fetchAuditLogs: (page?: number) => Promise<void>;
  setFilters: (filters: AuditFilters) => void;
  clearFilters: () => void;
  logAction: (action: Omit<AuditLog, 'id' | 'created_at' | 'user_id' | 'user_name'>) => Promise<void>;
  exportAuditLogs: (format: 'csv' | 'pdf') => Promise<void>;
  getFilteredLogs: () => AuditLog[];
  setTimeFilter: (period: 'recent' | 'week' | 'month' | 'year') => void;
  getCurrentUser: () => Promise<{ id: string; name: string } | null>;
  
  // Analytics
  getActionStats: () => Record<string, number>;
  getEntityStats: () => Record<string, number>;
  getUserStats: () => Array<{ user: string; count: number }>;
  getActivityTrends: () => Array<{ date: string; count: number }>;
  
  // Search and filtering
  searchLogs: (query: string) => Promise<AuditLog[]>;
  getLogsByUser: (userId: string) => Promise<AuditLog[]>;
  getLogsByEntity: (entityType: string, entityId: string) => Promise<AuditLog[]>;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  logs: [],
  isLoading: false,
  filters: { time_period: 'recent' },
  totalCount: 0,
  currentPage: 1,
  pageSize: 50,

  getCurrentUser: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        return {
          id: user.id,
          name: user.user_metadata?.name || user.email || 'Unknown User'
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },

  fetchAuditLogs: async (page = 1) => {
    set({ isLoading: true });
    
    try {
      const { filters, pageSize } = get();
      const offset = (page - 1) * pageSize;
      
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      // Apply filters
      if (filters.action && filters.action.length > 0) {
        query = query.in('action', filters.action);
      }
      
      if (filters.entity_type && filters.entity_type.length > 0) {
        query = query.in('entity_type', filters.entity_type);
      }
      
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      
      if (filters.search) {
        query = query.or(`user_name.ilike.%${filters.search}%,entity_id.ilike.%${filters.search}%`);
      }
      
      // Apply date range based on time period
      if (filters.time_period && filters.time_period !== 'custom') {
        const now = new Date();
        let startDate: Date;
        
        switch (filters.time_period) {
          case 'recent':
            startDate = subDays(now, 7);
            break;
          case 'week':
            startDate = subDays(now, 7);
            break;
          case 'month':
            startDate = subMonths(now, 1);
            break;
          case 'year':
            startDate = subYears(now, 1);
            break;
          default:
            startDate = subDays(now, 7);
        }
        
        query = query.gte('created_at', startDate.toISOString());
      } else if (filters.date_range) {
        query = query
          .gte('created_at', startOfDay(new Date(filters.date_range.start)).toISOString())
          .lte('created_at', endOfDay(new Date(filters.date_range.end)).toISOString());
      }

      const { data, error, count } = await query;

      if (error) throw error;

      set({
        logs: data || [],
        totalCount: count || 0,
        currentPage: page,
        isLoading: false
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  setFilters: (filters) => {
    set({ filters: { ...get().filters, ...filters } });
    get().fetchAuditLogs(1);
  },

  clearFilters: () => {
    set({ filters: { time_period: 'recent' } });
    get().fetchAuditLogs(1);
  },

  setTimeFilter: (period) => {
    set({ filters: { ...get().filters, time_period: period } });
    get().fetchAuditLogs(1);
  },

  logAction: async (actionData) => {
    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) {
        console.log('No authenticated user found, skipping audit log');
        return;
      }

      const { data, error } = await supabase
        .from('audit_logs')
        .insert([{
          ...actionData,
          user_id: currentUser.id,
          user_name: currentUser.name,
          ip_address: await get().getClientIP(),
          user_agent: navigator.userAgent
        }]);

      if (error) {
        console.error('Error inserting audit log:', error);
        return; // Don't throw to prevent breaking main functionality
      }

      // Refresh logs if we're on the first page
      if (get().currentPage === 1) {
        get().fetchAuditLogs(1);
      }
    } catch (error) {
      console.error('Error logging action:', error);
      // Don't throw the error to prevent breaking the main functionality
    }
  },

  getFilteredLogs: () => {
    return get().logs;
  },

  getActionStats: () => {
    const { logs } = get();
    const stats: Record<string, number> = {};
    
    logs.forEach(log => {
      stats[log.action] = (stats[log.action] || 0) + 1;
    });
    
    return stats;
  },

  getEntityStats: () => {
    const { logs } = get();
    const stats: Record<string, number> = {};
    
    logs.forEach(log => {
      stats[log.entity_type] = (stats[log.entity_type] || 0) + 1;
    });
    
    return stats;
  },

  getUserStats: () => {
    const { logs } = get();
    const userMap = new Map<string, number>();
    
    logs.forEach(log => {
      const count = userMap.get(log.user_name) || 0;
      userMap.set(log.user_name, count + 1);
    });
    
    return Array.from(userMap.entries())
      .map(([user, count]) => ({ user, count }))
      .sort((a, b) => b.count - a.count);
  },

  getActivityTrends: () => {
    const { logs } = get();
    const dateMap = new Map<string, number>();
    
    logs.forEach(log => {
      const date = format(new Date(log.created_at), 'yyyy-MM-dd');
      const count = dateMap.get(date) || 0;
      dateMap.set(date, count + 1);
    });
    
    return Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  searchLogs: async (query) => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .or(`user_name.ilike.%${query}%,entity_id.ilike.%${query}%,action.ilike.%${query}%`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching audit logs:', error);
      return [];
    }
  },

  getLogsByUser: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching logs by user:', error);
      return [];
    }
  },

  getLogsByEntity: async (entityType, entityId) => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching logs by entity:', error);
      return [];
    }
  },

  exportAuditLogs: async (format) => {
    try {
      const { logs } = get();
      
      if (format === 'csv') {
        const csvContent = [
          'Timestamp,Action,Entity Type,Entity ID,User,Changes,IP Address',
          ...logs.map(log => 
            `"${format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}","${log.action}","${log.entity_type}","${log.entity_id}","${log.user_name}","${JSON.stringify(log.changes || {})}","${log.ip_address || 'N/A'}"`
          )
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
      
      // Log the export action
      await get().logAction({
        action: 'export',
        entity_type: 'report',
        entity_id: 'audit-logs',
        changes: { format, count: logs.length },
        ip_address: null,
        user_agent: null
      });
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      throw error;
    }
  },

  // Helper function to get client IP (simplified)
  getClientIP: async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return null;
    }
  }
}));