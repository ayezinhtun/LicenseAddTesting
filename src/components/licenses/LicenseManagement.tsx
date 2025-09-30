import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, Download, Upload, RefreshCw, Grid, List, SortAsc, SortDesc } from 'lucide-react';
import { LicenseTable } from './LicenseTable';
import { LicenseForm } from './LicenseForm';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Modal } from '../common/Modal';
import { Card } from '../common/Card';
import { useLicenseStore } from '../../store/licenseStore';
import { useAuthStore } from '../../store/authStore';
import { License } from '../../store/licenseStore';
import toast from 'react-hot-toast';
import { format, parseISO, addDays } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export const LicenseManagement: React.FC = () => {
  const {
    licenses,
    isLoading,
    filters,
    sortBy,
    sortOrder,
    currentPage,
    pageSize,
    totalCount,
    fetchLicenses,
    addLicense,
    updateLicense,
    deleteLicense,
    setFilters,
    setSorting,
    exportLicenses,
    clearFilters
  } = useLicenseStore();

  const { user } = useAuthStore();

  const location = useLocation() as { state?: { editLicenseId?: string } };
  const navigate = useNavigate();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedLicenses, setSelectedLicenses] = useState<string[]>([]);
  
  const [localFilters, setLocalFilters] = useState({
    search: '',
    vendor: '',
    status: '',
    priority: '',
    project_name: '',
    project_assign: '' as '' | 'NPT' | 'YGN' | 'MPT'
  });

  const [exportOptions, setExportOptions] = useState({
    format: 'csv' as 'csv' | 'xlsx' | 'pdf',
    includeComments: false,
    includeAttachments: false,
    dateRange: {
      start: '',
      end: ''
    }
  });

  

  useEffect(() => {
    fetchLicenses();
  }, [fetchLicenses]);

  const handleAddLicense = () => {
    setEditingLicense(null);
    setIsFormOpen(true);
  };

