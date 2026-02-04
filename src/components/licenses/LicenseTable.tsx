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
                  

                  <td className="px-6 py-2 whitespace-nowrap">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                        {license.item}
                      </div>
                      <div className="text-sm text-gray-500">{license.vendor}</div>


                      {(license as any).license_serials?.length ? (
                        
                        <div className="flex flex-wrap gap-1 mt-1">
                          
                          {(license as any).license_serials.map((s: any) => (
                            
                            <span
                              key={s.serial_or_contract}
                              className="text-xs font-mono text-gray-600 bg-gray-100 rounded px-1 py-0.5"
                            >
                              {s.serial_or_contract} \ {s.start_date} - {s.end_date}
                            </span>
                          ))}
                        </div>
                      ) : null}
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
              </React.Fragment>
            );
          })}
        </tbody>

      </table>
    </div>
  );
};