import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useProjectAssignStore } from '../../store/projectAssignStore';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Modal } from '../common/Modal';
import { Card } from '../common/Card';
import { Plus, Search, Filter, Edit, Trash2, SortAsc, SortDesc } from 'lucide-react';

type SortOrder = 'asc' | 'desc';

export const ProjectAssignPage: React.FC = () => {
  const { assigns, isLoading, fetchProjectAssigns, addProjectAssign, updateProjectAssign, deleteProjectAssign } = useProjectAssignStore();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');

  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'created_at'>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchProjectAssigns();
  }, [fetchProjectAssigns]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editingId) {
      await updateProjectAssign(editingId, name.trim());
    } else {
      await addProjectAssign(name.trim());
    }
    resetForm();
    setShowForm(false);
  };

  const filtered = useMemo(() => {
    let list = assigns || [];

    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(v => v.name.toLowerCase().includes(s));
    }

    list = [...list].sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1;
      if (sortBy === 'name') return a.name.localeCompare(b.name) * dir;
      const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
      return (aT - bT) * dir;
    });

    return list;
  }, [assigns, search, sortBy, sortOrder]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  const handleSort = (field: 'name' | 'created_at') => {
    if (sortBy === field) setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Project Assign Management</h1>
          <p className="text-gray-600 mt-1">Manage locations/groups used in license project assignment</p>
        </div>
        <div className="flex space-x-3">
          <Button icon={Plus} onClick={() => { resetForm(); setShowForm(true); }}>
            Add Project Assign
          </Button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Project Assigns</p>
                <p className="text-2xl font-bold text-gray-900">{assigns.length}</p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <Plus className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </Card>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
        <Card>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <Input placeholder="Search by name..." value={search} onChange={setSearch} icon={Search} />
              </div>
              <Button variant="secondary" icon={Filter} onClick={() => setShowFilters(!showFilters)} className={showFilters ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}>
                Filters
              </Button>
            </div>

            {showFilters && (
              <div className="border-t border-gray-200 pt-4">
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
              </div>
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
              <div className="text-sm text-gray-500">Showing {paged.length} of {total}</div>
            </div>
          </div>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
        <Card padding="none">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading...</span>
            </div>
          ) : paged.length === 0 ? (
            <div className="py-12 text-center">
              <h3 className="text-sm font-medium text-gray-900">No items</h3>
              <p className="mt-1 text-sm text-gray-500">Add your first project assign.</p>
              <div className="mt-6">
                <Button icon={Plus} onClick={() => { resetForm(); setShowForm(true); }}>Add Project Assign</Button>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              <div className="px-4 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider grid grid-cols-12">
                <div className="col-span-8">Name</div>
                <div className="col-span-4 text-right">Actions</div>
              </div>
              {paged.map(v => (
                <div key={v.id} className="px-4 py-3 grid grid-cols-12 items-center">
                  <div className="col-span-8">
                    <div className="font-medium text-gray-900">{v.name}</div>
                    <div className="text-xs text-gray-500">Created {v.created_at ? new Date(v.created_at).toLocaleDateString() : '-'}</div>
                  </div>
                  <div className="col-span-4">
                    <div className="flex items-center justify-end space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Edit}
                        onClick={(e) => { e.stopPropagation(); setEditingId(v.id); setName(v.name); setShowForm(true); }}
                        className="text-gray-400 hover:text-blue-600"
                        title="Edit"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={async (e) => { e.stopPropagation(); if (window.confirm('Delete this item?')) { await deleteProjectAssign(v.id); } }}
                        className="text-gray-400 hover:text-red-600"
                        title="Delete"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </motion.div>

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingId ? 'Edit Project Assign' : 'Add New Project Assign'} maxWidth="lg">
        <form onSubmit={onSubmit} className="space-y-4">
          <Input label="Name" value={name} onChange={setName} required placeholder="e.g., NPT, YGN, MPT" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            <Button type="submit">{editingId ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};