const handleEditLicense = async (license: License) => {
  // Preload child rows and attach to the license object
  const [serialRes, customerRes, distributorRes] = await Promise.all([
    supabase
      .from('license_serials')
      .select('*')
      .eq('license_id', license.id)
      .order('start_date', { ascending: true }),
    supabase
      .from('license_customers')
      .select('*')
      .eq('license_id', license.id)
      .order('company_name', { ascending: true }),
    supabase
      .from('license_distributors')
      .select('*')
      .eq('license_id', license.id)
      .order('company_name', { ascending: true }),
  ]);

  const licWithChildren = {
    ...license,
    serials: serialRes.data || [],
    customers: customerRes.data || [],
    distributors: distributorRes.data || [],
  };

  setEditingLicense(licWithChildren);
  setIsFormOpen(true);
};

  const handleDeleteLicense = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this license? This action cannot be undone.')) {
      try {
        await deleteLicense(id);
        toast.success('License deleted successfully');
      } catch (error) {
        toast.error('Failed to delete license');
      }
    }
  };

  const handleSaveLicense = async (licenseData: any) => {
    try {
      if (editingLicense) {
        await updateLicense(editingLicense.id, licenseData);
        toast.success('License updated successfully');
      } else {
        const created = await addLicense(licenseData as Omit<License, 'id' | 'created_at' | 'updated_at'>);

        // Upload attachments after creation (10KB - 200MB)
        if (licenseData.attachments && Array.isArray(licenseData.attachments)) {
          for (const file of licenseData.attachments as File[]) {
            if (file.size < 10 * 1024) {
              toast.error(`${file.name}: minimum size 10 KB`);
              continue;
            }
            if (file.size > 200 * 1024 * 1024) {
              toast.error(`${file.name}: maximum size 200 MB`);
              continue;
            }
            await useLicenseStore.getState().addAttachment(created.id, file);
          }
        }

        toast.success('License added successfully');
      }
      setIsFormOpen(false);
      setEditingLicense(null);
    } catch (error) {
      const msg = error instanceof Error ? error.message : (editingLicense ? 'Failed to update license' : 'Failed to add license');
      if (msg.includes('duplicate serial number')) {
        toast.error('A license with this serial number already exists');
      } else {
        toast.error(msg);
      }
    }
  };

  const handleExport = async () => {
    try {
      const exportFilters = { ...filters };
      
      // Add date range filter if specified
      if (exportOptions.dateRange.start && exportOptions.dateRange.end) {
        exportFilters.date_range = {
          start: exportOptions.dateRange.start,
          end: exportOptions.dateRange.end
        };
      }

      await exportLicenses(exportOptions.format, exportFilters);
      toast.success(`Licenses exported as ${exportOptions.format.toUpperCase()} successfully`);
      setShowExportModal(false);
    } catch (error) {
      toast.error('Failed to export licenses');
    }
  };

  const handleBulkExport = async () => {
    if (selectedLicenses.length === 0) {
      toast.error('Please select licenses to export');
      return;
    }

    try {
      // Create a filter that includes only selected licenses
      const bulkFilters = {
        ...filters,
        license_ids: selectedLicenses
      };

      await exportLicenses(exportOptions.format, bulkFilters);
      toast.success(`${selectedLicenses.length} licenses exported successfully`);
      setSelectedLicenses([]);
      setShowExportModal(false);
    } catch (error) {
      toast.error('Failed to export selected licenses');
    }
  };

  const handleApplyFilters = () => {
    const appliedFilters: any = {};
    
    if (localFilters.search) appliedFilters.search = localFilters.search;
    if (localFilters.vendor) appliedFilters.vendor = localFilters.vendor;
    if (localFilters.status) appliedFilters.status = [localFilters.status];
    if (localFilters.priority) appliedFilters.priority = [localFilters.priority];
    if (localFilters.project_name) appliedFilters.project_name = localFilters.project_name;
    if (localFilters.project_assign) appliedFilters.project_assign = localFilters.project_assign;

    setFilters(appliedFilters);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setLocalFilters({
      search: '',
      vendor: '',
      status: '',
      priority: '',
      project_name: '',
      project_assign: ''
    });
    clearFilters();
    setShowFilters(false);
  };

  const handleSort = (field: string) => {
    const newOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
    setSorting(field, newOrder);
  };

  const handleSelectLicense = (licenseId: string, selected: boolean) => {
    if (selected) {
      setSelectedLicenses(prev => [...prev, licenseId]);
    } else {
      setSelectedLicenses(prev => prev.filter(id => id !== licenseId));
    }
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedLicenses(licenses.map(license => license.id));
    } else {
      setSelectedLicenses([]);
    }
  };

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'active', label: 'Active' },
    { value: 'expired', label: 'Expired' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'completed', label: 'Completed' }
  ];

  const priorityOptions = [
    { value: '', label: 'All Priorities' },
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' }
  ];

  // autoRenewOptions removed

  const exportFormatOptions = [
    { value: 'csv', label: 'CSV (Comma Separated Values)' },
    { value: 'xlsx', label: 'Excel Spreadsheet' },
    { value: 'pdf', label: 'PDF Document' }
  ];

  const getActiveFiltersCount = () => {
    return Object.values(localFilters).filter(value => value !== '').length;
  };


  useEffect(() => {
    const openEditFromState = async () => {
      const editId = location.state?.editLicenseId;
      if (!editId) return;
    
      // Try to find the license from the already-fetched list
      let lic = licenses.find(l => l.id === editId) || null;
    
      // If not found yet (e.g., first load), fetch it directly from the store
      if (!lic && typeof useLicenseStore.getState().fetchLicenseById === 'function') {
        try {
          lic = await useLicenseStore.getState().fetchLicenseById(editId);
        } catch {}
      }
    
      if (lic) {
        // Preload child rows and attach to the license object
        const [serialRes, customerRes, distributorRes] = await Promise.all([
          supabase.from('license_serials').select('*').eq('license_id', lic.id).order('start_date', { ascending: true }),
          supabase.from('license_customers').select('*').eq('license_id', lic.id).order('company_name', { ascending: true }),
          supabase.from('license_distributors').select('*').eq('license_id', lic.id).order('company_name', { ascending: true })
        ]);
    
        const licWithChildren = {
          ...lic,
          serials: serialRes.data || [],
          customers: customerRes.data || [],
          distributors: distributorRes.data || []
        };
    
        setEditingLicense(licWithChildren);
        setIsFormOpen(true);
      }
    
      // Clear the navigation state so it doesn’t reopen on refresh/back
      navigate('/licenses', { replace: true, state: {} });
    };
  
    openEditFromState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, licenses]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">License Management</h1>
          <p className="text-gray-600 mt-1">
            Manage and track all your software licenses in one place
          </p>
        </div>
        <div className="flex space-x-3">
          {selectedLicenses.length > 0 && (
            <div className="flex items-center space-x-2 px-3 py-2 bg-blue-50 rounded-lg">
              <span className="text-sm text-blue-700 font-medium">
                {selectedLicenses.length} selected
              </span>
              <Button
                variant="secondary"
                size="sm"
                icon={Download}
                onClick={() => setShowExportModal(true)}
              >
                Export Selected
              </Button>
            </div>
          )}
          <Button
            variant="secondary"
            icon={Upload}
            onClick={() => toast('Import feature coming soon!')}
          >
            Import
          </Button>
          <Button
            variant="secondary"
            icon={Download}
            onClick={() => setShowExportModal(true)}
          >
            Export
          </Button>
          {user?.role !== 'user' && (
            <Button
              icon={Plus}
              onClick={handleAddLicense}
            >
              Add License
            </Button>
          )}
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Licenses</p>
              <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <Grid className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Licenses</p>
              <p className="text-2xl font-bold text-gray-900">
                {licenses.filter(l => l.status === 'active').length}
              </p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <RefreshCw className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Expiring Soon</p>
              <p className="text-2xl font-bold text-gray-900">
                {licenses.filter(l => {
                  const daysUntilExpiry = Math.ceil(
                    (new Date(l.license_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
                }).length}
              </p>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <Search className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </Card>

        
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card>
          <div className="space-y-4">
            {/* Main Search Bar */}
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <Input
                  placeholder="Search licenses by name, vendor, project, or serial number..."
                  value={localFilters.search}
                  onChange={(value) => setLocalFilters(prev => ({ ...prev, search: value }))}
                  icon={Search}
                />
              </div>
              <Button
                variant="secondary"
                icon={Filter}
                onClick={() => setShowFilters(!showFilters)}
                className={getActiveFiltersCount() > 0 ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}
              >
                Filters {getActiveFiltersCount() > 0 && `(${getActiveFiltersCount()})`}
              </Button>
              <Button
                variant="ghost"
                icon={viewMode === 'table' ? Grid : List}
                onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
                title={`Switch to ${viewMode === 'table' ? 'grid' : 'table'} view`}
              />
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="border-t border-gray-200 pt-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <Input
                    label="Vendor"
                    value={localFilters.vendor}
                    onChange={(value) => setLocalFilters(prev => ({ ...prev, vendor: value }))}
                    placeholder="Filter by vendor"
                  />
                  
                  <Input
                    label="Project Name"
                    value={localFilters.project_name}
                    onChange={(value) => setLocalFilters(prev => ({ ...prev, project_name: value }))}
                    placeholder="Filter by project name"
                  />

                  <Select
                    label="Project Assign"
                    value={localFilters.project_assign}
                    onChange={(value) => setLocalFilters(prev => ({ ...prev, project_assign: value as any }))}
                    options={[{ value: '', label: 'All Assigns' }, { value: 'NPT', label: 'NPT' }, { value: 'YGN', label: 'YGN' }, { value: 'MPT', label: 'MPT' }]}
                  />
                  
                  <Select
                    label="Status"
                    value={localFilters.status}
                    onChange={(value) => setLocalFilters(prev => ({ ...prev, status: value }))}
                    options={statusOptions}
                  />
                  
                  <Select
                    label="Priority"
                    value={localFilters.priority}
                    onChange={(value) => setLocalFilters(prev => ({ ...prev, priority: value }))}
                    options={priorityOptions}
                  />
                  
                  {/* Auto Renew filter removed */}
                </div>
                
                <div className="flex justify-end space-x-3 mt-4">
                  <Button variant="secondary" onClick={handleClearFilters}>
                    Clear All
                  </Button>
                  <Button onClick={handleApplyFilters}>
                    Apply Filters
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Sort Options */}
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">Sort by:</span>
                <div className="flex space-x-2">
                  {[
                    { field: 'license_end_date', label: 'Expiry Date' },
                    { field: 'item', label: 'Name' },
                    { field: 'vendor', label: 'Vendor' },
                    { field: 'created_at', label: 'Created' }
                  ].map(({ field, label }) => (
                    <Button
                      key={field}
                      variant={sortBy === field ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => handleSort(field)}
                      icon={sortBy === field ? (sortOrder === 'asc' ? SortAsc : SortDesc) : undefined}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="text-sm text-gray-500">
                Showing {licenses.length} of {totalCount} licenses
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* License Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card padding="none">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading licenses...</span>
            </div>
          ) : (
            <LicenseTable
              licenses={licenses}
              onEdit={handleEditLicense}
              onDelete={handleDeleteLicense}
              selectedLicenses={selectedLicenses}
              onSelectLicense={handleSelectLicense}
              onSelectAll={handleSelectAll}
            />
          )}
        </Card>
      </motion.div>

      {/* License Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingLicense(null);
        }}
        title={editingLicense ? 'Edit License' : 'Add New License'}
        maxWidth="4xl"
      >
        <LicenseForm
          license={editingLicense}
          onSave={handleSaveLicense}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingLicense(null);
          }}
        />
      </Modal>

      {/* Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Licenses"
        maxWidth="lg"
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Export Options</h3>
            
            <div className="space-y-4">
              <Select
                label="Export Format"
                value={exportOptions.format}
                onChange={(value) => setExportOptions(prev => ({ ...prev, format: value as any }))}
                options={exportFormatOptions}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Date From"
                  type="date"
                  value={exportOptions.dateRange.start}
                  onChange={(value) => setExportOptions(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, start: value }
                  }))}
                />
                <Input
                  label="Date To"
                  type="date"
                  value={exportOptions.dateRange.end}
                  onChange={(value) => setExportOptions(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, end: value }
                  }))}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    id="includeComments"
                    type="checkbox"
                    checked={exportOptions.includeComments}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeComments: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="includeComments" className="ml-2 block text-sm text-gray-900">
                    Include Comments
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    id="includeAttachments"
                    type="checkbox"
                    checked={exportOptions.includeAttachments}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, includeAttachments: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="includeAttachments" className="ml-2 block text-sm text-gray-900">
                    Include Attachment References
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Export Summary</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Format: {exportOptions.format.toUpperCase()}</p>
              <p>Total Licenses: {selectedLicenses.length > 0 ? selectedLicenses.length : licenses.length}</p>
              {exportOptions.dateRange.start && exportOptions.dateRange.end && (
                <p>Date Range: {format(new Date(exportOptions.dateRange.start), 'MMM dd, yyyy')} - {format(new Date(exportOptions.dateRange.end), 'MMM dd, yyyy')}</p>
              )}
              {getActiveFiltersCount() > 0 && (
                <p>Active Filters: {getActiveFiltersCount()}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => setShowExportModal(false)}
            >
              Cancel
            </Button>
            {selectedLicenses.length > 0 ? (
              <Button
                onClick={handleBulkExport}
                icon={Download}
              >
                Export Selected ({selectedLicenses.length})
              </Button>
            ) : (
              <Button
                onClick={handleExport}
                icon={Download}
              >
                Export All
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};