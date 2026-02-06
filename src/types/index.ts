export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "viewer";
  isVerified: boolean;
  createdAt: string;
  lastLogin?: string;
  avatar?: string;
  department?: string;
  phone?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: "light" | "dark";
  notifications: {
    email: boolean;
    push: boolean;
    licenseExpiry: boolean;
    weeklyReports: boolean;
    comments: boolean;
  };
  dashboard: {
    defaultView: "grid" | "list";
    cardsPerRow: number;
    showWelcome: boolean;
  };
}

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
  license_cost: number;
  quantity: number;
  auto_renew: boolean;
  user_name: string;
  url?: string | null;
  activation_link?: string | null;
  remark?: string | null;
  custom_fields: Record<string, any>;
  tags: string[];
  priority: "low" | "medium" | "high" | "critical";
  status: "active" | "expired" | "suspended" | "pending";
  created_at: string;
  updated_at: string;
  created_by: string;
  last_modified_by: string;

  // Related data
  comments?: LicenseComment[];
  attachments?: LicenseAttachment[];
  renewal_history?: RenewalRecord[];
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

export interface Notification {
  id: string;
  type: "expiry" | "renewal" | "comment" | "system" | "warning" | "info";
  title: string;
  message: string;
  license_id?: string | null;
  user_id: string;
  is_read: boolean;
  priority: "low" | "medium" | "high";
  action_required: boolean;
  action_url?: string | null;
  created_at: string;
  expires_at?: string | null;
}

export interface DashboardStats {
  totalLicenses: number;
  activeLicenses: number;
  expiredLicenses: number;
  licensesNearExpiry: number;
  monthlyCost: number;
  yearlyCost: number;
  totalVendors: number;
  linkedProjects: number;
  activeCustomers: number;
  renewalsThisMonth: number;
  costSavings: number;
  utilizationRate: number;
}

export interface FilterOptions {
  vendor?: string;
  user_name?: string;
  project_name?: string;
  company?: string;
  serial_number?: string;
  status?: string[];
  priority?: string[];
  tags?: string[];
  date_range?: {
    start: string;
    end: string;
  };
  cost_range?: {
    min: number;
    max: number;
  };
  auto_renew?: boolean;
  search?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  verifyEmail: (token: string) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
}

export interface AuditLog {
  id: string;
  action: "create" | "update" | "delete" | "view" | "export";
  entity_type: "license" | "user" | "report";
  entity_id: string;
  user_id: string;
  user_name: string;
  changes?: Record<string, { old: any; new: any }>;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  filters: FilterOptions;
  columns: string[];
  groupBy?: string;
  sortBy?: string;
  sortOrder: "asc" | "desc";
  createdBy: string;
  createdAt: string;
  isPublic: boolean;
}

export interface BulkOperation {
  id: string;
  type: "update" | "delete" | "export";
  status: "pending" | "processing" | "completed" | "failed";
  totalItems: number;
  processedItems: number;
  failedItems: number;
  startedAt: string;
  completedAt?: string;
  errors: string[];
  createdBy: string;
}
