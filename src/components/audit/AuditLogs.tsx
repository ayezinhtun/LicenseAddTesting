import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Filter,
  Download,
  Search,
  Calendar,
  User,
  Eye,
  Edit,
  Trash2,
  Plus,
  FileText,
  Clock,
  ChevronDown,
  RefreshCw
} from 'lucide-react';
import { useAuditStore } from '../../store/auditStore';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export const AuditLogs: React.FC = () => {
  const {
    logs,
    isLoading,
    filters,
    totalCount,
    currentPage,
    pageSize,
    fetchAuditLogs,
    setFilters,
    clearFilters,
    exportAuditLogs,
    setTimeFilter,
    deleteAuditLog,
    clearAllAuditLogs
  } = useAuditStore();

  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  const actionOptions = [
    { value: 'create', label: 'Create' },
    { value: 'update', label: 'Update' },
    { value: 'delete', label: 'Delete' },
    { value: 'view', label: 'View' },
    { value: 'export', label: 'Export' },
    { value: 'login', label: 'Login' },
    { value: 'logout', label: 'Logout' }
  ];

  const entityTypeOptions = [
    { value: 'license', label: 'License' },
    { value: 'user', label: 'User' },
    { value: 'report', label: 'Report' },
    { value: 'notification', label: 'Notification' }
  ];

  const timeFilterOptions = [
    { value: 'recent', label: 'Recent (7 days)' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' }
  ];

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create': return Plus;
      case 'update': return Edit;
      case 'delete': return Trash2;
      case 'view': return Eye;
      case 'export': return Download;
      case 'login': return User;
      case 'logout': return User;
      default: return Activity;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'text-green-600 bg-green-50';
      case 'update': return 'text-blue-600 bg-blue-50';
      case 'delete': return 'text-red-600 bg-red-50';
      case 'view': return 'text-gray-600 bg-gray-50';
      case 'export': return 'text-purple-600 bg-purple-50';
      case 'login': return 'text-emerald-600 bg-emerald-50';
      case 'logout': return 'text-orange-600 bg-orange-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'create': return 'success';
      case 'update': return 'primary';
      case 'delete': return 'danger';
      case 'view': return 'secondary';
      case 'export': return 'info';
      default: return 'default';
    }
  };

  const applyFilters = () => {
    setFilters(localFilters);
    setShowFilters(false);
  };

  const resetFilters = () => {
    setLocalFilters({});
    clearFilters();
    setShowFilters(false);
  };

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm('Delete this audit log? This action cannot be undone.')) return;
    try {
      await deleteAuditLog(id);
      toast.success('Audit log deleted');
    } catch (error) {
      toast.error('Failed to delete audit log');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Delete ALL audit logs? This action cannot be undone.')) return;
    try {
      await clearAllAuditLogs();
      toast.success('All audit logs deleted');
    } catch (error) {
      toast.error('Failed to clear audit logs');
    }
  };

  const handleTimeFilterChange = (period: string) => {
    setTimeFilter(period as any);
    setLocalFilters({ ...localFilters, time_period: period as any });
  };

  const loadMore = () => {
    fetchAuditLogs(currentPage + 1);
  };

  const formatChanges = (changes: Record<string, any> | null) => {
    if (!changes) return 'No changes recorded';

    const changeEntries = Object.entries(changes);
    if (changeEntries.length === 0) return 'No changes recorded';

    return changeEntries.map(([key, value]) => {
      if (typeof value === 'object' && value.old !== undefined && value.new !== undefined) {
        return `${key}: ${value.old} → ${value.new}`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    }).join(', ');
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
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 mt-1">
            Track all system activities and changes
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="danger"
            icon={Trash2}
            onClick={handleClearAll}
            disabled={logs.length === 0}
          >
            Clear All
          </Button>
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={() => fetchAuditLogs(1)}
            loading={isLoading}
          >
            Refresh
          </Button>
          <Button
            variant="secondary"
            icon={Download}
            onClick={() => exportAuditLogs('csv')}
          >
            Export CSV
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-6"
      >
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Logs</p>
              <p className="text-2xl font-bold text-gray-900">{totalCount.toLocaleString()}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Today's Activity</p>
              <p className="text-2xl font-bold text-gray-900">
                {logs.filter(log =>
                  format(new Date(log.created_at), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                ).length}
              </p>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <Clock className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(logs.map(log => log.user_id)).size}
              </p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <User className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">License Changes</p>
              <p className="text-2xl font-bold text-gray-900">
                {logs.filter(log => log.entity_type === 'license').length}
              </p>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <FileText className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Time Filter Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="flex flex-wrap gap-2"
      >
        {timeFilterOptions.map((option) => (
          <Button
            key={option.value}
            variant={filters.time_period === option.value ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => handleTimeFilterChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Filters & Search</h3>
            <Button
              variant="ghost"
              size="sm"
              icon={ChevronDown}
              onClick={() => setShowFilters(!showFilters)}
              className={`transform transition-transform ${showFilters ? 'rotate-180' : ''}`}
            >
              {showFilters ? 'Hide' : 'Show'} Filters
            </Button>
          </div>

          <div className="space-y-4">
            {/* Search */}
            <Input
              placeholder="Search by user name, entity ID, or changes..."
              value={localFilters.search || ''}
              onChange={(value) => setLocalFilters({ ...localFilters, search: value })}
              icon={Search}
            />

            {/* Advanced Filters */}
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                <Select
                  label="Actions"
                  value={localFilters.action?.[0] || ''}
                  onChange={(value) => setLocalFilters({
                    ...localFilters,
                    action: value ? [value] : undefined
                  })}
                  options={[{ value: '', label: 'All Actions' }, ...actionOptions]}
                />

                <Select
                  label="Entity Type"
                  value={localFilters.entity_type?.[0] || ''}
                  onChange={(value) => setLocalFilters({
                    ...localFilters,
                    entity_type: value ? [value] : undefined
                  })}
                  options={[{ value: '', label: 'All Types' }, ...entityTypeOptions]}
                />

                <Input
                  label="User ID"
                  value={localFilters.user_id || ''}
                  onChange={(value) => setLocalFilters({ ...localFilters, user_id: value })}
                  placeholder="Filter by user ID"
                />

                <Input
                  label="Date From"
                  type="date"
                  value={localFilters.date_range?.start || ''}
                  onChange={(value) => setLocalFilters({
                    ...localFilters,
                    date_range: {
                      ...localFilters.date_range,
                      start: value,
                      end: localFilters.date_range?.end || ''
                    }
                  })}
                />

                <Input
                  label="Date To"
                  type="date"
                  value={localFilters.date_range?.end || ''}
                  onChange={(value) => setLocalFilters({
                    ...localFilters,
                    date_range: {
                      ...localFilters.date_range,
                      start: localFilters.date_range?.start || '',
                      end: value
                    }
                  })}
                />
              </motion.div>
            )}

            {/* Filter Actions */}
            <div className="flex justify-end space-x-3">
              <Button variant="secondary" onClick={resetFilters}>
                Clear Filters
              </Button>
              <Button onClick={applyFilters} icon={Filter}>
                Apply Filters
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Audit Logs List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card>
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Activity Timeline</h3>
            <p className="text-sm text-gray-500 mt-1">
              Showing {logs.length} of {totalCount} total logs
            </p>
          </div>

          <div className="divide-y divide-gray-100">
            {isLoading && logs.length === 0 ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading audit logs...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center">
                <Activity className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No audit logs found</h3>
                <p className="text-gray-500">No activities match your current filters.</p>
              </div>
            ) : (
              logs.map((log, index) => {
                const ActionIcon = getActionIcon(log.action);
                const actionColor = getActionColor(log.action);

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="p-6 hover:bg-gray-50 transition-colors duration-200"
                  >
                    <div className="flex items-start space-x-4">
                      <div className={`${actionColor} p-2 rounded-lg flex-shrink-0`}>
                        <ActionIcon className="h-5 w-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <h4 className="text-sm font-semibold text-gray-900 capitalize">
                              {log.action} {log.entity_type}
                            </h4>
                            <Badge
                              variant={getActionBadgeVariant(log.action) as any}
                              size="sm"
                            >
                              {log.action}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(log.created_at), 'MMM dd, yyyy HH:mm')}</span>
                              <span>•</span>
                              <span>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                              onClick={() => handleDeleteLog(log.id)}
                              className="text-gray-400 hover:text-red-600"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span><strong>User:</strong> {log.user_name}</span>
                            <span><strong>Entity ID:</strong> {log.entity_id}</span>
                            {log.ip_address && (
                              <span><strong>IP:</strong> {log.ip_address}</span>
                            )}
                          </div>

                          {log.changes && (
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <p className="text-xs font-medium text-gray-700 mb-1">Changes:</p>
                              <p className="text-xs text-gray-600 font-mono">
                                {formatChanges(log.changes)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Load More */}
          {logs.length < totalCount && (
            <div className="p-6 border-t border-gray-200 text-center">
              <Button
                variant="secondary"
                onClick={loadMore}
                loading={isLoading}
              >
                Load More Logs
              </Button>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
};