import React, { useState } from 'react';
import { Download, FileText, BarChart3, Calendar, DollarSign } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useLicenseStore } from '../../store/licenseStore';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

export const Reports: React.FC = () => {
  const [filters, setFilters] = useState({
    vendor: '',
    project: '',
    dateFrom: '',
    dateTo: ''
  });

  const { licenses } = useLicenseStore();

  const filteredLicenses = licenses.filter(license => {
    if (filters.vendor && !license.vendor.toLowerCase().includes(filters.vendor.toLowerCase())) {
      return false;
    }
    if (filters.project && !license.project_name.toLowerCase().includes(filters.project.toLowerCase())) {
      return false;
    }
    if (filters.dateFrom && license.license_end_date < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && license.license_end_date > filters.dateTo) {
      return false;
    }
    return true;
  });

  // license_cost removed from schema; compute 0 for now (can be derived from serials later)
  const totalCost = 0;
  const uniqueVendors = new Set(filteredLicenses.map(license => license.vendor)).size;
  const uniqueProjects = new Set(filteredLicenses.map(license => license.project_name)).size;

  const handleExportCSV = () => {
    const csvContent = [
      'Vendor,Item,Description,Serial Number,Project,Start Date,End Date,Status,Priority,Remark',
      ...filteredLicenses.map(license => 
        `"${license.vendor}","${license.item}","${license.item_description}","${license.serial_number}","${license.project_name}","${license.license_start_date}","${license.license_end_date}","${license.status}","${license.priority}","${license.remark || ''}"`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `license-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('Report exported to CSV successfully');
  };

  const handleExportPDF = () => {
    // Simple PDF export simulation
    const printContent = `
      <html>
        <head>
          <title>License Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .header { text-align: center; margin-bottom: 20px; }
            .stats { display: flex; justify-content: space-around; margin: 20px 0; }
            .stat { text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>1Cloud Technology License Report</h1>
            <p>Generated on ${format(new Date(), 'MMMM dd, yyyy')}</p>
          </div>
          
          <div class="stats">
            <div class="stat">
              <h3>${filteredLicenses.length}</h3>
              <p>Total Licenses</p>
            </div>
            <div class="stat">
              <h3>${uniqueVendors}</h3>
              <p>Vendors</p>
            </div>
            <div class="stat">
              <h3>${uniqueProjects}</h3>
              <p>Projects</p>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Priority</th>
                <th>Status</th>
                <th>Project</th>
                <th>End Date</th>
              </tr>
            </thead>
            <tbody>
              ${filteredLicenses.map(license => `
                <tr>
                  <td>${license.priority}</td>
                  <td>${license.status}</td>
                  <td>${license.project_name}</td>
                  <td>${format(parseISO(license.license_end_date), 'MMM dd, yyyy')}</td>
                </tr>
                `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
    
    toast.success('Report opened for printing/PDF export');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
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
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            label="Vendor"
            value={filters.vendor}
            onChange={(value) => setFilters(prev => ({ ...prev, vendor: value }))}
            placeholder="Filter by vendor..."
          />
          <Input
            label="Project"
            value={filters.project}
            onChange={(value) => setFilters(prev => ({ ...prev, project: value }))}
            placeholder="Filter by project..."
          />
          <Input
            label="Date From"
            type="date"
            value={filters.dateFrom}
            onChange={(value) => setFilters(prev => ({ ...prev, dateFrom: value }))}
          />
          <Input
            label="Date To"
            type="date"
            value={filters.dateTo}
            onChange={(value) => setFilters(prev => ({ ...prev, dateTo: value }))}
          />
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Licenses</p>
              <p className="text-2xl font-bold text-gray-900">{filteredLicenses.length}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Vendors</p>
              <p className="text-2xl font-bold text-gray-900">{uniqueVendors}</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Projects</p>
              <p className="text-2xl font-bold text-gray-900">{uniqueProjects}</p>
            </div>
            <div className="bg-indigo-50 p-3 rounded-lg">
              <Calendar className="h-6 w-6 text-indigo-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Licenses Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">License Details</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  End Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLicenses.map((license) => (
                <tr key={license.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{license.item}</div>
                      <div className="text-sm text-gray-500">{license.serial_number}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {license.vendor}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {license.project_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(parseISO(license.license_end_date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {license.priority}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {license.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};