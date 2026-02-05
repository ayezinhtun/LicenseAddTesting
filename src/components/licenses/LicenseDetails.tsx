import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Download,
  Paperclip,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Copy,
  Upload,
  Building2,
  UserIcon,
  Mail,
  Phone,
  MapIcon
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLicenseStore } from '../../store/licenseStore';
import { supabase } from '../../lib/supabase';
import type { LicenseSerial, LicenseCustomer, LicenseDistributor } from '../../store/licenseStore';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { format, parseISO, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';

export const LicenseDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { user } = useAuthStore();
  const {
    selectedLicense,
    fetchLicenseById,
    setSelectedLicense,

    addAttachment,
    deleteAttachment,
    fetchAttachments,
    downloadAttachment,
    fetchRenewalHistory,
    renewLicense,
    deleteLicense
  } = useLicenseStore();

  const [attachments, setAttachments] = useState<any[]>([]);
  const [renewalHistory, setRenewalHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [serials, setSerials] = useState<LicenseSerial[]>([]);
  const [customers, setCustomers] = useState<LicenseCustomer[]>([]);
  const [distributors, setDistributors] = useState<LicenseDistributor[]>([]);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [attachmentDescription, setAttachmentDescription] = useState('');
  const [selectedSerialId, setSelectedSerialId] = useState<string>('');

  const [renewalData, setRenewalData] = useState({
    productName: '',
    serialNo: '',
    serialStartDate: '',
    newEndDate: '',
    cost: 0,
    notes: ''
  });

  useEffect(() => {
    if (id) {
      loadLicenseDetails(id);
    }
  }, [id]);

  const loadLicenseDetails = async (licenseId: string) => {
    setIsLoading(true);
    try {
      const license = await fetchLicenseById(licenseId);
      if (license) {
        setSelectedLicense(license);
        const [attachmentsData, renewalData] = await Promise.all([
          fetchAttachments(licenseId),
          fetchRenewalHistory(licenseId)
        ]);
        setAttachments(attachmentsData);
        setRenewalHistory(renewalData);

        // Fetch child tables directly
        const [{ data: serialRows }, { data: customerRows }, { data: distributorRows }] = await Promise.all([
          supabase.from('license_serials').select('*').eq('license_id', licenseId).order('start_date', { ascending: true }),
          supabase.from('license_customers').select('*').eq('license_id', licenseId).order('company_name', { ascending: true }),
          supabase.from('license_distributors').select('*').eq('license_id', licenseId).order('company_name', { ascending: true })
        ]);
        setSerials(serialRows || []);
        setCustomers(customerRows || []);
        setDistributors(distributorRows || []);
      }
    } catch (error) {
      console.error('Error loading license details:', error);
      toast.error('Failed to load license details');
    } finally {
      setIsLoading(false);
    }
  };

  // Comments removed

  const handleAddAttachment = async () => {
    if (!selectedFile || !selectedLicense) return;

    try {
      await addAttachment(selectedLicense.id, selectedFile, attachmentDescription);
      const updatedAttachments = await fetchAttachments(selectedLicense.id);
      setAttachments(updatedAttachments);
      setSelectedFile(null);
      setAttachmentDescription('');
      setShowAttachmentModal(false);
      toast.success('Attachment added successfully');
    } catch (error) {
      toast.error('Failed to add attachment');
    }
  };

  // Build an HTML document for the current license
  const buildLicenseDetailHtml = () => {
    if (!selectedLicense) return '';

    // Tables
    const serialRows = (serials || [])
      .map(s => `
      <tr>
        <td>${s.serial_or_contract || ''}</td>
        <td>${s.start_date || ''}</td>
        <td>${s.end_date || ''}</td>
        <td style="text-align:right">${s.qty ?? ''}</td>
        <td>${s.currency || ''}</td>
        <td style="text-align:right">${s.unit_price?.toLocaleString?.() || s.unit_price || ''}</td>
        <td style="text-align:right">${((s.unit_price || 0) * (s.qty || 0)).toLocaleString?.() || ((s.unit_price || 0) * (s.qty || 0))}</td>
        <td>${s.po_no || ''}</td>
      </tr>
    `).join('') || `<tr><td colspan="8" style="text-align:center;color:#777">No serials added</td></tr>`;

    const customerRows = (customers || [])
      .map(c => `
      <tr>
        <td>${c.company_name || ''}</td>
        <td>${c.contact_person || ''}</td>
        <td>${c.contact_email || ''}</td>
        <td>${c.contact_number || ''}</td>
        <td>${c.address || ''}</td>
      </tr>
    `).join('') || `<tr><td colspan="5" style="text-align:center;color:#777">No customers added</td></tr>`;

    const distributorRows = (distributors || [])
      .map(d => `
      <tr>
        <td>${d.company_name || ''}</td>
        <td>${d.contact_person || ''}</td>
        <td>${d.contact_email || ''}</td>
        <td>${d.contact_number || ''}</td>
      </tr>
    `).join('') || `<tr><td colspan="4" style="text-align:center;color:#777">No distributors added</td></tr>`;

    const renewalRows = (renewalHistory || [])
      .map((r: any) => `
    <tr>
      <td>${r.renewal_date ? new Date(r.renewal_date).toLocaleDateString() : ''}</td>
      <td>${r.previous_end_date ? new Date(r.previous_end_date).toLocaleDateString() : ''}</td>
      <td>${r.prev_product_name || ''}</td>
      <td>${r.prev_serial_no || ''}</td>
      <td>${r.prev_serial_start_date ? new Date(r.prev_serial_start_date).toLocaleDateString() : ''}</td>
      <td>${r.prev_serial_end_date ? new Date(r.prev_serial_end_date).toLocaleDateString() : ''}</td>
      <td>${r.prev_remark || ''}</td>
    </tr>
  `)
      .join('')
      || `<tr><td colspan="8" style="text-align:center;color:#777">No old data found</td></tr>`;

    const product = selectedLicense.item_description?.trim() ? selectedLicense.item_description : selectedLicense.item;

    return `
    <html>
      <head>
        <title>License Detail - ${selectedLicense.vendor || ''}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #111; }
          h1,h2 { margin: 0; }
          .header { text-align: center; }
          .meta { margin-top: 6px; text-align: center; color: #555; font-size: 12px; }
          .section { margin-top: 20px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
          th { background: #f7f7f7; text-align: left; }
          .label { color: #666; font-size: 12px; }
          .val { font-size: 14px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>License Detail</h1>
          <div class="meta">Generated on ${new Date().toLocaleDateString()}</div>
        </div>

        <div class="section">
          <h2>License Information</h2>
          <div class="grid">
            <div>
              <div class="label">Vendor</div>
              <div class="val">${selectedLicense.vendor || '-'}</div>
            </div>
            <div>
              <div class="label">Project</div>
              <div class="val">${selectedLicense.project_name || '-'} ${(selectedLicense as any).project_assign ? `(${(selectedLicense as any).project_assign})` : ''}</div>
            </div>
            <div>
              <div class="label">Product</div>
              <div class="val">${product || '-'}</div>
            </div>
            <div>
              <div class="label">Priority</div>
              <div class="val">${selectedLicense.priority || '-'}</div>
            </div>
          </div>
          ${selectedLicense.remark ? `
            <div style="margin-top:10px">
              <div class="label">Remarks</div>
              <div class="val" style="white-space:pre-line">${selectedLicense.remark}</div>
            </div>` : ''}
        </div>

        <div class="section">
          <h2>Serials</h2>
          <table>
            <thead>
              <tr>
                <th>Serial/Contract</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th style="text-align:right">Qty</th>
                <th>Currency</th>
                <th style="text-align:right">Total</th>
                <th>PO No.</th>
              </tr>
            </thead>
            <tbody>
              ${serialRows}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Customers</h2>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact Person</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              ${customerRows}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Distributors</h2>
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Contact Person</th>
                <th>Email</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              ${distributorRows}
            </tbody>
          </table>
        </div>
        
        <div class="section">
          <h2>Old License Data</h2>
          <table>
            <thead>
              <tr>
                <th>Renewal Date</th>
                <th>Previous End Date</th>
                <th>Product (old)</th>
                <th>Serial (old)</th>
                <th>Serial Start (old)</th>
                <th>Serial End (old)</th>
                <th>Remark (old)</th>in 
              </tr>
            </thead>
            <tbody>
              ${renewalRows}
            </tbody>
          </table>
        </div>
        
      </body>
    </html>
  `;
  };

  const handleExportPDFDetail = () => {
    const html = buildLicenseDetailHtml();
    if (!html) return;

    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    } else {
      toast.error('Popup blocked. Please allow popups for this site.');
    }
  };

  const buildExportDetailRows = () => {
    if (!selectedLicense) return [];

    const product = selectedLicense.item_description?.trim()
      ? selectedLicense.item_description
      : (selectedLicense as any).item;

    // One CSV row per serial
    return (serials || []).map((s: any) => ({
      vendorName: selectedLicense.vendor || '',
      projectName: selectedLicense.project_name || '',
      projectAssign: (selectedLicense as any).project_assign || '',
      product: product || '',
      serialContractNumber: s.serial_or_contract || '',
      quantity: String(s.qty ?? ''),
      startDate: s.start_date || '',
      endDate: s.end_date || '',
      notifyBeforeDays: String(s.notify_before_days ?? 30),
      status: selectedLicense.status || '',
      remark: selectedLicense.remark || '',

      // optional: pack old data into one field
      oldLicenseData: (renewalHistory || [])
        .map((r: any) =>
          [
            r.renewal_date || '',
            r.previous_end_date || '',
            r.prev_product_name || '',
            r.prev_serial_no || '',
            r.prev_serial_start_date || '',
            r.prev_serial_end_date || '',
            r.prev_remark || ''
          ].join(' | ')
        )
        .join(' ; ')
    }));
  };


  const handleExportCSVDetail = () => {
    const rows = buildExportDetailRows();
    if (rows.length === 0) {
      toast.error('No data to export');
      return;
    }

    const header = [
      'Vendor Name',
      'Project Name',
      'Project Assign',
      'Product',
      'Serial/Contract Number',
      'Quantity',
      'Start Date',
      'End Date',
      'Notify Before Days',
      'Status',
      'Remark',
      'Old License Data'
    ];

    const escapeCSV = (val: string) => `"${(val ?? '').replace(/"/g, '""')}"`;

    const csvContent = [
      header.join(','),
      ...rows.map(r => [
        escapeCSV(r.vendorName),
        escapeCSV(r.projectName),
        escapeCSV(r.projectAssign),
        escapeCSV(r.product),
        escapeCSV(r.serialContractNumber),
        escapeCSV(r.quantity),
        escapeCSV(r.startDate),
        escapeCSV(r.endDate),
        escapeCSV(r.notifyBeforeDays),
        escapeCSV(r.status),
        escapeCSV(r.remark),
        escapeCSV(r.oldLicenseData),
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `license-${selectedLicense?.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success('Exported CSV successfully');
  };
  
  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) return;

    try {
      await deleteAttachment(attachmentId);
      const updatedAttachments = await fetchAttachments(selectedLicense!.id);
      setAttachments(updatedAttachments);
      toast.success('Attachment deleted successfully');
    } catch (error) {
      toast.error('Failed to delete attachment');
    }
  };

  const handleDownloadAttachment = async (attachment: any) => {
    try {
      await downloadAttachment(attachment);
    } catch (error) {
      toast.error('Failed to download attachment');
    }
  };

  const handleRenewal = async () => {
    if (
      !selectedLicense ||
      !selectedSerialId ||
      !renewalData.productName ||
      !renewalData.serialNo ||
      !renewalData.serialStartDate ||
      !renewalData.newEndDate ||
      renewalData.cost === null
    ) return;

    try {
      await renewLicense(selectedLicense.id, {
        selectedSerialId,
        productName: renewalData.productName,
        serialNo: renewalData.serialNo,
        serialStartDate: renewalData.serialStartDate,
        newEndDate: renewalData.newEndDate,
        cost: renewalData.cost,
        notes: renewalData.notes,
        remark: renewalData.notes
      });
      await loadLicenseDetails(selectedLicense.id);
      setShowRenewalModal(false);
      setSelectedSerialId('');
      setRenewalData({
        productName: '',
        serialNo: '',
        serialStartDate: '',
        newEndDate: '',
        cost: 0,
        notes: ''
      });
      toast.success('License renewed successfully');
    } catch {
      toast.error('Failed to renew license');
    }
  };

  const handleDelete = async () => {
    if (!selectedLicense) return;

    if (window.confirm('Are you sure you want to delete this license? This action cannot be undone.')) {
      try {
        await deleteLicense(selectedLicense.id);
        navigate('/licenses');
        toast.success('License deleted successfully');
      } catch (error) {
        toast.error('Failed to delete license');
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };


  // Add this helper for a single serial end date
  const getSerialExpiryStatus = (endDate?: string | null) => {
    if (!endDate) {
      return {
        status: 'Active',
        color: 'text-green-600 bg-green-50 border-green-200',
        icon: CheckCircle,
        days: 0
      };
    }

    let dateObj: Date | null = null;
    try {
      dateObj = parseISO(endDate);
    } catch {
      dateObj = null;
    }

    if (!dateObj) {
      return {
        status: 'Active',
        color: 'text-green-600 bg-green-50 border-green-200',
        icon: CheckCircle,
        days: 0
      };
    }

    const daysUntilExpiry = differenceInDays(dateObj, new Date());

    if (daysUntilExpiry < 0) {
      return { status: 'Expired', color: 'text-red-600 bg-red-50 border-red-200', icon: AlertTriangle, days: Math.abs(daysUntilExpiry) };
    } else if (daysUntilExpiry <= 7) {
      return { status: 'Critical', color: 'text-red-600 bg-red-50 border-red-200', icon: AlertTriangle, days: daysUntilExpiry };
    } else if (daysUntilExpiry <= 30) {
      return { status: 'Warning', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: Clock, days: daysUntilExpiry };
    } else {
      return { status: 'Active', color: 'text-green-600 bg-green-50 border-green-200', icon: CheckCircle, days: daysUntilExpiry };
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!selectedLicense) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">License Not Found</h2>
        <Button onClick={() => navigate('/licenses')}>
          Back to Licenses
        </Button>
      </div>
    );
  }

  // const expiryInfo = getExpiryStatus(selectedLicense.license_end_date);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            icon={ArrowLeft}
            onClick={() => navigate('/licenses')}
          >
            Back to Licenses
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">License Details</h1>
            <p className="text-gray-600 mt-1">
              {selectedLicense.vendor} • {selectedLicense.project_name}
              {((selectedLicense as any).project_assign) ? ` • ${(selectedLicense as any).project_assign}` : ''}
            </p>
          </div>
        </div>

        <div className="flex space-x-3">
          <Button variant="secondary" icon={Download} onClick={handleExportPDFDetail}>
            Export PDF
          </Button>

          <Button
            icon={Download}
            onClick={handleExportCSVDetail}
          >
            Export CSV
          </Button>

          {user?.role !== 'user' && (
            // in header actions
            // Renew button in header
            <Button
              variant="primary"
              icon={RefreshCw}
              onClick={() => {
                setRenewalData({
                  // prefer item_description, fallback to item
                  productName: selectedLicense?.item_description || selectedLicense?.item || '',
                  serialNo: '',
                  serialStartDate: '',
                  newEndDate: '',
                  cost: 0,
                  // prefill remark into notes textarea
                  notes: selectedLicense?.remark || ''
                });
                setSelectedSerialId('');
                setShowRenewalModal(true);
              }}
            >
              Renew
            </Button>
          )}

          {/* Show Edit for admin and super_user; hide for user */}
          {user?.role !== 'user' && (
            <Button
              variant="secondary"
              icon={Edit}
              onClick={() => {
                if (!selectedLicense) return;
                navigate('/licenses', { state: { editLicenseId: selectedLicense.id } });
              }}
            >
              Edit
            </Button>
          )}

          {/* Show Delete for admin only; hide for super_user and user */}
          {user?.role === 'admin' && (
            <Button variant="danger" icon={Trash2} onClick={handleDelete}>
              Delete
            </Button>
          )}
        </div>
      </motion.div>

      {/* Status Banner */}
      {/* 
       */}

      <div className="grid grid-cols-1 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* License Information */}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">License Information</h3>

                {/* Top summary: Vendor and Project */}
                <div className="mb-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="text-base font-medium text-gray-900">
                      {selectedLicense.vendor}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Project:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {selectedLicense.project_name}
                      </span>
                      {(selectedLicense as any).project_assign && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                          {(selectedLicense as any).project_assign}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* Right column */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500">Priority</p>
                      <Badge className={getPriorityColor(selectedLicense.priority)} size="sm">
                        {selectedLicense.priority.charAt(0).toUpperCase() + selectedLicense.priority.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Product and Remarks */}
                {selectedLicense.item_description && (
                  <div className="mt-6">
                    <p className="text-xs text-gray-500 mb-1">Product</p>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-gray-900 flex-1">
                        {selectedLicense.item_description}
                      </p>

                    </div>
                  </div>
                )}

                {selectedLicense.remark && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 mb-1">Remarks</p>
                    <p className="text-sm text-gray-900 whitespace-pre-line">
                      {selectedLicense.remark}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>


          {/* Serial Number Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
          >
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Serial Number Information</h3>
                {serials.length === 0 ? (
                  <p className="text-sm text-gray-500">No serials added.</p>
                ) : (
                  <div className="space-y-3">
                    {serials.map((s) => {
                      const rowTotal = (s.unit_price || 0) * (s.qty || 0);
                      return (
                        <div key={s.id} className="p-4 border rounded-lg">
                          {/* Row header with per-serial expiry status */}
                          {(() => {
                            const exp = getSerialExpiryStatus(s.end_date);
                            const Icon = exp.icon;
                            return (
                              <div className={`mb-3 inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs ${exp.color}`}>
                                <Icon className="h-4 w-4" />
                                <span className="font-medium">Status: {exp.status}</span>
                                <span className="opacity-80">
                                  {exp.status === 'Expired' ? `Expired ${exp.days}d ago` : `${exp.days}d remaining`}
                                </span>
                              </div>
                            );
                          })()}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-gray-500">Serial/Contract</p>
                              <p className="font-mono text-sm text-gray-900">{s.serial_or_contract}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Start Date</p>
                              <p className="text-gray-900">
                                {s.start_date ? format(parseISO(s.start_date), 'MMM dd, yyyy') : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">End Date</p>
                              <p className="text-gray-900">
                                {s.end_date ? format(parseISO(s.end_date), 'MMM dd, yyyy') : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Qty</p>
                              <p className="text-gray-900">{s.qty}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">PO No.</p>
                              <p className="text-gray-900">{s.po_no || '-'}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Customer Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Information</h3>

                {customers.length === 0 ? (
                  <p className="text-sm text-gray-500">No customers added.</p>
                ) : (
                  <div className="space-y-4">
                    {customers.map((c, idx) => (
                      <div key={c.id} className="p-5 border rounded-lg hover:shadow-sm transition">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-gray-500" />
                            <span className="text-base font-medium text-gray-900">
                              {c.company_name || '-'}
                            </span>
                          </div>
                          {/* <div className="text-xs text-gray-500">Customer #{idx + 1}</div> */}
                        </div>

                        {/* Grid details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Contact Person */}
                          <div className="flex items-start gap-3">
                            <UserIcon className="h-4 w-4 text-gray-500 mt-1" />
                            <div>
                              <p className="text-xs text-gray-500">Contact Person</p>
                              <p className="text-sm text-gray-900">{c.contact_person || '-'}</p>
                            </div>
                          </div>

                          {/* Email */}
                          <div className="flex items-start gap-3">
                            <Mail className="h-4 w-4 text-gray-500 mt-1" />
                            <div className="flex-1">
                              <p className="text-xs text-gray-500">Contact Email</p>
                              {c.contact_email ? (
                                <div className="flex items-center gap-2">
                                  <a
                                    href={`mailto:${c.contact_email}`}
                                    className="text-sm text-blue-600 hover:underline break-all"
                                  >
                                    {c.contact_email}
                                  </a>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={Copy}
                                    onClick={() => copyToClipboard(c.contact_email!)}
                                    title="Copy email"
                                  />
                                </div>
                              ) : (
                                <p className="text-sm text-gray-900">-</p>
                              )}
                            </div>
                          </div>

                          {/* Phone */}
                          <div className="flex items-start gap-3">
                            <Phone className="h-4 w-4 text-gray-500 mt-1" />
                            <div className="flex-1">
                              <p className="text-xs text-gray-500">Contact Number</p>
                              {c.contact_number ? (
                                <div className="flex items-center gap-2">
                                  <a
                                    href={`tel:${c.contact_number}`}
                                    className="text-sm text-gray-900 hover:underline"
                                  >
                                    {c.contact_number}
                                  </a>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={Copy}
                                    onClick={() => copyToClipboard(c.contact_number!)}
                                    title="Copy phone"
                                  />
                                </div>
                              ) : (
                                <p className="text-sm text-gray-900">-</p>
                              )}
                            </div>
                          </div>

                          {/* Address */}
                          <div className="flex items-start gap-3">
                            <MapIcon className="h-4 w-4 text-gray-500 mt-1" />
                            <div>
                              <p className="text-xs text-gray-500">Address</p>
                              <p className="text-sm text-gray-900 whitespace-pre-line break-words">
                                {c.address || '-'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Distributor Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Distributor Information</h3>

                {distributors.length === 0 ? (
                  <p className="text-sm text-gray-500">No distributors added.</p>
                ) : (
                  <div className="space-y-4">
                    {distributors.map((d, idx) => (
                      <div key={d.id} className="p-5 border rounded-lg hover:shadow-sm transition">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-gray-500" />
                            <span className="text-base font-medium text-gray-900">
                              {d.company_name || '-'}
                            </span>
                          </div>
                          {/* <div className="text-xs text-gray-500">Distributor #{idx + 1}</div> */}
                        </div>

                        {/* Grid details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Contact Person */}
                          <div className="flex items-start gap-3">
                            <UserIcon className="h-4 w-4 text-gray-500 mt-1" />
                            <div>
                              <p className="text-xs text-gray-500">Contact Person</p>
                              <p className="text-sm text-gray-900">{d.contact_person || '-'}</p>
                            </div>
                          </div>

                          {/* Email */}
                          <div className="flex items-start gap-3">
                            <Mail className="h-4 w-4 text-gray-500 mt-1" />
                            <div className="flex-1">
                              <p className="text-xs text-gray-500">Contact Email</p>
                              {d.contact_email ? (
                                <div className="flex items-center gap-2">
                                  <a
                                    href={`mailto:${d.contact_email}`}
                                    className="text-sm text-blue-600 hover:underline break-all"
                                  >
                                    {d.contact_email}
                                  </a>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={Copy}
                                    onClick={() => copyToClipboard(d.contact_email!)}
                                    title="Copy email"
                                  />
                                </div>
                              ) : (
                                <p className="text-sm text-gray-900">-</p>
                              )}
                            </div>
                          </div>

                          {/* Phone */}
                          <div className="flex items-start gap-3">
                            <Phone className="h-4 w-4 text-gray-500 mt-1" />
                            <div className="flex-1">
                              <p className="text-xs text-gray-500">Contact Number</p>
                              {d.contact_number ? (
                                <div className="flex items-center gap-2">
                                  <a
                                    href={`tel:${d.contact_number}`}
                                    className="text-sm text-gray-900 hover:underline"
                                  >
                                    {d.contact_number}
                                  </a>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={Copy}
                                    onClick={() => copyToClipboard(d.contact_number!)}
                                    title="Copy phone"
                                  />
                                </div>
                              ) : (
                                <p className="text-sm text-gray-900">-</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Attachments */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Attachments ({attachments.length})</h3>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Paperclip}
                    onClick={() => setShowAttachmentModal(true)}
                  >
                    Add Attachment
                  </Button>
                </div>

                {attachments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Paperclip className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p>No attachments yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Paperclip className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{attachment.file_name}</p>
                            <p className="text-xs text-gray-500">
                              {(attachment.file_size / 1024 / 1024).toFixed(2)} MB •
                              {format(new Date(attachment.uploaded_at), 'MMM dd, yyyy')}
                            </p>
                            {attachment.description && (
                              <p className="text-xs text-gray-600 mt-1">{attachment.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Download}
                            onClick={() => handleDownloadAttachment(attachment)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            onClick={() => handleDeleteAttachment(attachment.id)}
                            className="text-red-600 hover:text-red-700"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Renewal History */}
          {renewalHistory.length !== 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.28 }}
            >
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Old License Data</h3>
                  {renewalHistory.length === 0 ? (
                    <p className="text-sm text-gray-500">No old data found.</p>
                  ) : (
                    <div className="space-y-3">
                      {renewalHistory.map((renewal: any) => (
                        <div key={renewal.id} className="border rounded-md bg-gray-50">
                          <div className="px-3 py-2 border-b text-xs text-gray-600 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                Renewal Date - {renewal.renewal_date ? new Date(renewal.renewal_date).toLocaleDateString() : '-'}
                              </span>
                              {/* <span className="text-gray-500">• Old cost:</span>
                              <span className="font-medium">{Number(renewal.cost ?? 0).toLocaleString()}</span> */}
                            </div>
                            {/* <div className="text-[11px] text-gray-500">
                              Prev end: {renewal.previous_end_date ? new Date(renewal.previous_end_date).toLocaleDateString() : '-'}
                            </div> */}
                          </div>

                          <div className="px-3 py-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            <div>
                              <div className="text-xs text-gray-500">Product</div>
                              <div className="text-gray-900">{renewal.prev_product_name || '-'}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Serial</div>
                              <div className="text-gray-900">{renewal.prev_serial_no || '-'}</div>
                              <div className="text-[11px] text-gray-500">
                                Start Date - {renewal.prev_serial_start_date ? new Date(renewal.prev_serial_start_date).toLocaleDateString() : '-'} <br />
                                End Date - {renewal.prev_serial_end_date ? ` ${new Date(renewal.prev_serial_end_date).toLocaleDateString()}` : ' -'}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Remark</div>
                              <div className="text-gray-900 whitespace-pre-line">{renewal.prev_remark || '-'}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          )}

        </div>

        {/* Sidebar */}
        <div className="space-y-6">

        </div>
      </div>

      {/* Comment modal removed */}

      {/* Attachment Modal */}
      <Modal
        isOpen={showAttachmentModal}
        onClose={() => {
          setShowAttachmentModal(false);
          setSelectedFile(null);
          setAttachmentDescription('');
        }}
        title="Add Attachment"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File
            </label>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          <Input
            label="Description (Optional)"
            value={attachmentDescription}
            onChange={setAttachmentDescription}
            placeholder="Brief description of the attachment..."
          />

          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAttachmentModal(false);
                setSelectedFile(null);
                setAttachmentDescription('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddAttachment}
              disabled={!selectedFile}
              icon={Upload}
            >
              Add Attachment
            </Button>
          </div>
        </div>
      </Modal>


      <Modal
        isOpen={showRenewalModal}
        onClose={() => setShowRenewalModal(false)}
        title="Renew License"
      >
        <div className="space-y-6">
          {/* Project Name - Editable */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Project Name</label>
            <Input
              value={renewalData.productName}
              onChange={(value) => setRenewalData({ ...renewalData, productName: value })}
              placeholder="Enter product name"
              required
            />
          </div>

          {/* Serial Selection */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Select Serial <span className='text-red-400'>*</span></label>
            <div className="mt-1 space-y-2 max-h-60 overflow-y-auto p-1">
              {serials.map((s) => (
                <div
                  key={s.id || s.serial_or_contract}
                  onClick={() => {
                    setSelectedSerialId(s.id || '');
                    setRenewalData(prev => ({
                      ...prev,
                      serialNo: s.serial_or_contract || '',
                      serialStartDate: s.start_date || '',
                      newEndDate: s.end_date || '',
                      cost: (s.unit_price || 0) * (s.qty || 0)
                    }));
                  }}
                  className={`p-3 border rounded-md cursor-pointer transition-colors ${selectedSerialId === s.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Serial No</p>
                      <p className="font-medium">{s.serial_or_contract || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Period</p>
                      <p className="font-medium">
                        {s.start_date || 'N/A'} → {s.end_date || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Qty × Price</p>
                      <p className="font-medium">
                        {s.qty || '0'} × {s.currency} {s.unit_price || '0.00'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Serial Information - Editable */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-medium text-gray-700">Serial Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Serial No <span className='text-red-500'>*</span></label>
                <Input
                  value={renewalData.serialNo}
                  onChange={(value) => setRenewalData({ ...renewalData, serialNo: value })}
                  placeholder="Enter serial number"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Start Date <span className='text-red-500'>*</span></label>
                <Input
                  type="date"
                  value={renewalData.serialStartDate}
                  onChange={(value) => setRenewalData({ ...renewalData, serialStartDate: value })}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">End Date <span className='text-red-400'>*</span></label>
                <Input
                  type="date"
                  value={renewalData.newEndDate}
                  onChange={(value) => setRenewalData({ ...renewalData, newEndDate: value })}
                  required
                />
              </div>


            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Remarks</label>
              <textarea
                value={renewalData.notes}
                onChange={(e) => setRenewalData({ ...renewalData, notes: e.target.value })}
                rows={3}
                className="block w-full p-2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                placeholder="Add any notes..."
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 mt-6">
            <Button
              variant="secondary"
              onClick={() => setShowRenewalModal(false)}
              className="px-4"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRenewal}
              disabled={
                !renewalData.productName ||
                !renewalData.serialNo ||
                !renewalData.serialStartDate ||
                !renewalData.newEndDate ||
                renewalData.cost === null ||
                !selectedSerialId
              }
              icon={RefreshCw}
            >
              Process Renewal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};