import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuditStore } from './auditStore';
import { useNotificationStore } from './notificationStore';
import { addDays, format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';

// Storage bucket name for attachments, configurable via env
const ATTACHMENTS_BUCKET = (import.meta as any).env?.VITE_SUPABASE_ATTACHMENTS_BUCKET || 'attachments';

export interface License {
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
  user_name: string;
  remark: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'expired' | 'suspended' | 'pending' | 'in_progress';
  created_at: string;
  updated_at: string;
  created_by: string;
  last_modified_by: string;
}

// New child record interfaces to support multi-entry form
export interface LicenseSerial {
  id?: string;
  license_id?: string;
  serial_or_contract: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  qty: number;
  unit_price: number;
  currency: 'MMK' | 'USD';
  po_no?: string | null;
}

export interface LicenseCustomer {
  id?: string;
  license_id?: string;
  company_name: string;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_number?: string | null;
  address?: string | null;
}

export interface LicenseDistributor {
  id?: string;
  license_id?: string;
  company_name: string;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_number?: string | null;
}

export interface LicenseComment {
  id: string;
  license_id: string;
  content: string;
  author_id: string;
  author_name: string;
  created_at: string;
  is_edited: boolean;
  edited_at: string | null;
  mentions: string[];
}

export interface LicenseAttachment {
  id: string;
  license_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  uploaded_by: string;
  uploaded_at: string;
  description: string | null;
}

export interface RenewalRecord {
  id: string;
  license_id: string;
  renewal_date: string;
  previous_end_date: string;
  new_end_date: string;
  cost: number;
  renewed_by: string;
  notes: string | null;
  created_at: string;
}

export interface LicenseFilters {
  vendor?: string;
  user_name?: string;
  project_name?: string;
  company?: string;
  serial_number?: string;
  status?: string[];
  priority?: string[];
  date_range?: {
    start: string;
    end: string;
  };
  search?: string;
}

interface LicenseState {
  licenses: License[];
  selectedLicense: License | null;
  isLoading: boolean;
  filters: LicenseFilters;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  currentPage: number;
  pageSize: number;
  totalCount: number;
  
  // Actions
  fetchLicenses: (page?: number) => Promise<void>;
  fetchLicenseById: (id: string) => Promise<License | null>;
  addLicense: (license: Omit<License, 'id' | 'created_at' | 'updated_at'>) => Promise<License>;
  updateLicense: (id: string, updates: Partial<License>) => Promise<License>;
  deleteLicense: (id: string) => Promise<void>;
  setFilters: (filters: LicenseFilters) => void;
  setSorting: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  setSelectedLicense: (license: License | null) => void;
  
  // Comments
  addComment: (licenseId: string, content: string, authorId: string, authorName: string) => Promise<LicenseComment>;
  updateComment: (commentId: string, content: string) => Promise<LicenseComment>;
  deleteComment: (commentId: string) => Promise<void>;
  fetchComments: (licenseId: string) => Promise<LicenseComment[]>;
  
  // Attachments
  addAttachment: (licenseId: string, file: File, description?: string) => Promise<LicenseAttachment>;
  deleteAttachment: (attachmentId: string) => Promise<void>;
  fetchAttachments: (licenseId: string) => Promise<LicenseAttachment[]>;
  downloadAttachment: (attachment: LicenseAttachment) => Promise<void>;
  
  // Renewals
  renewLicense: (id: string, newEndDate: string, cost: number, notes?: string) => Promise<RenewalRecord>;
  fetchRenewalHistory: (licenseId: string) => Promise<RenewalRecord[]>;
  
  // Bulk Operations
  bulkUpdateLicenses: (licenseIds: string[], updates: Partial<License>) => Promise<void>;
  bulkDeleteLicenses: (licenseIds: string[]) => Promise<void>;
  duplicateLicense: (id: string) => Promise<License>;
  
  // Analytics - Now synchronous selectors
  getVendorStats: () => Array<{ vendor: string; count: number; totalCost: number }>;
  getProjectStats: () => Array<{ project: string; count: number; totalCost: number }>;
  getLicensesNearExpiry: (days: number) => License[];
  // Global metrics (queried directly from DB, ignoring current pagination/filters)
  getNearExpiryCount: (days: number) => Promise<number>;
  getExpiredLicenses: () => License[];
  getCostTrends: () => Array<{ month: string; cost: number }>;
  getExpiryTrends: () => Array<{ month: string; count: number }>;
  
  // Export/Import
  exportLicenses: (exportFormat: 'csv' | 'xlsx' | 'pdf', filters?: LicenseFilters) => Promise<void>;
  importLicenses: (file: File) => Promise<{ success: number; errors: string[] }>;
  
  // Search and Filtering
  searchLicenses: (query: string) => Promise<License[]>;
  getFilteredLicenses: () => License[];
  clearFilters: () => void;
  
  // Helper
  getCurrentUser: () => Promise<{ id: string; name: string; email: string } | null>;
  validateLicense: (license: Partial<License> & { serials?: LicenseSerial[] }) => { isValid: boolean; errors: string[] };
}

export const useLicenseStore = create<LicenseState>((set, get) => ({
  licenses: [],
  selectedLicense: null,
  isLoading: false,
  filters: {},
  sortBy: 'license_end_date',
  sortOrder: 'asc',
  currentPage: 1,
  pageSize: 20,
  totalCount: 0,

  getCurrentUser: async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        return {
          id: user.id,
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          email: user.email || ''
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },

  validateLicense: (license) => {
    const errors: string[] = [];

    // New minimal required fields
    if (!license.vendor?.trim()) errors.push('Vendor is required');
    if (!license.project_name?.trim()) errors.push('Project name is required');
    if (!license.status) errors.push('Status is required');

    // Validate serials (multi)
    const serials: LicenseSerial[] = license.serials || [];
    if (serials.length === 0) {
      errors.push('At least one Serial/Contract entry is required');
    } else {
      serials.forEach((s, idx) => {
        if (!s.serial_or_contract?.trim()) errors.push(`Serial row ${idx + 1}: Serial/Contract No. is required`);
        if (!s.start_date) errors.push(`Serial row ${idx + 1}: Start Date is required`);
        if (!s.end_date) errors.push(`Serial row ${idx + 1}: End Date is required`);
        if (s.start_date && s.end_date && new Date(s.start_date) >= new Date(s.end_date)) {
          errors.push(`Serial row ${idx + 1}: End Date must be after Start Date`);
        }
        if (s.qty === undefined || s.qty < 1) errors.push(`Serial row ${idx + 1}: Qty must be at least 1`);
        if (s.unit_price === undefined || s.unit_price < 0) errors.push(`Serial row ${idx + 1}: Unit Price must be >= 0`);
        if (s.currency !== 'MMK' && s.currency !== 'USD') errors.push(`Serial row ${idx + 1}: Currency must be MMK or USD`);
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  fetchLicenses: async (page = 1) => {
    set({ isLoading: true });
    
    try {
      const { filters, sortBy, sortOrder, pageSize } = get();
      const offset = (page - 1) * pageSize;
      
      let query = supabase
        .from('licenses')
        .select('*', { count: 'exact' })
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + pageSize - 1);

      // Apply filters
      if (filters.vendor) {
        query = query.ilike('vendor', `%${filters.vendor}%`);
      }
      
      if (filters.user_name) {
        query = query.ilike('user_name', `%${filters.user_name}%`);
      }
      
      if (filters.project_name) {
        query = query.ilike('project_name', `%${filters.project_name}%`);
      }
      
      if (filters.company) {
        query = query.ilike('company', `%${filters.company}%`);
      }
      
      if (filters.serial_number) {
        query = query.ilike('serial_number', `%${filters.serial_number}%`);
      }
      
      if (filters.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }
      
      if (filters.priority && filters.priority.length > 0) {
        query = query.in('priority', filters.priority);
      }
      
      
      if (filters.search) {
        query = query.or(`item.ilike.%${filters.search}%,vendor.ilike.%${filters.search}%,project_name.ilike.%${filters.search}%,serial_number.ilike.%${filters.search}%`);
      }
      
      if (filters.date_range) {
        query = query
          .gte('license_end_date', filters.date_range.start)
          .lte('license_end_date', filters.date_range.end);
      }
      
      // cost_range removed

      

      const { data, error, count } = await query;

      if (error) throw error;

      set({
        licenses: data || [],
        totalCount: count || 0,
        currentPage: page,
        isLoading: false
      });

      // Log the view action
      try {
        const auditStore = useAuditStore.getState();
        await auditStore.logAction({
          action: 'view',
          entity_type: 'license',
          entity_id: 'list',
          changes: { filters, page, count: data?.length || 0 },
          ip_address: null,
          user_agent: null
        });
      } catch (auditError) {
        console.log('Audit logging failed:', auditError);
      }
    } catch (error) {
      console.error('Error fetching licenses:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  fetchLicenseById: async (id) => {
    try {
      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Log the view action
      try {
        const auditStore = useAuditStore.getState();
        await auditStore.logAction({
          action: 'view',
          entity_type: 'license',
          entity_id: id,
          changes: null,
          ip_address: null,
          user_agent: null
        });
      } catch (auditError) {
        console.log('Audit logging failed:', auditError);
      }

      return data;
    } catch (error) {
      console.error('Error fetching license:', error);
      throw error;
    }
  },

  

  addLicense: async (licenseData) => {


    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      // Extract child arrays if provided by UI (and strip them out of core insert)
      const {
        serials: serialsRaw = [],
        customers: customersRaw = [],
        distributors: distributorsRaw = [],
        attachments: attachmentsRaw = [],
        ...licenseCore
      } = (licenseData as any);
      const serials: LicenseSerial[] = serialsRaw as LicenseSerial[];
      const customers: LicenseCustomer[] = customersRaw as LicenseCustomer[];
      const distributors: LicenseDistributor[] = distributorsRaw as LicenseDistributor[];

      // Validate license data according to new rules
      const validation = get().validateLicense({ ...(licenseData as any), serials });
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Derive required top-level fields to satisfy schema (NOT NULL columns)
      const firstSerial = serials[0];

      // Whitelist columns that exist on licenses
      const allowedKeys = new Set([
        'vendor',
        'project_name',
        'item_description',
        'remark',
        'priority',
        'status',
        'license_start_date',
        'license_end_date',
        'serial_number'
      ]);
      const coreInsert: any = {};
      Object.keys(licenseCore || {}).forEach((k) => {
        if (allowedKeys.has(k)) coreInsert[k] = (licenseCore as any)[k];
      });

      const insertPayload: any = {
        ...coreInsert,
        // satisfy existing schema with derived data
        serial_number: coreInsert.serial_number || firstSerial?.serial_or_contract || 'N/A',
        license_start_date: coreInsert.license_start_date || firstSerial?.start_date || new Date().toISOString().slice(0,10),
        license_end_date: coreInsert.license_end_date || firstSerial?.end_date || new Date().toISOString().slice(0,10),
        user_id: currentUser.id,
        created_by: currentUser.id,
        last_modified_by: currentUser.id
      };

      const { data, error } = await supabase
        .from('licenses')
        .insert([insertPayload])
        .select()
        .single();

      if (error) throw error;

      // Insert child rows if provided
      if (serials.length > 0) {
        const serialRows = serials.map(s => ({
          license_id: data.id,
          serial_or_contract: s.serial_or_contract,
          start_date: s.start_date,
          end_date: s.end_date,
          qty: s.qty,
          unit_price: s.unit_price,
          currency: s.currency,
          po_no: s.po_no || null
        }));
        const { error: serialErr } = await supabase.from('license_serials').insert(serialRows);
        if (serialErr) throw serialErr;
      }

      if (customers.length > 0) {
        const customerRows = customers.map(c => ({
          license_id: data.id,
          company_name: c.company_name,
          contact_person: c.contact_person || null,
          contact_email: c.contact_email || null,
          contact_number: c.contact_number || null,
          address: c.address || null
        }));
        const { error: custErr } = await supabase.from('license_customers').insert(customerRows);
        if (custErr) throw custErr;
      }

      if (distributors.length > 0) {
        const distributorRows = distributors.map(d => ({
          license_id: data.id,
          company_name: d.company_name,
          contact_person: d.contact_person || null,
          contact_email: d.contact_email || null,
          contact_number: d.contact_number || null
        }));
        const { error: distErr } = await supabase.from('license_distributors').insert(distributorRows);
        if (distErr) throw distErr;
      }

      // Refresh the licenses list
      await get().fetchLicenses(get().currentPage);

      // Log the action
      try {
        const auditStore = useAuditStore.getState();
        await auditStore.logAction({
          action: 'create',
          entity_type: 'license',
          entity_id: data.id,
          changes: licenseData,
          ip_address: null,
          user_agent: null
        });
      } catch (auditError) {
        console.log('Audit logging failed:', auditError);
      }

      // Create notification
      try {
        const notificationStore = useNotificationStore.getState();
        await notificationStore.createNotification({
          type: 'system',
          title: 'New License Added',
          message: `License for ${licenseData.item} has been added successfully`,
          license_id: data.id,
          user_id: currentUser.id,
          is_read: false,
          priority: 'low',
          action_required: false,
          action_url: `/licenses/${data.id}`,
          expires_at: null
        });
      } catch (notificationError) {
        console.log('Notification creation failed:', notificationError);
      }

      return data;
    } catch (error) {
      console.error('Error adding license:', error);
      throw error;
    }
  },

  updateLicense: async (id, updates) => {
    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      // Get the current license for comparison
      const { data: currentLicense } = await supabase
        .from('licenses')
        .select('*')
        .eq('id', id)
        .single();

      // Whitelist only columns that exist on licenses table
      const allowedUpdateKeys = new Set([
        'vendor',
        'project_name',
        'item_description',
        'remark',
        'priority',
        'status',
        'license_start_date',
        'license_end_date',
        'serial_number'
      ]);
      const sanitized: any = {};
      Object.keys(updates || {}).forEach((k) => {
        if (allowedUpdateKeys.has(k)) sanitized[k] = (updates as any)[k];
      });

      const { data, error } = await supabase
        .from('licenses')
        .update({
          ...sanitized,
          last_modified_by: currentUser.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();


        console.log("Current user ID:", currentUser.id);

      if (error) throw error;

      // Refresh the licenses list
      await get().fetchLicenses(get().currentPage);

      // Log the action with changes
      try {
        const auditStore = useAuditStore.getState();
        const changes: Record<string, { old: any; new: any }> = {};
        
        if (currentLicense) {
          Object.keys(updates).forEach(key => {
            if (currentLicense[key] !== updates[key as keyof typeof updates]) {
              changes[key] = {
                old: currentLicense[key],
                new: updates[key as keyof typeof updates]
              };
            }
          });
        }

        await auditStore.logAction({
          action: 'update',
          entity_type: 'license',
          entity_id: id,
          changes,
          ip_address: null,
          user_agent: null
        });
      } catch (auditError) {
        console.log('Audit logging failed:', auditError);
      }

      return data;
    } catch (error) {
      console.error('Error updating license:', error);
      throw error;
    }
  },

  deleteLicense: async (id) => {
    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      const { error } = await supabase
        .from('licenses')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Refresh the licenses list
      await get().fetchLicenses(get().currentPage);

      // Log the action
      try {
        const auditStore = useAuditStore.getState();
        await auditStore.logAction({
          action: 'delete',
          entity_type: 'license',
          entity_id: id,
          changes: null,
          ip_address: null,
          user_agent: null
        });
      } catch (auditError) {
        console.log('Audit logging failed:', auditError);
      }
    } catch (error) {
      console.error('Error deleting license:', error);
      throw error;
    }
  },

  setFilters: (filters) => {
    set({ filters: { ...get().filters, ...filters } });
    get().fetchLicenses(1);
  },

  clearFilters: () => {
    set({ filters: {} });
    get().fetchLicenses(1);
  },

  setSorting: (sortBy, sortOrder) => {
    set({ sortBy, sortOrder });
    get().fetchLicenses(get().currentPage);
  },

  setSelectedLicense: (license) => {
    set({ selectedLicense: license });
  },

  // Comments
  addComment: async (licenseId, content, authorId, authorName) => {
    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      const { data, error } = await supabase
        .from('license_comments')
        .insert([{
          license_id: licenseId,
          content,
          author_id: currentUser.id,
          author_name: currentUser.name,
          is_edited: false,
          mentions: []
        }])
        .select()
        .single();

      if (error) throw error;

      // Create notification for comment
      try {
        const notificationStore = useNotificationStore.getState();
        await notificationStore.createNotification({
          type: 'comment',
          title: 'New Comment Added',
          message: `${currentUser.name} added a comment on license`,
          license_id: licenseId,
          user_id: currentUser.id,
          is_read: false,
          priority: 'low',
          action_required: false,
          action_url: `/licenses/${licenseId}`,
          expires_at: null
        });
      } catch (notificationError) {
        console.log('Notification creation failed:', notificationError);
      }

      return data;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  },

  updateComment: async (commentId, content) => {
    try {
      const { data, error } = await supabase
        .from('license_comments')
        .update({
          content,
          is_edited: true,
          edited_at: new Date().toISOString()
        })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating comment:', error);
      throw error;
    }
  },

  deleteComment: async (commentId) => {
    try {
      const { error } = await supabase
        .from('license_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  },

  fetchComments: async (licenseId) => {
    try {
      const { data, error } = await supabase
        .from('license_comments')
        .select('*')
        .eq('license_id', licenseId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching comments:', error);
      return [];
    }
  },

  // Attachments
  addAttachment: async (licenseId, file, description) => {
    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `license-attachments/${licenseId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .getPublicUrl(filePath);

      // Save attachment record
      const { data, error } = await supabase
        .from('license_attachments')
        .insert([{
          license_id: licenseId,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          file_url: publicUrl,
          uploaded_by: currentUser.id,
          description
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding attachment:', error);
      throw error;
    }
  },

  deleteAttachment: async (attachmentId) => {
    try {
      // Get attachment info first
      const { data: attachment } = await supabase
        .from('license_attachments')
        .select('file_url')
        .eq('id', attachmentId)
        .single();

      if (attachment) {
        // Extract file path from URL and delete from storage
        const filePath = attachment.file_url.split('/').slice(-3).join('/');
        await supabase.storage
          .from(ATTACHMENTS_BUCKET)
          .remove([filePath]);
      }

      // Delete attachment record
      const { error } = await supabase
        .from('license_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting attachment:', error);
      throw error;
    }
  },

  fetchAttachments: async (licenseId) => {
    try {
      const { data, error } = await supabase
        .from('license_attachments')
        .select('*')
        .eq('license_id', licenseId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching attachments:', error);
      return [];
    }
  },

  downloadAttachment: async (attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .download(attachment.file_url.split('/').slice(-3).join('/'));

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading attachment:', error);
      throw error;
    }
  },

  // Renewals
  renewLicense: async (id, newEndDate, cost, notes) => {
    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      // Get current license
      const { data: license } = await supabase
        .from('licenses')
        .select('*')
        .eq('id', id)
        .single();

      if (!license) throw new Error('License not found');

      // Add renewal record
      const { data: renewalData, error: renewalError } = await supabase
        .from('renewal_history')
        .insert([{
          license_id: id,
          renewal_date: new Date().toISOString(),
          previous_end_date: license.license_end_date,
          new_end_date: newEndDate,
          cost,
          renewed_by: currentUser.id,
          notes
        }])
        .select()
        .single();

      if (renewalError) throw renewalError;

      // Update license
      await get().updateLicense(id, {
        license_end_date: newEndDate,
        status: 'active'
      });

      // Create notification
      try {
        const notificationStore = useNotificationStore.getState();
        await notificationStore.createNotification({
          type: 'renewal',
          title: 'License Renewed',
          message: `${license.item} license has been renewed until ${format(new Date(newEndDate), 'MMM dd, yyyy')}`,
          license_id: id,
          user_id: currentUser.id,
          is_read: false,
          priority: 'medium',
          action_required: false,
          action_url: `/licenses/${id}`,
          expires_at: null
        });
      } catch (notificationError) {
        console.log('Notification creation failed:', notificationError);
      }

      return renewalData;
    } catch (error) {
      console.error('Error renewing license:', error);
      throw error;
    }
  },

  fetchRenewalHistory: async (licenseId) => {
    try {
      const { data, error } = await supabase
        .from('renewal_history')
        .select('*')
        .eq('license_id', licenseId)
        .order('renewal_date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching renewal history:', error);
      return [];
    }
  },

  // Bulk Operations
  bulkUpdateLicenses: async (licenseIds, updates) => {
    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      const { error } = await supabase
        .from('licenses')
        .update({
          ...updates,
          last_modified_by: currentUser.id,
          updated_at: new Date().toISOString()
        })
        .in('id', licenseIds);

      if (error) throw error;

      // Refresh the licenses list
      await get().fetchLicenses(get().currentPage);

      // Log the bulk action
      try {
        const auditStore = useAuditStore.getState();
        await auditStore.logAction({
          action: 'update',
          entity_type: 'license',
          entity_id: 'bulk',
          changes: { licenseIds, updates, count: licenseIds.length },
          ip_address: null,
          user_agent: null
        });
      } catch (auditError) {
        console.log('Audit logging failed:', auditError);
      }
    } catch (error) {
      console.error('Error bulk updating licenses:', error);
      throw error;
    }
  },

  bulkDeleteLicenses: async (licenseIds) => {
    try {
      const { error } = await supabase
        .from('licenses')
        .delete()
        .in('id', licenseIds);

      if (error) throw error;

      // Refresh the licenses list
      await get().fetchLicenses(get().currentPage);

      // Log the bulk action
      try {
        const auditStore = useAuditStore.getState();
        await auditStore.logAction({
          action: 'delete',
          entity_type: 'license',
          entity_id: 'bulk',
          changes: { licenseIds, count: licenseIds.length },
          ip_address: null,
          user_agent: null
        });
      } catch (auditError) {
        console.log('Audit logging failed:', auditError);
      }
    } catch (error) {
      console.error('Error bulk deleting licenses:', error);
      throw error;
    }
  },

  duplicateLicense: async (id) => {
    try {
      const original = await get().fetchLicenseById(id);
      if (!original) throw new Error('License not found');

      const duplicateData = {
        ...original,
        serial_number: `${original.serial_number}-COPY-${Date.now()}`,
        item: `${original.item} (Copy)`,
        status: 'pending' as const
      };

      // Remove fields that shouldn't be copied
      delete (duplicateData as any).id;
      delete (duplicateData as any).created_at;
      delete (duplicateData as any).updated_at;

      return await get().addLicense(duplicateData);
    } catch (error) {
      console.error('Error duplicating license:', error);
      throw error;
    }
  },

  // Search
  searchLicenses: async (query) => {
    try {
      const { data, error } = await supabase
        .from('licenses')
        .select('*')
        .or(`item.ilike.%${query}%,vendor.ilike.%${query}%,project_name.ilike.%${query}%,serial_number.ilike.%${query}%,customer_name.ilike.%${query}%`)
        .limit(50);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching licenses:', error);
      return [];
    }
  },

  getFilteredLicenses: () => {
    return get().licenses;
  },

  // Synchronous analytics functions that work with the licenses array
  getVendorStats: () => {
    const { licenses } = get();
    const activeLicenses = licenses.filter(license => license.status === 'active');
    
    const vendorMap = new Map();
    activeLicenses.forEach(license => {
      const existing = vendorMap.get(license.vendor) || { count: 0, totalCost: 0 };
      vendorMap.set(license.vendor, {
        vendor: license.vendor,
        count: existing.count + 1,
        totalCost: existing.totalCost + 0
      });
    });

    return Array.from(vendorMap.values()).sort((a, b) => b.totalCost - a.totalCost);
  },

  getProjectStats: () => {
    const { licenses } = get();
    const activeLicenses = licenses.filter(license => license.status === 'active');
    
    const projectMap = new Map();
    activeLicenses.forEach(license => {
      const existing = projectMap.get(license.project_name) || { count: 0, totalCost: 0 };
      projectMap.set(license.project_name, {
        project: license.project_name,
        count: existing.count + 1,
        totalCost: existing.totalCost + 0
      });
    });

    return Array.from(projectMap.values()).sort((a, b) => b.totalCost - a.totalCost);
  },

  getLicensesNearExpiry: (days) => {
    const { licenses } = get();
    const futureDate = addDays(new Date(), days);
    const today = new Date();
    
    return licenses.filter(license => {
      if (license.status !== 'active') return false;
      
      const endDate = new Date(license.license_end_date);
      return endDate >= today && endDate <= futureDate;
    });
  },

  // Direct DB count to avoid pagination/filtering side-effects on dashboard
  getNearExpiryCount: async (days) => {
    try {
      const start = new Date();
      const end = addDays(start, days);
      // Use local-date strings to prevent UTC offset issues
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      const { count, error } = await supabase
        .from('licenses')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .gte('license_start_date', startStr)
        .lte('license_end_date', endStr);

      if (error) throw error;
      return count || 0;
    } catch (e) {
      console.error('Error counting near-expiry licenses:', e);
      return 0;
    }
  },

  getExpiredLicenses: () => {
    const { licenses } = get();
    const today = new Date();
    
    return licenses.filter(license => {
      const endDate = new Date(license.license_end_date);
      return endDate < today;
    });
  },

  getCostTrends: () => {
    const { licenses } = get();
    const now = new Date();
    const twelveMonthsAgo = subMonths(now, 12);
    
    // Generate array of months for the last 12 months
    const months = eachMonthOfInterval({
      start: twelveMonthsAgo,
      end: now
    });
    
    // Initialize cost data for each month
    const costTrends = months.map(month => ({
      month: format(month, 'MMM yyyy'),
      cost: 0
    }));
    
    // Calculate costs by grouping licenses by their start date month
    licenses.forEach(license => {
      const startDate = new Date(license.license_start_date);
      if (startDate >= twelveMonthsAgo && startDate <= now) {
        const monthIndex = months.findIndex(month => 
          startDate >= startOfMonth(month) && startDate <= endOfMonth(month)
        );
        if (monthIndex !== -1) {
          costTrends[monthIndex].cost += 0;
        }
      }
    });
    
    return costTrends;
  },

  getExpiryTrends: () => {
    const { licenses } = get();
    const now = new Date();
    const twelveMonthsAgo = subMonths(now, 12);
    
    // Generate array of months for the last 12 months
    const months = eachMonthOfInterval({
      start: twelveMonthsAgo,
      end: now
    });
    
    // Initialize expiry data for each month
    const expiryTrends = months.map(month => ({
      month: format(month, 'MMM yyyy'),
      count: 0
    }));
    
    // Calculate expiries by grouping licenses by their end date month
    licenses.forEach(license => {
      const endDate = new Date(license.license_end_date);
      if (endDate >= twelveMonthsAgo && endDate <= now) {
        const monthIndex = months.findIndex(month => 
          endDate >= startOfMonth(month) && endDate <= endOfMonth(month)
        );
        if (monthIndex !== -1) {
          expiryTrends[monthIndex].count += 1;
        }
      }
    });
    
    return expiryTrends;
  },

  // Export/Import
  exportLicenses: async (exportFormat, filters) => {
    try {
      let query = supabase.from('licenses').select('*');
      
      // Apply filters if provided
      if (filters) {
        if (filters.vendor) query = query.ilike('vendor', `%${filters.vendor}%`);
        if (filters.status) query = query.in('status', filters.status);
        if (filters.search) {
          query = query.or(`item.ilike.%${filters.search}%,vendor.ilike.%${filters.search}%,project_name.ilike.%${filters.search}%`);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      if (exportFormat === 'csv') {
        const csvContent = [
          'Company,Vendor,Item,Description,Serial Number,Project,Customer,Business Unit,Start Date,End Date,Cost,Quantity,Auto Renew,User,Status,Priority',
          ...(data || []).map(license => 
            `"${license.company}","${license.vendor}","${license.item}","${license.item_description}","${license.serial_number}","${license.project_name}","${license.customer_name}","${license.business_unit}","${license.license_start_date}","${license.license_end_date}","${license.license_cost}","${license.quantity}","${license.auto_renew}","${license.user_name}","${license.status}","${license.priority}"`
          )
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `licenses-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }

      // Log the export action
      try {
        const auditStore = useAuditStore.getState();
        await auditStore.logAction({
          action: 'export',
          entity_type: 'license',
          entity_id: 'bulk',
          changes: { format: exportFormat, count: data?.length || 0, filters },
          ip_address: null,
          user_agent: null
        });
      } catch (auditError) {
        console.log('Audit logging failed:', auditError);
      }
    } catch (error) {
      console.error('Error exporting licenses:', error);
      throw error;
    }
  },

  importLicenses: async (file) => {
    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      
      const results = { success: 0, errors: [] as string[] };
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        try {
          const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
          const licenseData: any = {};
          
          headers.forEach((header, index) => {
            const value = values[index];
            switch (header.toLowerCase()) {
              case 'company':
                licenseData.company = value;
                break;
              case 'vendor':
                licenseData.vendor = value;
                break;
              case 'item':
                licenseData.item = value;
                break;
              case 'description':
                licenseData.item_description = value;
                break;
              case 'serial number':
                licenseData.serial_number = value;
                break;
              case 'project':
                licenseData.project_name = value;
                break;
              case 'customer':
                licenseData.customer_name = value;
                break;
              case 'business unit':
                licenseData.business_unit = value;
                break;
              case 'start date':
                licenseData.license_start_date = value;
                break;
              case 'end date':
                licenseData.license_end_date = value;
                break;
              case 'cost':
                licenseData.license_cost = parseFloat(value) || 0;
                break;
              case 'quantity':
                licenseData.quantity = parseInt(value) || 1;
                break;
              case 'auto renew':
                licenseData.auto_renew = value.toLowerCase() === 'true';
                break;
              case 'user':
                licenseData.user_name = value;
                break;
              case 'status':
                licenseData.status = value.toLowerCase();
                break;
              case 'priority':
                licenseData.priority = value.toLowerCase();
                break;
            }
          });

          // Set defaults
          licenseData.custom_fields = {};
          licenseData.tags = [];
          licenseData.created_by = currentUser.id;
          licenseData.last_modified_by = currentUser.id;

          await get().addLicense(licenseData);
          results.success++;
        } catch (error) {
          results.errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return results;
    } catch (error) {
      console.error('Error importing licenses:', error);
      throw error;
    }
  }
}));