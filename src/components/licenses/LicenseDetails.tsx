import React, { useEffect, useState } from 'react';
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
  Upload
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
  const [renewalData, setRenewalData] = useState({
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
    if (!selectedLicense || !renewalData.newEndDate || !renewalData.cost) return;
    
    try {
      await renewLicense(
        selectedLicense.id,
        renewalData.newEndDate,
        renewalData.cost,
        renewalData.notes
      );
      await loadLicenseDetails(selectedLicense.id);
      setShowRenewalModal(false);
      setRenewalData({ newEndDate: '', cost: 0, notes: '' });
      toast.success('License renewed successfully');
    } catch (error) {
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

  const getExpiryStatus = (endDate: string) => {
    const daysUntilExpiry = differenceInDays(parseISO(endDate), new Date());
    
    if (daysUntilExpiry < 0) {
      return { 
        status: 'Expired', 
        color: 'text-red-600 bg-red-50 border-red-200', 
        icon: AlertTriangle,
        days: Math.abs(daysUntilExpiry) 
      };
    } else if (daysUntilExpiry <= 7) {
      return { 
        status: 'Critical', 
        color: 'text-red-600 bg-red-50 border-red-200', 
        icon: AlertTriangle,
        days: daysUntilExpiry 
      };
    } else if (daysUntilExpiry <= 30) {
      return { 
        status: 'Warning', 
        color: 'text-orange-600 bg-orange-50 border-orange-200', 
        icon: Clock,
        days: daysUntilExpiry 
      };
    } else {
      return { 
        status: 'Active', 
        color: 'text-green-600 bg-green-50 border-green-200', 
        icon: CheckCircle,
        days: daysUntilExpiry 
      };
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

  const expiryInfo = getExpiryStatus(selectedLicense.license_end_date);

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
            <p className="text-gray-600 mt-1">{selectedLicense.vendor} • {selectedLicense.project_name}</p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <Button variant="secondary" icon={Download}>
            Export
          </Button>
          <Button variant="secondary" icon={Edit}>
            Edit
          </Button>
          <Button variant="danger" icon={Trash2} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </motion.div>

      {/* Status Banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className={`p-4 rounded-lg border-2 ${expiryInfo.color}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <expiryInfo.icon className="h-6 w-6" />
            <div>
              <h3 className="font-semibold">License Status: {expiryInfo.status}</h3>
              <p className="text-sm">
                {expiryInfo.status === 'Expired' 
                  ? `Expired ${expiryInfo.days} days ago`
                  : `${expiryInfo.days} days remaining`
                }
              </p>
            </div>
          </div>
          {expiryInfo.status !== 'Active' && (
            <Button
              variant="primary"
              icon={RefreshCw}
              onClick={() => setShowRenewalModal(true)}
            >
              Renew License
            </Button>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* License Information */}

           {/* Basic Information */}
           <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">License Information</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Vendor</label>
                      <p className="text-gray-900">{selectedLicense.vendor}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-500">Project</label>
                      <p className="text-gray-900">{selectedLicense.project_name}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-500">License Start Date</label>
                      <p className="text-gray-900">
                        {format(parseISO(selectedLicense.license_start_date), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-500">License End Date</label>
                      <p className="text-gray-900">
                        {format(parseISO(selectedLicense.license_end_date), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Priority</label>
                      <Badge 
                        className={getPriorityColor(selectedLicense.priority)}
                        size="sm"
                      >
                        {selectedLicense.priority.charAt(0).toUpperCase() + selectedLicense.priority.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                {selectedLicense.item_description && (
                  <div className="mt-6">
                    <label className="text-sm font-medium text-gray-500">Product</label>
                    <p className="text-gray-900 mt-1">{selectedLicense.item_description}</p>
                  </div>
                )}
                
                {selectedLicense.remark && (
                  <div className="mt-4">
                    <label className="text-sm font-medium text-gray-500">Remarks</label>
                    <p className="text-gray-900 mt-1">{selectedLicense.remark}</p>
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
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-xs text-gray-500">Serial/Contract</p>
                              <p className="font-mono text-sm text-gray-900">{s.serial_or_contract}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Start Date</p>
                              <p className="text-gray-900">{format(parseISO(s.start_date), 'MMM dd, yyyy')}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">End Date</p>
                              <p className="text-gray-900">{format(parseISO(s.end_date), 'MMM dd, yyyy')}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Qty</p>
                              <p className="text-gray-900">{s.qty}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Currency</p>
                              <p className="text-gray-900">{s.currency}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Unit Price</p>
                              <p className="text-gray-900">{s.unit_price.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Total</p>
                              <p className="text-gray-900 font-medium">{s.currency} {rowTotal.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">PO No.</p>
                              <p className="text-gray-900">{s.po_no || '-'}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Totals per currency */}
                    <div className="mt-2 text-sm text-gray-700">
                      {['MMK', 'USD'].map((cur) => {
                        const sum = serials.filter(s => s.currency === (cur as any)).reduce((acc, s) => acc + (s.unit_price || 0) * (s.qty || 0), 0);
                        if (!sum) return null;
                        return <div key={cur} className="font-medium">Total ({cur}): {sum.toLocaleString()}</div>;
                      })}
                    </div>
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
                  <div className="space-y-3">
                    {customers.map((c) => (
                      <div key={c.id} className="p-4 border rounded-lg">
                        <div className="font-medium text-gray-900">{c.company_name}</div>
                        <div className="text-sm text-gray-600">
                          {c.contact_person || '-'}
                          {c.contact_email ? ` • ${c.contact_email}` : ''}
                          {c.contact_number ? ` • ${c.contact_number}` : ''}
                        </div>
                        {c.address && <div className="text-sm text-gray-600">{c.address}</div>}
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
                  <div className="space-y-3">
                    {distributors.map((d) => (
                      <div key={d.id} className="p-4 border rounded-lg">
                        <div className="font-medium text-gray-900">{d.company_name}</div>
                        <div className="text-sm text-gray-600">
                          {d.contact_person || '-'}
                          {d.contact_email ? ` • ${d.contact_email}` : ''}
                          {d.contact_number ? ` • ${d.contact_number}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>

         

          {/* Custom Fields removed */}

          {/* Comments removed */}

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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* License Dates */}
          

          {/* Renewal History */}
          {renewalHistory.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Renewal History</h3>
                  
                  <div className="space-y-3">
                    {renewalHistory.map((renewal) => (
                      <div key={renewal.id} className="border-l-4 border-green-200 pl-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            ${renewal.cost.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-500">
                            {format(new Date(renewal.renewal_date), 'MMM dd, yyyy')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">
                          Extended to {format(new Date(renewal.new_end_date), 'MMM dd, yyyy')}
                        </p>
                        {renewal.notes && (
                          <p className="text-xs text-gray-500 mt-1">{renewal.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
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

      {/* Renewal Modal */}
      <Modal
        isOpen={showRenewalModal}
        onClose={() => setShowRenewalModal(false)}
        title="Renew License"
      >
        <div className="space-y-4">
          <Input
            label="New End Date"
            type="date"
            value={renewalData.newEndDate}
            onChange={(value) => setRenewalData({ ...renewalData, newEndDate: value })}
            required
          />
          
          <Input
            label="Renewal Cost"
            type="number"
            value={renewalData.cost.toString()}
            onChange={(value) => setRenewalData({ ...renewalData, cost: parseFloat(value) || 0 })}
            required
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={renewalData.notes}
              onChange={(e) => setRenewalData({ ...renewalData, notes: e.target.value })}
              rows={3}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="Add renewal notes..."
            />
          </div>
          
          <div className="flex justify-end space-x-3">
            <Button variant="secondary" onClick={() => setShowRenewalModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRenewal} 
              disabled={!renewalData.newEndDate || !renewalData.cost}
              icon={RefreshCw}
            >
              Renew License
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};