import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuditStore } from './auditStore';
import { useAuthStore } from './authStore';
import { useNotificationStore } from './notificationStore';
import { addDays, format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO, subDays } from 'date-fns';

// Storage bucket name for attachments, configurable via env
const ATTACHMENTS_BUCKET = (import.meta as any).env?.VITE_SUPABASE_ATTACHMENTS_BUCKET || 'attachments';

export interface License {
  id: string;
  company: string;
  vendor: string;
  item: string;
  item_description: string;
  // serial_number: string;
  project_name: string;
  // project_assign?: 'NPT' | 'YGN' | 'MPT' | null;
  project_assign?: string | null;
  customer_name: string;
  business_unit: string;
  license_start_date: string;
  license_end_date: string;
  user_name: string;
  remark: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'expired' | 'suspended' | 'pending' | 'in_progress' | 'completed';
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
  notify_before_days?: number | null;
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
  previous_end_date: string;      // old final date
  cost: number;
  renewed_by: string;
  notes: string | null;
  created_at: string;

  // OLD snapshot only
  prev_product_name?: string | null;
  prev_remark?: string | null;
  prev_serial_no?: string | null;
  prev_serial_start_date?: string | null;
  prev_serial_end_date?: string | null;
  prev_selected_serial_id?: string | null;
}

export interface LicenseFilters {
  vendor?: string;
  user_name?: string;
  project_name?: string;
  // project_assign?: 'NPT' | 'YGN' | 'MPT' | '';
  project_assign?: string | '';
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
  vendors: string[];
  currentRequestId: number;

  // Actions
  fetchLicenses: (page?: number) => Promise<void>;
  fetchLicenseById: (id: string) => Promise<License | null>;
  addLicense: (license: Omit<License, 'id' | 'created_at' | 'updated_at'>) => Promise<License>;
  updateLicense: (id: string, updates: Partial<License>) => Promise<License>;
  deleteLicense: (id: string) => Promise<void>;
  setFilters: (filters: LicenseFilters) => void;
  setSorting: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  setSelectedLicense: (license: License | null) => void;
  getAllVendors: () => Promise<string[]>;   // add
  loadVendors: () => Promise<void>;
  checkSerialExpiryNotifications: () => Promise<void>;

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
  renewLicense: (
    id: string,
    payload: {
      selectedSerialId: string;
      productName: string;
      serialNo: string;
      serialStartDate: string;
      newEndDate: string;
      cost: number;
      notes?: string;
      remark?: string;
    }
  ) => Promise<RenewalRecord>;
  fetchRenewalHistory: (licenseId: string) => Promise<RenewalRecord[]>;

  // Bulk Operations
  bulkUpdateLicenses: (licenseIds: string[], updates: Partial<License>) => Promise<void>;
  bulkDeleteLicenses: (licenseIds: string[]) => Promise<void>;
  duplicateLicense: (id: string) => Promise<License>;

  fetchRecentlyDeleted: () => Promise<License[]>;
  recoverLicense: (id: string) => Promise<void>;
  permanentlyDeleteLicense: (id: string) => Promise<void>;
  purgeOldDeletedLicenses: () => Promise<number>;

  // Analytics - Now synchronous selectors
  getVendorStats: () => Array<{ vendor: string; count: number; totalCost: number }>;
  getProjectStats: () => Array<{ project: string; count: number; totalCost: number }>;
  getLicensesNearExpiry: (days: number) => License[];

