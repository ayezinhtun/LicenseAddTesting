import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useVendorStore } from '../../store/vendorStore';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Modal } from '../common/Modal';
import { Card } from '../common/Card';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Edit,
  Trash2,
  SortAsc,
  SortDesc,
} from 'lucide-react';

type SortOrder = 'asc' | 'desc';

export const VendorPage: React.FC = () => {
  const { vendors, isLoading, fetchVendors, addVendor, updateVendor, deleteVendor } = useVendorStore();

  // UI state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');

  // Filters/sort (client-side, mirrors LicenseManagement feel)
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'created_at'>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Simple client-side pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editingId) {
      await updateVendor(editingId, name.trim());
    } else {
      await addVendor(name.trim());
    }
    resetForm();
    setShowForm(false);
  };

  const filtered = useMemo(() => {
    let list = vendors || [];

    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(v => v.name.toLowerCase().includes(s));
    }

    list = [...list].sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name) * dir;
      }
      const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
      return (aT - bT) * dir;
    });

    return list;
  }, [vendors, search, sortBy, sortOrder]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  const handleSort = (field: 'name' | 'created_at') => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

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
        <h1>vendor page test</h1>
          <h1 className="text-3xl font-bold text-gray-900">Vendor Management</h1>
          <p className="text-gray-600 mt-1">
            Manage your approved vendor list used in licenses
          </p>
        </div>
        <div className="flex space-x-3">
          <Button icon={Plus} onClick={() => { resetForm(); setShowForm(true); }}>
            Add Vendor
          </Button>
        </div>
      </motion.div>

      {/* Stats (simple, consistent with card visuals) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Vendors</p>
                <p className="text-2xl font-bold text-gray-900">{vendors.length}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                {/* Using Plus icon as a placeholder badge */}
                <Plus className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>
        </div>
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <Input
                  placeholder="Search vendors by name..."
                  value={search}
                  onChange={setSearch}
                  icon={Search}
                />
              </div>
              <Button
                variant="secondary"
                icon={Filter}
                onClick={() => setShowFilters(!showFilters)}
                className={showFilters ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}
              >
                Filters
              </Button>
            </div>

            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="border-t border-gray-200 pt-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Select
                    label="Sort by"
                    value={sortBy}
                    onChange={(value) => setSortBy(value as 'name' | 'created_at')}
                    options={[
                      { value: 'name', label: 'Name' },
                      { value: 'created_at', label: 'Created' },
                    ]}
                  />
                  <Select
                    label="Order"
                    value={sortOrder}
                    onChange={(value) => setSortOrder(value as SortOrder)}
                    options={[
                      { value: 'asc', label: 'Ascending' },
                      { value: 'desc', label: 'Descending' },
                    ]}
                  />
                </div>
              </motion.div>
            )}

            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700">Sort by:</span>
                <div className="flex space-x-2">
                  {[
                    { field: 'name' as const, label: 'Name' },
                    { field: 'created_at' as const, label: 'Created' },
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
                Showing {paged.length} of {total} vendors
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Vendor list */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        <Card padding="none">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading vendors...</span>
            </div>
          ) : paged.length === 0 ? (
            <div className="py-12 text-center">
              <h3 className="text-sm font-medium text-gray-900">No vendors</h3>
              <p className="mt-1 text-sm text-gray-500">
                Add your first vendor to get started.
              </p>
              <div className="mt-6">
                <Button icon={Plus} onClick={() => { resetForm(); setShowForm(true); }}>
                  Add Vendor
                </Button>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {/* Table header */}
              <div className="px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider grid grid-cols-12">
                <div className="col-span-8">Vendor Name</div>
                <div className="col-span-4 text-right">Actions</div>
              </div>

              {/* Rows */}
              {paged.map(v => (
                <div key={v.id} className="px-4 py-3 grid grid-cols-12 items-center">
                    <div className="col-span-8">
                    <div className="font-medium text-gray-900">{v.name}</div>
                    <div className="text-xs text-gray-500">
                        Created {v.created_at ? new Date(v.created_at).toLocaleDateString() : '-'}
                    </div>
                    </div>
                    <div className="col-span-4">
                    <div className="flex items-center justify-end space-x-1">
                        <Button
                        variant="ghost"
                        size="sm"
                        icon={Edit}
                        onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(v.id);
                            setName(v.name);
                            setShowForm(true);
                        }}
                        className="text-gray-400 hover:text-blue-600"
                        title="Edit Vendor"
                        />
                        <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm('Are you sure you want to delete this vendor?')) {
                            await deleteVendor(v.id);
                            }
                        }}
                        className="text-gray-400 hover:text-red-600"
                        title="Delete Vendor"
                        />
                    </div>
                    </div>
                </div>
              ))}

              {/* Pagination footer */}
              {/* <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div> */}
            </div>
          )}
        </Card>
      </motion.div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => { setShowForm(false); resetForm(); }}
        title={editingId ? 'Edit Vendor' : 'Add New Vendor'}
        maxWidth="lg"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Vendor Name"
            value={name}
            onChange={setName}
            required
            placeholder="e.g., Cisco, Lenovo"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setShowForm(false); resetForm(); }}
            >
              Cancel
            </Button>
            <Button type="submit">
              {editingId ? 'Update Vendor' : 'Create Vendor'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};