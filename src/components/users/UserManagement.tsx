import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Select } from '../common/Select';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { Input } from '../common/Input';
import { Search, RefreshCw, Users, UserCheck, UserX, Save as SaveIcon, Trash2 } from 'lucide-react';

// Expected schema in public.user_profiles:
// - id (uuid, pk)
// - user_id (uuid, fk to auth.users)
// - email (text)
// - full_name (text)
// - role (enum: 'admin' | 'super_user' | 'user')
// - project_assign (text: NPT | YGN | MPT | null)
// - status (enum: 'approved' | 'rejected' | 'pending' default 'pending')
// - created_at, updated_at

type Role = 'admin' | 'super_user' | 'user';
type Assign = '' | 'NPT' | 'YGN' | 'MPT';
type Status = 'approved' | 'rejected' | 'pending';

interface ProfileRow {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  role: Role;
  project_assign: Assign | null; // legacy single; not used for save
  assignments: Assign[]; // multiple via user_project_assigns
  status: Status;
  created_at?: string;
  updated_at?: string;
}

export const UserManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [rows, setRows] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const roleOptions = useMemo(() => ([
    { value: 'admin', label: 'Admin' },
    { value: 'super_user', label: 'Super User' },
    { value: 'user', label: 'User' },
  ]), []);

  const statusOptions = useMemo(() => ([
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ]), []);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: pErr } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (pErr) throw pErr;

      const { data: assigns, error: aErr } = await supabase
        .from('user_project_assigns')
        .select('user_id, project_assign');
      if (aErr) throw aErr;

      const map = new Map<string, Assign[]>();
      (assigns || []).forEach((r: any) => {
        const key = r.user_id as string;
        const val = r.project_assign as Assign;
        if (!map.has(key)) map.set(key, []);
        const arr = map.get(key)!;
        if (!arr.includes(val)) arr.push(val);
      });

      const allowedRoles: Role[] = ['admin','super_user','user'];
      const allowedStatus: Status[] = ['pending','approved','rejected'];
      const merged = (profiles as any[]).map((p) => {
        const roleRaw = (p.role ?? '').toString().trim();
        const statusRaw = (p.status ?? '').toString().trim();
        const roleNorm: Role = (allowedRoles.includes(roleRaw as Role) ? roleRaw : 'user') as Role;
        const statusNorm: Status = (allowedStatus.includes(statusRaw as Status) ? statusRaw : 'pending') as Status;
        return {
          ...p,
          role: roleNorm,
          status: statusNorm,
          assignments: map.get(p.user_id) || [],
        } as ProfileRow;
      });

      setRows(merged as any);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load users. Ensure table user_profiles exists and RLS allows admin read.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (row: ProfileRow) => {
    if (!row.user_id) return;
    const current = useAuthStore.getState().user;
    if (current && current.id === row.user_id) {
      toast.error('You cannot delete your own account while signed in.');
      return;
    }
    const confirmed = window.confirm(`Delete user ${row.email}? This removes their profile and assignments. The auth account will remain.`);
    if (!confirmed) return;
    try {
      setSavingId(row.id);
      // Remove assignments first
      const { error: delAssignErr } = await supabase
        .from('user_project_assigns')
        .delete()
        .eq('user_id', row.user_id);
      if (delAssignErr) throw delAssignErr;

      // Delete profile row
      const { error: delProfileErr } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', row.id);
      if (delProfileErr) throw delProfileErr;

      toast.success('User profile deleted');
      await fetchProfiles();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to delete user');
    } finally {
      setSavingId(null);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const patchRow = (id: string, patch: Partial<ProfileRow>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const handleSave = async (row: ProfileRow) => {
    try {
      setSavingId(row.id);
      const payload = {
        role: row.role,
        // project_assign not used here; multiple assignments managed separately
        status: row.status,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('user_profiles')
        .update(payload)
        .eq('id', row.id);
      if (error) throw error;
      toast.success('User updated');
      // Refresh table from DB to ensure UI matches persisted state
      await fetchProfiles();
      // If admin updated their own profile, refresh auth store snapshot
      const current = useAuthStore.getState().user;
      if (current && current.id === row.user_id) {
        await useAuthStore.getState().getCurrentUser();
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Update failed');
      fetchProfiles(); // revert on failure
    } finally {
      setSavingId(null);
    }
  };

  const toggleAssign = async (row: ProfileRow, assign: Exclude<Assign, ''>) => {
    if (!row.user_id) return;
    try {
      setSavingId(row.id);
      const hasIt = row.assignments.includes(assign);
      if (hasIt) {
        const { error } = await supabase
          .from('user_project_assigns')
          .delete()
          .eq('user_id', row.user_id)
          .eq('project_assign', assign);
        if (error) throw error;
        patchRow(row.id, { assignments: row.assignments.filter(a => a !== assign) });
      } else {
        const { error } = await supabase
          .from('user_project_assigns')
          .insert([{ user_id: row.user_id, project_assign: assign }]);
        if (error) throw error;
        patchRow(row.id, { assignments: [...row.assignments, assign] });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to update assignment');
    } finally {
      setSavingId(null);
    }
  };

  if (user?.role !== 'admin' && user?.role !== 'super_user') {
    return (
      <div className="p-6">
        <Card>
          <div className="p-6 text-red-600">Access denied. Admins only.</div>
        </Card>
      </div>
    );
  }

  // UI-only client-side search (does not change your data logic)
  const [search, setSearch] = useState('');
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter(r =>
      (r.full_name || '').toLowerCase().includes(s) ||
      (r.email || '').toLowerCase().includes(s)
    );
  }, [rows, search]);

  const total = rows.length;
  const totalApproved = rows.filter(r => r.status === 'approved').length;
  const totalPending = rows.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage roles, project assignment and approval status</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" icon={RefreshCw} onClick={fetchProfiles}>
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{total}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-gray-900">{totalApproved}</p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <UserCheck className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{totalPending}</p>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <UserX className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={setSearch}
                icon={Search}
              />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project Assign(s)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-center text-gray-500">Loading users...</td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-center text-gray-500">No users found.</td>
                </tr>
              ) : (
                filteredRows.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u.full_name || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{u.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Select
                        value={u.role}
                        onChange={(value) => patchRow(u.id, { role: value as Role })}
                        options={roleOptions}
                        className="w-40"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-3">
                        {(['NPT','YGN','MPT'] as Assign[]).map((a) => (
                          <label key={a} className="inline-flex items-center gap-2 text-gray-700">
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              checked={u.assignments?.includes(a as any) || false}
                              onChange={() => toggleAssign(u, a as any)}
                            />
                            <span className="text-sm">{a}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Select
                        value={u.status}
                        onChange={(value) => patchRow(u.id, { status: value as Status })}
                        options={statusOptions}
                        className="w-40"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <Button
                          size="sm"
                          onClick={() => handleSave(u)}
                          disabled={savingId === u.id}
                          icon={SaveIcon}
                        >
                          {savingId === u.id ? 'Saving...' : 'Save'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => handleDelete(u)}
                          disabled={savingId === u.id}
                          className="text-gray-400 hover:text-red-600"
                          title="Delete user"
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};