  // Serial-based expiry helpers
  getSerialsNearExpiry: (days: number) => Promise<Array<{ license: License; serial: LicenseSerial }>>;
  getNearSerialExpiryCount: (days: number) => Promise<number>;
  getExpiredSerialsCount: () => Promise<number>;

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

type SerialWithLicense = {
  id: string;
  license_id: string;
  serial_or_contract: string;
  end_date: string; // 'YYYY-MM-DD'
  notify_before_days: number | null;
  last_notified_on?: string | null;
  licenses: {
    id: string;
    item_description: string | null;
    project_name: string | null;
    vendor: string | null;
    status: string;
    created_by: string;
  };
};

export const useLicenseStore = create<LicenseState>((set, get) => ({
  licenses: [],

  selectedLicense: null,
  isLoading: false,
  filters: {},
  sortBy: 'created_at',
  sortOrder: 'asc',
  currentPage: 1,
  pageSize: 20,
  totalCount: 0,

  vendors: [],
  currentRequestId: 0,



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
    if (!license.project_name?.trim()) {
      errors.push('Project name is required');
    }

    if (!license.status) errors.push('Status is required');
    // const pa = (license as any).project_assign as string | undefined;
    // if (!pa || pa.trim() === '') {
    //   errors.push('Project assign is required');
    // } else {
    //   const allowedAssign = new Set(['NPT', 'YGN', 'MPT']);
    //   if (!allowedAssign.has(pa)) {
    //     errors.push('Project assign must be one of: NPT, YGN, MPT');
    //   }
    // }

    // Require project_assign (dynamic values are enforced by DB via FK/RLS)
    const pa = (license as any).project_assign as string | undefined;
    if (!pa || pa.trim() === '') {
      errors.push('Project assign is required');
    }

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
    const thisReq = Date.now();                       // add
    set({ isLoading: true, currentRequestId: thisReq });  // replacetrue });

    try {
      const { filters, sortBy, sortOrder, pageSize } = get();
      // Read role and assignments from auth store to enforce UI-level filtering aligned with RLS
      const { user, assignments } = useAuthStore.getState();
      const offset = (page - 1) * pageSize;

      let query = supabase
        .from('licenses')
        .select('*', { count: 'exact' });

      query = query.is('deleted_at', null);

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
      if (filters.project_assign) {
        // Explicit single project filter applied by UI
        query = query.eq('project_assign', filters.project_assign);
      } else {
        // If no explicit project filter, restrict by user's assignments for non-admin roles
        if (user && (user.role === 'super_user' || user.role === 'user')) {
          if (assignments && assignments.length > 0) {
            query = query.in('project_assign', assignments as any);
          } else {
            // If user has no assignments, return empty by filtering on impossible condition
            // This avoids showing unassigned/null rows to non-admins at the UI level
            query = query.in('project_assign', ['__no_assign__']);
          }
        }
      }

      if (filters.company) {
        query = query.ilike('company', `%${filters.company}%`);
      }


      if (filters.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters.priority && filters.priority.length > 0) {
        query = query.in('priority', filters.priority);
      }


      if (filters.search) {
        query = query.or(`item.ilike.%${filters.search}%,vendor.ilike.%${filters.search}%,project_name.ilike.%${filters.search}%`);
      }

      if (filters.date_range) {
        query = query
          .gte('license_end_date', filters.date_range.start)
          .lte('license_end_date', filters.date_range.end);
      }

      // cost_range removed

      // Serial filter (via child table) — supports both new filters.serial and legacy filters.serial_number
      const serialFilterRaw =
        (filters as any).serial ?? (filters as any).serial_number;

      if (serialFilterRaw && String(serialFilterRaw).trim()) {
        const serialQuery = String(serialFilterRaw).trim();

        const { data: serialMatches, error: smErr } = await supabase
          .from('license_serials')
          .select('license_id')
          .ilike('serial_or_contract', `%${serialQuery}%`);

        if (!smErr) {
          const licenseIds = Array.from(new Set((serialMatches || []).map(r => r.license_id)));
          if (licenseIds.length === 0) {
            // No matches: short-circuit
            set({ licenses: [], totalCount: 0, currentPage: page, isLoading: false });
            return;
          }
          query = query.in('id', licenseIds);
        }
      }

      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + pageSize - 1);


      const { data, error, count } = await query;

      if (error) throw error;

      // set({
      //   licenses: data || [],
      //   totalCount: count || 0,
      //   currentPage: page,
      //   isLoading: false
      // });

      // Attach serials array to each license (for table display)
      const licensesRaw = data || [];
      const ids = licensesRaw.map((l: any) => l.id);
      let licensesWithSerials = licensesRaw;

      if (ids.length > 0) {
        const { data: serialRows, error: sErr } = await supabase
          .from('license_serials')
          .select('license_id, serial_or_contract')
          .in('license_id', ids);

        if (!sErr) {
          const byLicense: Record<string, string[]> = {};
          (serialRows || []).forEach((row: any) => {
            (byLicense[row.license_id] ||= []).push(row.serial_or_contract);
          });
          licensesWithSerials = licensesRaw.map((l: any) => ({
            ...l,
            serials: byLicense[l.id] || [],
          }));
        }
      }

      set({
        licenses: licensesWithSerials,
        totalCount: count || 0,
        currentPage: page,
        isLoading: false,
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
      // Enforce permissions: plain users cannot create; super_user restricted to assigned projects
      const { user, assignments } = useAuthStore.getState();
      if (user && user.role === 'user') {
        throw new Error('You do not have permission to create licenses.');
      }
      const requestedAssign = (licenseData as any)?.project_assign as string | undefined;
      if (user && (user.role === 'super_user' || user.role === 'user')) {
        if (!requestedAssign) {
          throw new Error('Project assign is required for creating a license');
        }
        if (!assignments || !assignments.includes(requestedAssign as any)) {
          throw new Error(`You are not assigned to project ${requestedAssign}. Allowed: ${assignments?.join(', ') || 'none'}`);
        }
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
        'project_assign',
        'item_description',
        'remark',
        'priority',
        'status'
        // 'license_start_date',
        // 'license_end_date',
        // 'serial_number'
      ]);
      const coreInsert: any = {};
      Object.keys(licenseCore || {}).forEach((k) => {
        if (allowedKeys.has(k)) coreInsert[k] = (licenseCore as any)[k];
      });

      const insertPayload: any = {
        ...coreInsert,
        // satisfy existing schema with derived data
        // serial_number: coreInsert.serial_number || firstSerial?.serial_or_contract || 'N/A',
        // license_start_date: coreInsert.license_start_date || firstSerial?.start_date || new Date().toISOString().slice(0,10),
        // license_end_date: coreInsert.license_end_date || firstSerial?.end_date || new Date().toISOString().slice(0,10),
        user_id: currentUser.id,
        created_by: currentUser.id,
        last_modified_by: currentUser.id
      };

      const { data, error } = await supabase
        .from('licenses')
        .insert([insertPayload])
        .select()
        .single();

      if (error) {
        const code = (error as any)?.code;
        const message = (error as any)?.message || '';
        if (code === '23505' && message.includes('serial_number')) {
          throw new Error('Serial number already exists. Please enter a unique serial/contract number.');
        }
        throw error;
      }

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
          po_no: s.po_no || null,
          notify_before_days: s.notify_before_days ?? 30,
        }));
        // const { error: serialErr } = await supabase.from('license_serials').insert(serialRows);
        // if (serialErr) throw serialErr;

        const { error: serialErr } = await supabase.from('license_serials').insert(serialRows);
        if (serialErr) {
          if ((serialErr as any).code === '23505') {
            throw new Error('Serial number already exists. It must be unique.');
          }
          throw serialErr;
        }
      }

