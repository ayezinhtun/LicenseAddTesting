import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useCustomerStore } from '../../store/customerStore';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';
import { Card } from '../common/Card';
import { Plus, Search, Filter, Edit, Trash2, SortAsc, SortDesc } from 'lucide-react';
import toast from 'react-hot-toast';

type SortOrder = 'asc' | 'desc';

export const CustomerPage: React.FC = () => {
  const { customers, isLoading, fetchCustomers, addCustomer, updateCustomer, deleteCustomer } = useCustomerStore();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [company_name, setCompanyName] = useState('');
  const [contact_person, setContactPerson] = useState('');
  const [contact_email, setContactEmail] = useState('');
  const [contact_number, setContactNumber] = useState('');
  const [address, setAddress] = useState('');

  // Filters/sort
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'company_name' | 'created_at'>('company_name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const renderSortIcon = (field: 'company_name' | 'created_at') => {
    if (sortBy !== field) return undefined;
    return sortOrder === 'asc' ? SortAsc : SortDesc;
  };

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const resetForm = () => {
    setEditingId(null);
    setCompanyName('');
    setContactPerson('');
    setContactEmail('');
    setContactNumber('');
    setAddress('');
  };

  const openCreate = () => { resetForm(); setShowForm(true); };
  const openEdit = (c: any) => {
    setEditingId(c.id);
    setCompanyName(c.company_name || '');
    setContactPerson(c.contact_person || '');
    setContactEmail(c.contact_email || '');
    setContactNumber(c.contact_number || '');
    setAddress(c.address || '');
    setShowForm(true);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company_name.trim()) return;

    const payload = {
      company_name: company_name.trim(),
      contact_person: contact_person.trim() || null,
      contact_email: contact_email.trim() || null,
      contact_number: contact_number.trim() || null,
      address: address.trim() || null,
    };

    try {
      if (editingId) {
        await updateCustomer(editingId, payload);
        toast.success('Customer updated successfully');
      } else {
        await addCustomer(payload as any);
        toast.success('Customer added successfully');
      }
      resetForm();
      setShowForm(false);
    } catch (error) {
      toast.error('Something went wrong. Please try again.');
    }
  };

  const filtered = useMemo(() => {
    let list = customers || [];
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(c =>
        c.company_name.toLowerCase().includes(s) ||
        (c.contact_person || '').toLowerCase().includes(s) ||
        (c.contact_email || '').toLowerCase().includes(s)
      );
    }
    list = [...list].sort((a: any, b: any) => {
      const dir = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'company_name') return a.company_name.localeCompare(b.company_name) * dir;
      const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
      return (aT - bT) * dir;
    });
    return list;
  }, [customers, search, sortBy, sortOrder]);

  const handleSort = (field: 'company_name' | 'created_at') => {
    if (sortBy === field) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('asc'); }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
          <p className="text-gray-600 mt-1">Manage your customer list</p>
        </div>
        <div className="flex space-x-3">
          <Button icon={Plus} onClick={openCreate}>Add Customer</Button>
        </div>
      </motion.div>

      <Card>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Input placeholder="Search by name, contact, email..." value={search} onChange={setSearch} icon={Search} />
            </div>
            <Button variant="secondary" icon={Filter} onClick={() => setShowFilters(!showFilters)}>
              Filters
            </Button>
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">Sort by:</span>
              <div className="flex space-x-2">
                {[
                  { field: 'company_name' as const, label: 'Name' },
                  { field: 'created_at' as const, label: 'Created' },
                ].map(({ field, label }) => (
                  <Button
                    key={field}
                    variant={sortBy === field ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => handleSort(field)}
                    icon={sortBy === field ? renderSortIcon(field) : undefined}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            {/* Optional right-side info */}
            {/* <div className="text-sm text-gray-500">Showing {filtered.length} customers</div> */}
          </div>

          {showFilters && (
            <div className="border-t border-gray-200 pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sort by</label>
                <select className="block w-full rounded-lg border-gray-300" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                  <option value="company_name">Name</option>
                  <option value="created_at">Created</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
                <select className="block w-full rounded-lg border-gray-300" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)}>
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card padding="none">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading customers...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <h3 className="text-sm font-medium text-gray-900">No customers</h3>
            <p className="mt-1 text-sm text-gray-500">Add your first customer to get started.</p>
            <div className="mt-6">
              <Button icon={Plus} onClick={openCreate}>Add Customer</Button>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            <div className="px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider grid grid-cols-12">
              <div className="col-span-6">Company</div>
              <div className="col-span-3">Contact</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>
            {filtered.map(c => (
              <div key={c.id} className="px-4 py-3 grid grid-cols-12 items-center">
                <div className="col-span-6">
                  <div className="font-medium text-gray-900">{c.company_name}</div>
                  <div className="text-xs text-gray-500">Created {c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}</div>
                </div>
                <div className="col-span-3 text-sm text-gray-700">
                  <div>{c.contact_person || '-'}</div>
                  <div className="text-xs text-gray-500">{c.contact_email || ''}</div>
                </div>
                <div className="col-span-3">
                  <div className="flex items-center justify-end space-x-1">
                    <Button variant="ghost" size="sm" icon={Edit} onClick={() => openEdit(c)} title="Edit" className="text-gray-400 hover:text-blue-600" />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={async (e) => {
                        e.stopPropagation();

                        if (!window.confirm('Are you sure you want to delete this customer?')) return;

                        try {
                          await deleteCustomer(c.id);
                          toast.success('Customer deleted successfully');
                        } catch (error) {
                          toast.error('Failed to delete customer');
                        }
                      }}
                      className="text-gray-400 hover:text-red-600"
                      title="Delete Customer"
                    />
                  </div>
                </div>
              </div>
            ))}


          </div>
        )}
      </Card>

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingId ? 'Edit Customer' : 'Add New Customer'} maxWidth="lg">
        <form onSubmit={onSubmit} className="space-y-4">
          <Input label="Company Name" value={company_name} onChange={setCompanyName} required placeholder="e.g., ABC Co., Ltd." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Contact Person" value={contact_person} onChange={setContactPerson} />
            <Input label="Contact Email" type="email" value={contact_email} onChange={setContactEmail} />
            <Input label="Contact Number" value={contact_number} onChange={setContactNumber} />
            <Input label="Address" value={address} onChange={setAddress} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            <Button type="submit">{editingId ? 'Update Customer' : 'Create Customer'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};