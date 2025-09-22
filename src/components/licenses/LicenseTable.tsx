import React, { useState } from 'react';
import { Edit, Trash2, Eye, Calendar, MoreVertical, Copy } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { License } from '../../store/licenseStore';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

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
  const [selectedLicense, setSelectedLicense] = useState<string | null>(null);

  const getExpiryStatus = (endDate: string) => {
    const daysUntilExpiry = differenceInDays(parseISO(endDate), new Date());
    
    if (daysUntilExpiry < 0) {
      return { 
        status: 'Expired', 
        color: 'bg-red-100 text-red-800 border-red-200', 
        days: Math.abs(daysUntilExpiry),
        variant: 'danger' as const
      };
    } else if (daysUntilExpiry <= 7) {
      return { 
        status: 'Critical', 
        color: 'bg-red-100 text-red-800 border-red-200', 
        days: daysUntilExpiry,
        variant: 'danger' as const
      };
    } else if (daysUntilExpiry <= 30) {
      return { 
        status: 'Warning', 
        color: 'bg-orange-100 text-orange-800 border-orange-200', 
        days: daysUntilExpiry,
        variant: 'warning' as const
      };
    } else {
      return { 
        status: 'Active', 
        color: 'bg-green-100 text-green-800 border-green-200', 
        days: daysUntilExpiry,
        variant: 'success' as const
      };
    }
  };

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

  const handleOpenUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

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
              Dates
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status & Priority
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Expiry Status
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {licenses.map((license) => {
            const expiryInfo = getExpiryStatus(license.license_end_date);
            const isSelected = selectedLicenses.includes(license.id);
            
            return (
              <tr 
                key={license.id} 
                className={`hover:bg-gray-50 transition-colors duration-150 cursor-pointer ${
                  isSelected ? 'bg-blue-50' : ''
                }`}
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
                    {/* Tags removed */}
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
                  <div className="space-y-1">
                    <div className="text-sm text-gray-900 flex items-center">
                      <Calendar className="w-3 h-3 mr-1 text-gray-400" />
                      {format(parseISO(license.license_start_date), 'MMM dd, yyyy')}
                    </div>
                    <div className="text-sm text-gray-500">
                      to {format(parseISO(license.license_end_date), 'MMM dd, yyyy')}
                    </div>
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="space-y-2">
                    <Badge 
                      variant={getStatusColor(license.status) as any}
                      size="sm"
                    >
                      {license.status.charAt(0).toUpperCase() + license.status.slice(1)}
                    </Badge>
                    <Badge 
                      variant={getPriorityColor(license.priority) as any}
                      size="sm"
                    >
                      {license.priority.charAt(0).toUpperCase() + license.priority.slice(1)}
                    </Badge>
                  </div>
                </td>
                
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="space-y-1">
                    <Badge variant={expiryInfo.variant} size="sm">
                      {expiryInfo.status}
                    </Badge>
                    <div className="text-xs text-gray-500">
                      {expiryInfo.status === 'Expired' 
                        ? `${expiryInfo.days} days ago`
                        : `${expiryInfo.days} days left`
                      }
                    </div>
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
                    
                    {/* URL open action removed */}
                    
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
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};