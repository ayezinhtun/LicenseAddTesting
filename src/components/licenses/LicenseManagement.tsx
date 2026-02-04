import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, Download, FileText, Upload, RefreshCw, Grid, List, SortAsc, SortDesc } from 'lucide-react';
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
import { useProjectAssignStore } from '../../store/projectAssignStore';
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

  const { assigns, fetchProjectAssigns } = useProjectAssignStore();
  useEffect(() => {
    fetchProjectAssigns();
  }, [fetchProjectAssigns]);

  const location = useLocation() as { state?: { editLicenseId?: string } };
  const navigate = useNavigate();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  // const [showExportModal, setShowExportModal] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedLicenses, setSelectedLicenses] = useState<string[]>([]);

  const { getNearSerialExpiryCount } = useLicenseStore();
  const [nearExpiryCount, setNearExpiryCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const n = await getNearSerialExpiryCount(30);
      if (mounted) setNearExpiryCount(n);
    })();
    return () => { mounted = false; };
  }, [getNearSerialExpiryCount]);


  const [localFilters, setLocalFilters] = useState({
    search: '',
    vendor: '',
    serialNumber: '',
    status: '',
    priority: '',
    project_name: '',
    // project_assign: '' as '' | 'NPT' | 'YGN' | 'MPT'
    project_assign: '' as string
  });

  const getUniqueVendors = () => {
    const vendors = new Set(licenses.map(license => license.vendor).filter(Boolean));
    return Array.from(vendors).map(vendor => ({ value: vendor, label: vendor }));
  };

  // const [exportOptions, setExportOptions] = useState({
  //   format: 'csv' as 'csv' | 'xlsx' | 'pdf',
  //   includeComments: false,
  //   includeAttachments: false,
  //   dateRange: {
  //     start: '',
  //     end: ''
  //   }
  // });



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
    } catch (err) {
      let msg = editingLicense ? 'Failed to update license' : 'Failed to add license';
      const e = err as any;

      if (e?.message && typeof e.message === 'string') msg = e.message;
      else if (typeof e === 'string') msg = e;
      else if (e?.error?.message) msg = e.error.message;
      else if (e?.data?.message) msg = e.data.message;
      else if (e?.details) msg = `${msg} — ${e.details}`;

      toast.error(msg);
    }
  };

  const handleApplyFilters = () => {
    const appliedFilters: any = {};

    if (localFilters.search) appliedFilters.search = localFilters.search;
    if (localFilters.vendor) appliedFilters.vendor = localFilters.vendor;
    if (localFilters.serialNumber) appliedFilters.serial_number = localFilters.serialNumber;
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
      serialNumber: '',
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

  // Helper: build flat rows per serial with joined distributor/customer names
  const buildExportRows = async () => {
    try {
      const licenseIds = licenses.map(l => l.id);
      if (licenseIds.length === 0) return [];

      // Fetch all child rows for licenses currently visible
      const [serialRes, custRes, distRes] = await Promise.all([
        supabase.from('license_serials')
          .select('license_id, serial_or_contract, start_date, end_date, qty')
          .in('license_id', licenseIds),
        supabase.from('license_customers')
          .select('license_id, company_name')
          .in('license_id', licenseIds),
        supabase.from('license_distributors')
          .select('license_id, company_name')
          .in('license_id', licenseIds),
      ]);

      const serials = serialRes.data || [];
      const customers = custRes.data || [];
      const distributors = distRes.data || [];

      const customersByLicense = customers.reduce<Record<string, string[]>>((acc, c: any) => {
        acc[c.license_id] = acc[c.license_id] || [];
        if (c.company_name) acc[c.license_id].push(c.company_name);
        return acc;
      }, {});

      const distributorsByLicense = distributors.reduce<Record<string, string[]>>((acc, d: any) => {
        acc[d.license_id] = acc[d.license_id] || [];
        if (d.company_name) acc[d.license_id].push(d.company_name);
        return acc;
      }, {});


      // Build one row per serial for the export
      const rows = serials.map((s: any) => {
        const lic = licenses.find(l => l.id === s.license_id);
        if (!lic) return null;

        // Product: prefer item_description, fallback to item
        const product = lic.item_description?.trim() ? lic.item_description : lic.item;

        return {
          vendorName: lic.vendor || '',
          distributorName: (distributorsByLicense[lic.id] || []).join(', '),
          customerName: (customersByLicense[lic.id] || []).join(', '),
          projectName: lic.project_name || '',
          product: product || '',
          serialContractNumber: s.serial_or_contract || lic.serial_number || '',
          quantity: String(s.qty ?? ''),
          startDate: s.start_date || '',
          endDate: s.end_date || '',
          status: lic.status || '',
          remark: lic.remark || ''
        };
      }).filter(Boolean) as Array<{
        vendorName: string;
        distributorName: string;
        customerName: string;
        projectName: string;
        product: string;
        serialContractNumber: string;
        quantity: string;
        startDate: string;
        endDate: string;
        status: string;
        remark: string
      }>;

      return rows;
    } catch (e) {
      console.error('buildExportRows error:', e);
      toast.error('Failed to prepare export data');
      return [];
    }
  };

  // CSV export
  const handleExportCSV = async () => {
    const rows = await buildExportRows();
    if (rows.length === 0) {
      toast.error('No data to export');
      return;
    }

    const header = [
      'Vendor Name',
      'Distributor Name',
      'Customer Name',
      'Project Name',
      'Product',
      'Serial/Contract Number',
      'Quantity',
      'Start Date',
      'End Date',
      'Status',
      'Remark'
    ];

    const escapeCSV = (val: string) => `"${(val ?? '').replace(/"/g, '""')}"`;

    const csvContent = [
      header.join(','),
      ...rows.map(r => [
        escapeCSV(r.vendorName),
        escapeCSV(r.distributorName),
        escapeCSV(r.customerName),
        escapeCSV(r.projectName),
        escapeCSV(r.product),
        escapeCSV(r.serialContractNumber),
        escapeCSV(r.quantity),
        escapeCSV(r.startDate),
        escapeCSV(r.endDate),
        escapeCSV(r.status),
        escapeCSV(r.remark)
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `licenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success('Exported CSV successfully');
  };

  // PDF export (print-to-PDF)
  const handleExportPDF = async () => {
    const rows = await buildExportRows();
    if (rows.length === 0) {
      toast.error('No data to export');
      return;
    }

    const tableRows = rows.map(r => `
    <tr>
      <td>${r.vendorName}</td>
      <td>${r.distributorName}</td>
      <td>${r.customerName}</td>
      <td>${r.projectName}</td>
      <td>${r.product}</td>
      <td>${r.serialContractNumber}</td>
      <td style="text-align:right">${r.quantity}</td>
      <td>${r.startDate}</td>
      <td>${r.endDate}</td>
      <td>${r.status}</td>
      <td>${r.remark}</td>
    </tr>
  `).join('');

    const html = `
    <html>
      <head>
        <title>Licenses Export</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #f5f5f5; }
          .meta { margin-top: 8px; text-align: center; color: #555; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>License Export</h1>
        <div class="meta">Generated on ${new Date().toLocaleDateString()}</div>
        <table>
          <thead>
            <tr>
              <th>Vendor Name</th>
              <th>Distributor Name</th>
              <th>Customer Name</th>
              <th>Project Name</th>
              <th>Product</th>
              <th>Serial/Contract Number</th>
              <th>Quantity</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
    </html>
  `;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
      toast.success('Opened Print dialog for PDF');
    } else {
      toast.error('Popup blocked. Please allow popups for this site.');
    }
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

  const { assignments } = useAuthStore.getState();
  const projectAssignFilterOptions = React.useMemo(() => {
    const all = (assigns || []).map(a => ({ value: a.name, label: a.name }));
    const base = [{ value: '', label: 'All Assigns' }];

    if (user?.role === 'admin') return base.concat(all);

    const allowed = new Set((assignments || []).map(a => a.trim()).filter(Boolean));
    const filtered = all.filter(o => allowed.has(o.value));

    return base.concat(filtered);
  }, [assigns, user?.role, assignments]);

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
        } catch { }
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

          <Button
            variant="secondary"
            icon={FileText}
            onClick={handleExportPDF}
          >
            Export PDF
          </Button>
          <Button
            icon={Download}
            onClick={handleExportCSV}
          >
            Export CSV
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
        {/* <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Licenses</p>
              <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <Grid className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card> */}

        {/* <Card>
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
        </Card> */}

        {/* <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Serial Expiring Soon</p>
              <p className="text-2xl font-bold text-gray-900">
                {nearExpiryCount}
              </p>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <Search className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </Card> */}


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
                  placeholder="Search licenses by name..."
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
                className="border-t border-gray-200 pt-3"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">

                  <Select
                    label="Vendor"
                    value={localFilters.vendor}
                    onChange={(value) => setLocalFilters(prev => ({ ...prev, vendor: value }))}
                    options={[
                      { value: '', label: 'All Vendor' },
                      ...getUniqueVendors()
                    ]}
                  />

                  <Input
                    label="Serial Number"
                    value={localFilters.serialNumber}
                    onChange={(value) => setLocalFilters(prev => ({ ...prev, serialNumber: value }))}
                    placeholder="Filter by serial number"
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
                    options={projectAssignFilterOptions}
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

                <div className="flex justify-end space-x-3">
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
            <div className="flex items-center justify-between border-t border-gray-200 pt-2">
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
              licenses={licenses.filter(l =>
                localFilters.search
                  ? (l.item?.toLowerCase().includes(localFilters.search.toLowerCase()) ||
                    l.item_description?.toLowerCase().includes(localFilters.search.toLowerCase()))
                  : true
              )}
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
    </div>
  );
};

