import React, { useState, useEffect } from 'react';
import { useLicenseStore, RenewalRecord } from '../../store/licenseStore';
import { Edit, Trash2, Eye, Calendar, Copy } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { License } from '../../store/licenseStore';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

interface LicenseTableProps {
  licenses: License[];
  onEdit: (license: License) => void;
  onDelete: (id: string) => void;
  onView?: (license: License) => void;
  selectedLicenses?: string[];
  onSelectLicense?: (licenseId: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
}

export const LicenseTable: React.FC<LicenseTableProps> = ({
  licenses,
  onEdit,
  onDelete,
  onView,
  selectedLicenses = [],
  onSelectLicense,
  onSelectAll
}) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { fetchRenewalHistory } = useLicenseStore();
const [historyCache, setHistoryCache] = useState<Record<string, RenewalRecord[]>>({});
const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

// Prefetch history for all visible licenses (newest first)
useEffect(() => {
  let cancelled = false;
  (async () => {
    setLoadingHistory(true);
    try {
      const next: Record<string, RenewalRecord[]> = {};
      for (const l of licenses) {
        try {
          const data = await fetchRenewalHistory(l.id);
          next[l.id] = data || [];
        } catch {
          next[l.id] = [];
        }
      }
      if (!cancelled) setHistoryCache(next);
    } finally {
      if (!cancelled) setLoadingHistory(false);
    }
  })();
  return () => { cancelled = true; };
}, [licenses]);

  // const getExpiryStatus = (endDate: string) => {
  //   const daysUntilExpiry = differenceInDays(parseISO(endDate), new Date());
    