      if (customers.length > 0) {
        const customerRows = customers.map(c => ({
          license_id: data.id,
          customer_id: (c as any).customer_id || null,  // save link if selected
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
          distributor_id: (d as any).distributor_id || null,  // ADD THIS
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
          message: `${currentUser.name} added license for ${licenseData.item_description}`,
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
        'project_assign',
        'item_description',
        'remark',
        'priority',
        'status',
        // 'license_start_date',
        // 'license_end_date',
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

      if (error) {
        const code = (error as any)?.code;
        const message = ((error as any)?.message || '').toLowerCase();
        if (code === '23505' && message.includes('serial_number')) {
          const sn = (updates as any)?.serial_number ?? '(unknown)';
          throw new Error(`Serial number "${sn}" already exists on another license.`);
        }
        throw error;
      }

      // Refresh the licenses list
      await get().fetchLicenses(get().currentPage);

      // Build change set for audit (compute diffs; no try/catch)
      const auditStore = useAuditStore.getState();
      const changes: Record<string, { old: any; new: any }> = {};
      if (currentLicense) {
        Object.keys(sanitized).forEach(key => {
          if ((currentLicense as any)[key] !== (sanitized as any)[key]) {
            changes[key] = { old: (currentLicense as any)[key], new: (sanitized as any)[key] };
          }
        });
      }

      // Apply serial changes — DO NOT wrap in try/catch so errors bubble up
      const serialsIncoming = (updates as any).serials as LicenseSerial[] | undefined;
      if (serialsIncoming) {
        // 1) existing ids
        const { data: existingSerials, error: exErr } = await supabase
          .from('license_serials')
          .select('id')
          .eq('license_id', id);
        if (exErr) throw exErr;

        const existingIds = new Set((existingSerials || []).map((r: any) => r.id));
        const incomingIds = new Set(serialsIncoming.filter(s => s.id).map(s => s.id as string));

        // 2) ops
        const toInsert = serialsIncoming.filter(s => !s.id);
        const toUpdate = serialsIncoming.filter(s => s.id && existingIds.has(s.id));
        const toDeleteIds = [...existingIds].filter(oldId => !incomingIds.has(oldId));

        // 3) deletes
        if (toDeleteIds.length > 0) {
          const { error: delErr } = await supabase.from('license_serials').delete().in('id', toDeleteIds);
          if (delErr) throw delErr;
        }

        // 4) Apply updates (ONLY serial_or_contract; do NOT touch dates/cost/etc.)
        for (const s of toUpdate) {
          // Load old values first for legacy text-based fallback
          const { data: oldRow, error: oldErr } = await supabase
            .from('license_serials')
            .select('serial_or_contract')
            .eq('id', s.id)
            .single();
          if (oldErr) throw oldErr;

          // Update ONLY the serial/contract text
          const { error: upErr } = await supabase
            .from('license_serials')
            .update({
              serial_or_contract: s.serial_or_contract,
            })
            .eq('id', s.id as string);
          if (upErr) {
            if ((upErr as any).code === '23505') {
              throw new Error(`Serial/Contract "${s.serial_or_contract}" already exists. It must be unique.`);
            }
            throw upErr;
          }

          // A) Sync renewal_history rows linked by FK (update only the serial text)
          const { data: rhUpdated, error: rhErr1 } = await supabase
            .from('renewal_history')
            .update({
              prev_serial_no: s.serial_or_contract ?? null,
              // Do NOT update prev_serial_start_date or prev_serial_end_date here
            })
            .eq('prev_selected_serial_id', s.id)
            .select('id');
          if (rhErr1) throw rhErr1;

          // B) If none updated (legacy rows without FK), update by matching previous text (serial only)
          if (!rhUpdated || rhUpdated.length === 0) {
            if (oldRow?.serial_or_contract) {
              const { error: rhErr2 } = await supabase
                .from('renewal_history')
                .update({
                  prev_serial_no: s.serial_or_contract ?? null,
                  // Do NOT update prev_serial_start_date or prev_serial_end_date here either
                })
                .eq('license_id', id)
                .is('prev_selected_serial_id', null)
                .eq('prev_serial_no', oldRow.serial_or_contract)
                .select('id'); // optional: to observe affected rows during debugging
              if (rhErr2) throw rhErr2;
            }
          }
        }

        // 5) inserts — validate required fields
        if (toInsert.length > 0) {
          for (const s of toInsert) {
            if (!s.serial_or_contract?.trim() || !s.start_date || !s.end_date || typeof s.qty !== 'number' || typeof s.unit_price !== 'number' || !s.currency) {
              throw new Error('Serial row is missing required fields (serial, dates, qty, unit price, currency).');
            }
          }
          const rows = toInsert.map(s => ({
            license_id: id,
            serial_or_contract: s.serial_or_contract,
            start_date: s.start_date,
            end_date: s.end_date,
            qty: s.qty,
            unit_price: s.unit_price,
            currency: s.currency,
            po_no: s.po_no ?? null,
            notify_before_days: s.notify_before_days ?? 30,
          }));


          const { error: insErr } = await supabase.from('license_serials').insert(rows);
          if (insErr) {
            if ((insErr as any).code === '23505') {
              const first = toInsert[0]?.serial_or_contract ?? '(unknown)';
              throw new Error(`Serial/Contract "${first}" already exists. It must be unique.`);
            }
            throw insErr;
          }
        }
      }

      // Audit log — best-effort only
      try {
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

      // Create notification for update (admins will see all; others will see their own via store rules)
      try {
        const notificationStore = useNotificationStore.getState();
        await notificationStore.createNotification({
          type: 'system',
          title: 'License Updated',
          message: `${currentUser.name} updated ${currentLicense?.item_description || 'license'}`,
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

      return data;
    } catch (error) {
      console.error('Error updating license:', error);
      throw error;
    }

  },


  checkSerialExpiryNotifications: async () => {

    try {
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('license_serials')
        .select(`
          id, license_id, serial_or_contract, end_date, notify_before_days, last_notified_on,
          licenses!inner(id, item_description, project_name, vendor, status, created_by)
        `)
        .not('notify_before_days', 'is', null);
      if (error) throw error;

      const rows: SerialWithLicense[] = (data ?? []) as any[];

      const due = rows.filter(r => {
        if (!r.notify_before_days || !r.end_date) return false;
        const end = parseISO(r.end_date);
        const target = subDays(end, r.notify_before_days);
        return format(target, 'yyyy-MM-dd') <= todayStr;
      });

      if (due.length === 0) return;

      const notificationStore = useNotificationStore.getState();
      const currentUser = await get().getCurrentUser();
      const actorUserId = currentUser?.id || 'system';

      for (const r of due) {
        const lic = r.licenses;

        const actionUrl = `/licenses/${r.license_id}?serial=${r.id}`;

        const { data: exists } = await supabase
          .from('notifications')
          .select('id')
          .eq('type', 'expiry')
          .eq('license_id', lic.id)
          .eq('action_url', actionUrl)
          .limit(1)
          .maybeSingle();

        if (exists) {
          continue; // A reminder exists; do not create another
        }


        await notificationStore.createNotification({
          type: 'expiry',
          title: 'Serial approaching expiry',
          message: `${lic.item_description || 'Product'} (${r.serial_or_contract}) will expire on ${format(parseISO(r.end_date), 'MMM dd, yyyy')} — reminder ${r.notify_before_days} days before`, license_id: r.license_id,
          user_id: actorUserId,
          is_read: false,
          priority: 'high',
          action_required: false,
          action_url: actionUrl,
          expires_at: null,
        });

        await supabase
          .from('license_serials')
          .update({ last_notified_on: todayStr })
          .eq('id', r.id);
      }
    } catch (e) {
      console.error('checkSerialExpiryNotifications failed:', e);
    }
  },

  deleteLicense: async (id) => {
    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      // Get license info for logging and notification before deletion
      const { data: licenseBeforeDelete } = await supabase
        .from('licenses')
        .select('id, item_description')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('licenses')
        .update({
          deleted_at: new Date().toISOString(),
          last_modified_by: currentUser.id,
          updated_at: new Date().toISOString()
        })
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

      // Create notification for delete
      try {
        const notificationStore = useNotificationStore.getState();
        await notificationStore.createNotification({
          type: 'system',
          title: 'License Deleted',
          message: `${currentUser.name} deleted ${licenseBeforeDelete?.item_description || 'license'}`,
          license_id: null,
          user_id: currentUser.id,
          is_read: false,
          priority: 'medium',
          action_required: false,
          action_url: null,
          expires_at: null
        });
      } catch (notificationError) {
        console.log('Notification creation failed:', notificationError);
      }
    } catch (error) {
      console.error('Error deleting license:', error);
      throw error;
    }
  },

  // setFilters: (filters) => {
  //   set({ filters: { ...get().filters, ...filters } });
  //   get().fetchLicenses(1);
  // },

  setFilters: (filters) => {
    const current = get().filters;
    const next: any = { ...current, ...filters };

    // Normalize "All" to empty for vendor (and any stringy "All")
    if ('vendor' in filters) {
      const v = (filters as any).vendor;
      next.vendor = !v || String(v).trim().toLowerCase() === 'all' ? '' : String(v).trim();
    }
    // Optional: normalize serial keys too if your UI ever sends "All"
    if ('serial' in filters) {
      const s = (filters as any).serial;
      next.serial = !s || String(s).trim().toLowerCase() === 'all' ? '' : String(s).trim();
    }
    if ('serial_number' in filters) {
      const s2 = (filters as any).serial_number;
      next.serial_number = !s2 || String(s2).trim().toLowerCase() === 'all' ? '' : String(s2).trim();
    }

    set({ filters: next });
    get().fetchLicenses(1);
  },

  // clearFilters: () => {
  //   set({ filters: {} });
  //   get().fetchLicenses(1);
  // },

  clearFilters: () => {
    set({
      filters: {
        vendor: '',
        project_name: '',
        company: '',
        user_name: '',
        search: '',
        serial: '',
        serial_number: '', // legacy key, keep empty to avoid stray server params
        status: [],
        priority: [],
        project_assign: undefined,
        date_range: undefined,
      }
    });
    get().fetchLicenses(1);
  },

  setSorting: (sortBy, sortOrder) => {
    set({ sortBy, sortOrder });
    get().fetchLicenses(get().currentPage);
  },

  setSelectedLicense: (license) => {
    set({ selectedLicense: license });
  },

  getAllVendors: async () => {
    const { data, error } = await supabase
      .from('licenses')
      .select('vendor')
      .not('vendor', 'is', null)
      .order('vendor', { ascending: true });

    if (error) {
      console.error('Error fetching vendors:', error);
      return [];
    }
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const row of data || []) {
      const v = (row as any).vendor?.trim();
      if (v && !seen.has(v)) {
        seen.add(v);
        unique.push(v);
      }
    }
    return unique;
  },

  loadVendors: async () => {
    const list = await get().getAllVendors();
    set({ vendors: list });
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
  renewLicense: async (id, payload) => {
    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) throw new Error('No authenticated user found');

      // Load current license
      const { data: license, error: licErr } = await supabase
        .from('licenses')
        .select('*')
        .eq('id', id)
        .single();
      if (licErr) throw licErr;
      if (!license) throw new Error('License not found');


      // Load the SELECTED serial (the one being renewed)
      const { data: serial, error: serialErr } = await supabase
        .from('license_serials')
        .select('*')
        .eq('id', payload.selectedSerialId)
        .single();
      if (serialErr) throw serialErr;
      if (!serial) throw new Error('Selected serial not found');

      const prevCost = Number(serial.unit_price ?? 0);

      // Insert into renewal_history: save OLD (prev_*) and NEW
      // Insert into renewal_history: OLD snapshot only
      const { data: renewalData, error: renewalError } = await supabase
        .from('renewal_history')
        .insert([{
          license_id: id,
          renewal_date: new Date().toISOString(),

          // OLD values (before renewal)
          prev_product_name: license.item_description,
          prev_remark: license.remark,
          prev_serial_no: serial.serial_or_contract,
          prev_serial_start_date: serial.start_date,
          prev_serial_end_date: serial.end_date,
          prev_selected_serial_id: serial.id,
          previous_end_date: serial.end_date || license.license_end_date,


          // Meta
          cost: prevCost,
          renewed_by: currentUser.id,
          notes: payload.notes || null
        }])
        .select()
        .single();
      if (renewalError) throw renewalError;

      // Update CURRENT license table with NEW info
      const { error: licUpErr } = await supabase
        .from('licenses')
        .update({
          item_description: payload.productName,
          remark: payload.remark ?? license.remark,
          // serial_number: payload.serialNo,
          last_modified_by: currentUser.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      if (licUpErr) throw licUpErr;

      // Update ONLY the SELECTED serial row
      const { error: sUpErr } = await supabase
        .from('license_serials')
        .update({
          serial_or_contract: payload.serialNo,
          start_date: payload.serialStartDate,
          end_date: payload.newEndDate,
          unit_price: payload.cost,
        })
        .eq('id', payload.selectedSerialId);
      if (sUpErr) throw sUpErr;

      // Refresh list
      await get().fetchLicenses(get().currentPage);

      // Notification (optional best-effort)
      try {
        const notificationStore = useNotificationStore.getState();
        await notificationStore.createNotification({
          type: 'renewal',
          title: 'License Renewed',
          message: `${license.item_description || license.item} renewed until ${format(new Date(payload.newEndDate), 'MMM dd, yyyy')}`,
          license_id: id,
          user_id: currentUser.id,
          is_read: false,
          priority: 'medium',
          action_required: false,
          action_url: `/licenses/${id}`,
          expires_at: null
        });
      } catch { }

      return renewalData;
    } catch (error) {
      console.error('Error renewing license:', error);
      throw error;
    }
  },

  fetchRenewalHistory: async (licenseId) => {
    const { data, error } = await supabase
      .from('renewal_history')
      .select('*')
      .eq('license_id', licenseId)
      .order('renewal_date', { ascending: false });
    if (error) throw error;
    return data || [];
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

      // Build change set for audit (just compute diffs; no try/catch here)
      const auditStore = useAuditStore.getState();
      const changes: Record<string, { old: any; new: any }> = {};
      if (currentLicense) {
        Object.keys(sanitized).forEach(key => {
          if ((currentLicense as any)[key] !== (sanitized as any)[key]) {
            changes[key] = {
              old: (currentLicense as any)[key],
              new: (sanitized as any)[key]
            };
          }
        });
      }

      // Apply serial changes — LET ERRORS BUBBLE UP
      const serialsIncoming = (updates as any).serials as LicenseSerial[] | undefined;
      if (serialsIncoming) {
        // 1) existing ids
        const { data: existingSerials, error: exErr } = await supabase
          .from('license_serials')
          .select('id')
          .eq('license_id', id);
        if (exErr) throw exErr;

        const existingIds = new Set((existingSerials || []).map((r: any) => r.id));
        const incomingIds = new Set(serialsIncoming.filter(s => s.id).map(s => s.id as string));

        // 2) ops
        const toInsert = serialsIncoming.filter(s => !s.id);
        const toUpdate = serialsIncoming.filter(s => s.id && existingIds.has(s.id));
        const toDeleteIds = [...existingIds].filter(oldId => !incomingIds.has(oldId));

        // 3) deletes
        if (toDeleteIds.length > 0) {
          const { error: delErr } = await supabase
            .from('license_serials')
            .delete()
            .in('id', toDeleteIds);
          if (delErr) throw delErr;
        }

        // 4) updates — partial payload to avoid 400 on undefined -> null
        for (const s of toUpdate) {
          // 4.0) Load old serial row first (for legacy backfill by text)
          const { data: oldRow, error: oldErr } = await supabase
            .from('license_serials')
            .select('serial_or_contract, start_date, end_date')
            .eq('id', s.id)
            .single();
          if (oldErr) throw oldErr;

          // Prepare partial update
          const payload: any = {};
          if (typeof s.serial_or_contract === 'string') payload.serial_or_contract = s.serial_or_contract;
          if (typeof s.start_date === 'string') payload.start_date = s.start_date;        // YYYY-MM-DD
          if (typeof s.end_date === 'string') payload.end_date = s.end_date;              // YYYY-MM-DD
          if (typeof s.qty === 'number') payload.qty = s.qty;
          if (typeof s.unit_price === 'number') payload.unit_price = s.unit_price;
          if (typeof s.currency === 'string') payload.currency = s.currency;
          if ('po_no' in s) payload.po_no = s.po_no ?? null;
          if (typeof s.notify_before_days === 'number') payload.notify_before_days = s.notify_before_days;

          // Update serial
          const { error: updErr } = await supabase
            .from('license_serials')
            .update(payload)
            .eq('id', s.id);
          if (updErr) {
            if ((updErr as any).code === '23505') {
              throw new Error(`Serial/Contract "${s.serial_or_contract}" already exists. It must be unique.`);
            }
            throw updErr;
          }

          // A) Sync history by FK (preferred)
          const { data: rh1, error: rhErr1 } = await supabase
            .from('renewal_history')
            .update({
              prev_serial_no: s.serial_or_contract ?? null,
              prev_serial_start_date: s.start_date ?? null,
              prev_serial_end_date: s.end_date ?? null,
            })
            .eq('prev_selected_serial_id', s.id)
            .select('id'); // see rows affected
          if (rhErr1) throw rhErr1;


          // B) If 0 rows updated, also try legacy rows that have NULL FK but match old serial text
          if (!rh1 || rh1.length === 0) {
            if (oldRow?.serial_or_contract) {
              const { error: rhErr2 } = await supabase
                .from('renewal_history')
                .update({
                  prev_serial_no: s.serial_or_contract ?? null,
                  prev_serial_start_date: s.start_date ?? null,
                  prev_serial_end_date: s.end_date ?? null,
                })
                .eq('license_id', id)
                .is('prev_selected_serial_id', null)
                .eq('prev_serial_no', oldRow.serial_or_contract)
                .select('id'); // optional, for visibility

              if (rhErr2) throw rhErr2;
            }
          }
        }

        // 5) inserts — validate required fields
        if (toInsert.length > 0) {
          for (const s of toInsert) {
            if (!s.serial_or_contract?.trim() || !s.start_date || !s.end_date || typeof s.qty !== 'number' || typeof s.unit_price !== 'number' || !s.currency) {
              throw new Error('Serial row is missing required fields (serial, dates, qty, unit price, currency).');
            }
          }
          const rows = toInsert.map(s => ({
            license_id: id,
            serial_or_contract: s.serial_or_contract,
            start_date: s.start_date,
            end_date: s.end_date,
            qty: s.qty,
            unit_price: s.unit_price,
            currency: s.currency,
            po_no: s.po_no ?? null,
            notify_before_days: s.notify_before_days ?? 30,
          }));
          const { error: insErr } = await supabase.from('license_serials').insert(rows);
          if (insErr) throw insErr;
        }
      }

      // Audit log — best effort only
      try {
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
    } catch (error) {
      console.error('Error bulk updating licenses:', error);
      throw error;
    }
  },

  bulkDeleteLicenses: async (licenseIds) => {
    // try {
    //   const { error } = await supabase
    //     .from('licenses')
    //     .delete()
    //     .in('id', licenseIds);

    //   if (error) throw error;

    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      const { error } = await supabase
        .from('licenses')
        .update({
          deleted_at: new Date().toISOString(),
          last_modified_by: currentUser.id,
          updated_at: new Date().toISOString(),
        })
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

  // Recently deleted (<= 30 days)
  fetchRecentlyDeleted: async (): Promise<License[]> => {
    const cutoff = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('licenses')
      .select('*')
      .not('deleted_at', 'is', null)
      .gte('deleted_at', cutoff)
      .order('deleted_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Recently deleted (<= 30 days) to show with user id
  // fetchRecentlyDeleted: async (): Promise<License[]> => {
  //   const cutoff = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(); // keep your current window
  //   const { user } = useAuthStore.getState();
  //   const currentUser = await get().getCurrentUser();

  //   let query = supabase
  //     .from('licenses')
  //     .select('*')
  //     .not('deleted_at', 'is', null)
  //     .gte('deleted_at', cutoff);

  //   // Non-admin users only see what they deleted
  //   if (user?.role !== 'admin' && currentUser?.id) {
  //     query = query.eq('last_modified_by', currentUser.id);
  //   }

  //   const { data, error } = await query.order('deleted_at', { ascending: false });
  //   if (error) throw error;
  //   return data || [];
  // },

  // Recover: set deleted_at back to null
  recoverLicense: async (id: string) => {
    const currentUser = await get().getCurrentUser();
    if (!currentUser) throw new Error('No authenticated user found');

    const { error } = await supabase
      .from('licenses')
      .update({
        deleted_at: null,
        last_modified_by: currentUser.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    if (error) throw error;

    await get().fetchLicenses(get().currentPage);
  },

  // Permanently delete (hard delete)
  permanentlyDeleteLicense: async (id: string) => {
    const { error } = await supabase
      .from('licenses')
      .delete()
      .eq('id', id);
    if (error) throw error;

    await get().fetchLicenses(get().currentPage);
  },

  purgeOldDeletedLicenses: async (): Promise<number> => {
    // const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const { error, count } = await supabase
      .from('licenses')
      .delete({ count: 'exact' })
      .lt('deleted_at', cutoff);

    if (error) throw error;

    // Keep current list (active licenses) fresh
    await get().fetchLicenses(get().currentPage);
    return count || 0;
  },

  duplicateLicense: async (id) => {
    try {
      const original = await get().fetchLicenseById(id);
      if (!original) throw new Error('License not found');

      const duplicateData = {
        ...original,
        // serial_number: `${original.serial_number}-COPY-${Date.now()}`,
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
        .or(`item.ilike.%${query}%,vendor.ilike.%${query}%,project_name.ilike.%${query}%,customer_name.ilike.%${query}%`)
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
        .gte('license_end_date', startStr)
        .lte('license_end_date', endStr);

      if (error) throw error;
      return count || 0;
    } catch (e) {
      console.error('Error counting near-expiry licenses:', e);
      return 0;
    }
  },

  // Serial-based: fetch serial rows nearing expiry with joined license info
  getSerialsNearExpiry: async (days) => {
    try {
      const start = new Date();
      const end = addDays(start, days);
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('license_serials')
        .select(
          `id, license_id, serial_or_contract, start_date, end_date, qty, unit_price, currency, po_no,
             licenses!inner(
               id, company, vendor, item, item_description, serial_number, project_name, project_assign,
               customer_name, business_unit, user_name, remark, priority, status, created_at, updated_at,
               created_by, last_modified_by
             )`
        )
        // Remove status filter so non-active licenses are included
        // .eq('licenses.status', 'active')
        .not('end_date', 'is', null)
        .gte('end_date', startStr)
        .lte('end_date', endStr)
        .order('end_date', { ascending: true });

      if (error) throw error;

      const rows = (data || []) as any[];
      return rows.map(r => ({
        license: r.licenses,
        serial: {
          id: r.id,
          license_id: r.license_id,
          serial_or_contract: r.serial_or_contract,
          start_date: r.start_date,
          end_date: r.end_date,
          qty: r.qty,
          unit_price: r.unit_price,
          currency: r.currency,
          po_no: r.po_no ?? null,
        },
      }));
    } catch (e) {
      console.error('Error fetching serials near expiry:', e);
      return [];
    }
  },

  getNearSerialExpiryCount: async (days) => {
    try {
      const { user, assignments } = useAuthStore.getState();
      const start = new Date();
      const end = addDays(start, days);
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      // Admin: global count
      if (user?.role === 'admin') {
        const { count, error } = await supabase
          .from('license_serials')
          .select('id', { count: 'exact', head: true })
          .gte('end_date', startStr)
          .lte('end_date', endStr);
        if (error) throw error;
        return count || 0;
      }

      // Non-admin: restrict by assignments via join to licenses
      const assignList = assignments && assignments.length > 0 ? assignments : [];
      if (assignList.length === 0) return 0;

      const { count, error } = await supabase
        .from('license_serials')
        .select('id, licenses!inner(project_assign)', { count: 'exact', head: true })
        .gte('end_date', startStr)
        .lte('end_date', endStr)
        .in('licenses.project_assign', assignList as any);

      if (error) throw error;
      return count || 0;
    } catch (e) {
      console.error('Error counting near-expiry serials:', e);
      return 0;
    }
  },

  getExpiredSerialsCount: async () => {
    try {
      const { user, assignments } = useAuthStore.getState();
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      if (user?.role === 'admin') {
        const { count, error } = await supabase
          .from('license_serials')
          .select('id', { count: 'exact', head: true })
          .lt('end_date', todayStr);
        if (error) throw error;
        return count || 0;
      }

      const assignList = assignments && assignments.length > 0 ? assignments : [];
      if (assignList.length === 0) return 0;

      const { count, error } = await supabase
        .from('license_serials')
        .select('id, licenses!inner(project_assign)', { count: 'exact', head: true })
        .lt('end_date', todayStr)
        .in('licenses.project_assign', assignList as any);

      if (error) throw error;
      return count || 0;
    } catch (e) {
      console.error('Error counting expired serials:', e);
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