  //   if (daysUntilExpiry < 0) {
  //     return { 
  //       status: 'Expired', 
  //       color: 'bg-red-100 text-red-800 border-red-200', 
  //       days: Math.abs(daysUntilExpiry),
  //       variant: 'danger' as const
  //     };
  //   } else if (daysUntilExpiry <= 7) {
  //     return { 
  //       status: 'Critical', 
  //       color: 'bg-red-100 text-red-800 border-red-200', 
  //       days: daysUntilExpiry,
  //       variant: 'danger' as const
  //     };
  //   } else if (daysUntilExpiry <= 30) {
  //     return { 
  //       status: 'Warning', 
  //       color: 'bg-orange-100 text-orange-800 border-orange-200', 
  //       days: daysUntilExpiry,
  //       variant: 'warning' as const
  //     };
  //   } else {
  //     return { 
  //       status: 'Active', 
  //       color: 'bg-green-100 text-green-800 border-green-200', 
  //       days: daysUntilExpiry,
  //       variant: 'success' as const
  //     };
  //   }
  // };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'primary';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'success';
      case 'expired': return 'danger';
      case 'suspended': return 'warning';
      case 'in_progress': return 'warning';
      case 'pending': return 'info';
      default: return 'default';
    }
  };

  const handleViewDetails = (license: License) => {
    if (onView) {
      onView(license);
    } else {
      navigate(`/licenses/${license.id}`);
    }
  };

  const handleCopySerial = (serialNumber: string) => {
    navigator.clipboard.writeText(serialNumber);
    toast.success('Serial number copied to clipboard');
  };

  // URL open action removed

  const handleSelectLicense = (licenseId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (onSelectLicense) {
      onSelectLicense(licenseId, event.target.checked);
    }
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (onSelectAll) {
      onSelectAll(event.target.checked);
    }
  };

  const isAllSelected = licenses.length > 0 && selectedLicenses.length === licenses.length;
  const isIndeterminate = selectedLicenses.length > 0 && selectedLicenses.length < licenses.length;

  if (licenses.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
          <Calendar className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No licenses found</h3>
        <p className="text-gray-500">Get started by adding your first license.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {onSelectLicense && (
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isIndeterminate;
                  }}
                  onChange={handleSelectAll}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </th>
            )}
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              License Details
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Project & Customer
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Project Assign
            </th>
            {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Dates
            </th> */}
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status & Priority
            </th>
           {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Expiry Status
            </th>  */}
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {licenses.map((license) => {
            const isSelected = selectedLicenses.includes(license.id);

            return (
              <React.Fragment key={license.id}>
                {/* Current license row */}
                <tr
                  className={`hover:bg-gray-50 transition-colors duration-150 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
                  onClick={() => handleViewDetails(license)}
                >
                  {onSelectLicense && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectLicense(license.id, e)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </td>
                  )}

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                        {license.item}
                      </div>
                      <div className="text-sm text-gray-500">{license.vendor}</div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-400 font-mono">
                          {license.serial_number}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Copy}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopySerial(license.serial_number);
                          }}
                          className="text-gray-400 hover:text-gray-600 p-1"
                        />
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="text-sm text-gray-900 font-medium">
                        {license.project_name}
                      </div>
                      <div className="text-sm text-gray-500">{license.customer_name}</div>
                      <div className="text-xs text-gray-400">{license.business_unit}</div>
                      <div className="text-xs text-gray-500">{license.user_name}</div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {(license as any).project_assign || '-'}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="space-y-2">
                      <Badge variant={getStatusColor(license.status) as any} size="sm">
                        {license.status.charAt(0).toUpperCase() + license.status.slice(1)}
                      </Badge>
                      <Badge variant={getPriorityColor(license.priority) as any} size="sm">
                        {license.priority.charAt(0).toUpperCase() + license.priority.slice(1)}
                      </Badge>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Eye}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(license);
                        }}
                        className="text-gray-400 hover:text-blue-600"
                        title="View Details"
                      />

                      {user?.role !== 'user' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Edit}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(license);
                          }}
                          className="text-gray-400 hover:text-blue-600"
                          title="Edit License"
                        />
                      )}

                      {user?.role === 'admin' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Are you sure you want to delete this license?')) {
                              onDelete(license.id);
                            }
                          }}
                          className="text-gray-400 hover:text-red-600"
                          title="Delete License"
                        />
                      )}
                    </div>
                  </td>
                </tr>

                {/* OLD rows under the current license row (ladder style, indented) */}
                <tr className="bg-white">
                  <td colSpan={onSelectLicense ? 6 : 5} className="px-6 py-2">
                    {loadingHistory ? (
                      <div className="text-sm text-gray-500">Loading history...</div>
                    ) : (
                      <div className="space-y-2">
                        {(historyCache[license.id] || []).length === 0 ? null : (
                          <div className="text-xs text-gray-500 font-medium">Old License Data</div>
                        )}

                        {(historyCache[license.id] || []).map((renewal) => (
                          <div
                            key={renewal.id}
                            className="border rounded-md bg-gray-50"
                            style={{ marginLeft: '1.25rem' }}
                          >
                           <div className="px-3 py-2 border-b text-xs text-gray-600 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {renewal.renewal_date
                                  ? new Date(renewal.renewal_date).toLocaleDateString()
                                  : '-'}
                              </span>
                              <span className="text-gray-500">• Old cost:</span>
                              <span className="font-medium">
                                {Number(renewal.cost ?? 0).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500">
                              Prev end: {renewal.previous_end_date
                                ? new Date(renewal.previous_end_date).toLocaleDateString()
                                : '-'}
                            </div>
                          </div>

                            <div className="px-3 py-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                              <div>
                                <div className="text-xs text-gray-500">Product (old)</div>
                                <div className="text-gray-900">{renewal.prev_product_name || '-'}</div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Serial (old)</div>
                                <div className="text-gray-900">{renewal.prev_serial_no || '-'}</div>
                                <div className="text-[11px] text-gray-500">
                                  {(renewal.prev_serial_start_date
                                    ? new Date(renewal.prev_serial_start_date).toLocaleDateString()
                                    : '-')}
                                  {' '}→{' '}
                                  {(renewal.prev_serial_end_date
                                    ? new Date(renewal.prev_serial_end_date).toLocaleDateString()
                                    : '-')}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-gray-500">Remark (old)</div>
                                <div className="text-gray-900 whitespace-pre-line">
                                  {renewal.prev_remark || '-'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>

      </table>
    </div>
  );
};