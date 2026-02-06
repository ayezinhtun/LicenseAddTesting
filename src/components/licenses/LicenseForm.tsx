import React, { useState, useEffect, useMemo, useRef } from "react";

import { Save, X, Plus, Trash2, Paperclip, Download } from "lucide-react";

import { License } from "../../store/licenseStore";

import { Button } from "../common/Button";

import { Input } from "../common/Input";

import { Select } from "../common/Select";

import { useLicenseStore } from "../../store/licenseStore";

import { supabase } from "../../lib/supabase";

import { useAuthStore } from "../../store/authStore";

import { useVendorStore } from "../../store/vendorStore";

import { useProjectAssignStore } from "../../store/projectAssignStore";

import { useCustomerStore } from "../../store/customerStore";

import { useDistributorStore } from "../../store/useDistributorStore";

import toast from "react-hot-toast";

import { differenceInDays, subDays, parseISO, format } from "date-fns";

interface LicenseFormProps {
  license?: License | null;

  onSave: (license: Partial<License>) => void;

  onCancel: () => void;
}

export const LicenseForm: React.FC<LicenseFormProps> = ({
  license,

  onSave,

  onCancel,
}) => {
  const {
    validateLicense,
    addAttachment,
    deleteAttachment,
    downloadAttachment,
    fetchAttachments,
  } = useLicenseStore();

  const { user, assignments } = useAuthStore();

  const { vendors, fetchVendors } = useVendorStore();

  const { assigns, fetchProjectAssigns } = useProjectAssignStore();

  // Compute a notify-on date based on end_date and offset days

  const computeNotifyDate = (
    endDate?: string,
    notifyBeforeDays?: number | null,
  ) => {
    if (!endDate || notifyBeforeDays == null) return "";

    try {
      const end = parseISO(endDate);

      const on = subDays(end, notifyBeforeDays);

      return format(on, "yyyy-MM-dd");
    } catch {
      return "";
    }
  };

  // Compute notify_before_days (offset) from a chosen notify-on date

  const computeNotifyBeforeDays = (endDate?: string, notifyOnDate?: string) => {
    if (!endDate || !notifyOnDate) return null;

    try {
      const end = parseISO(endDate);

      const notify = parseISO(notifyOnDate);

      const diff = differenceInDays(end, notify);

      return Math.max(0, diff);
    } catch {
      return null;
    }
  };

  const MIN_FILE_SIZE = 2 * 1024; // 2 KB

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const vendorOptions = (vendors || []).map((v: any) => ({
    value: v.name,

    label: v.name,
  }));

  useEffect(() => {
    fetchProjectAssigns();
  }, [fetchProjectAssigns]);

  const [allProjectNames, setAllProjectNames] = useState<string[]>([]);

  const [showProjectNameSuggestions, setShowProjectNameSuggestions] =
    useState(false);

  // Load distinct project names from licenses once

  useEffect(() => {
    const loadProjectNames = async () => {
      const { data, error } = await supabase

        .from("licenses")

        .select("project_name");

      if (error) {
        console.error("Error loading project names:", error);

        return;
      }

      const names = Array.from(
        new Set(
          (data || [])

            .map((r: any) => (r.project_name || "").trim())

            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b));

      setAllProjectNames(names);
    };

    loadProjectNames();
  }, []);

  const selectProjectName = (name: string) => {
    setFormData((prev) => ({ ...prev, project_name: name }));

    setShowProjectNameSuggestions(false);
  };

  const projectNameSuggestions = allProjectNames;

  const [formData, setFormData] = useState({
    // Core

    vendor: "",

    project_name: "",

    project_assign: "" as "" | "NPT" | "YGN" | "MPT",

    item_description: "", // Product

    remark: "",

    priority: "medium" as "low" | "medium" | "high" | "critical",

    status: "pending" as
      | "active"
      | "expired"
      | "suspended"
      | "pending"
      | "in_progress"
      | "completed",

    // Dynamic arrays

    serials: [
      {
        serial_or_contract: "",

        start_date: "",

        end_date: "",

        qty: 1,

        unit_price: 0,

        currency: "MMK" as "MMK" | "USD",

        po_no: "",

        notify_before_days: 30,
      },
    ],

    customers: [] as Array<{
      customer_id?: string;

      company_name: string;

      contact_person?: string;

      contact_email?: string;

      contact_number?: string;

      address?: string;
    }>,

    distributors: [] as Array<{
      distributor_id?: string;

      company_name: string;

      contact_person?: string;

      contact_email?: string;

      contact_number?: string;
    }>,

    attachments: [] as File[],

    // Keep compatibility fields if editing an existing license

    company: "",

    customer_name: "",

    business_unit: "",

    user_name: "",

    // license_start_date: '',

    // license_end_date: '',
  });

  const { customers, fetchCustomers } = useCustomerStore();

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const customerOptions = (customers || []).map((c) => ({
    value: c.id,

    label: c.company_name,
  }));

  const selectExistingCustomer = (rowIndex: number, customerId: string) => {
    const c = customers.find((x) => x.id === customerId);

    setFormData((prev) => {
      const next = [...prev.customers];

      next[rowIndex] = {
        ...next[rowIndex],

        customer_id: customerId,

        company_name: c?.company_name || "",

        contact_person: c?.contact_person || "",

        contact_email: c?.contact_email || "",

        contact_number: c?.contact_number || "",

        address: c?.address || "",
      };

      return { ...prev, customers: next };
    });
  };

  const { distributors, fetchDistributors } = useDistributorStore();

  useEffect(() => {
    fetchDistributors();
  }, [fetchDistributors]);

  const distributorOptions = (distributors || []).map((d) => ({
    value: d.id,

    label: d.company_name,
  }));

  const selectExistingDistributor = (
    rowIndex: number,
    distributorId: string,
  ) => {
    const d = distributors.find((x) => x.id === distributorId);

    setFormData((prev) => {
      const next = [...prev.distributors];

      next[rowIndex] = {
        ...next[rowIndex],

        distributor_id: distributorId,

        company_name: d?.company_name || "",

        contact_person: d?.contact_person || "",

        contact_email: d?.contact_email || "",

        contact_number: d?.contact_number || "",
      };

      return { ...prev, distributors: next };
    });
  };

  // removed tags/custom fields

  const [errors, setErrors] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!license) return;

    // Set top-level fields

    setFormData((prev) => ({
      ...prev,

      company: license.company || "",

      vendor: license.vendor || "",

      item_description: license.item_description || "",

      project_name: license.project_name || "",

      project_assign: (license as any).project_assign || "",

      customer_name: license.customer_name || "",

      business_unit: license.business_unit || "",

      user_name: license.user_name || "",

      remark: license.remark || "",

      priority: license.priority || "medium",

      status: (license.status as any) || "active",
    }));

    // Seed children ONLY from license if provided by parent (no DB calls here)

    const l = license as any;

    if (Array.isArray(l.serials)) {
      setFormData((prev) => ({
        ...prev,

        serials: l.serials.map((s: any) => ({
          id: s.id,

          serial_or_contract: s.serial_or_contract || "",

          start_date: s.start_date || "",

          end_date: s.end_date || "",

          qty: s.qty ?? 1,

          unit_price: s.unit_price ?? 0,

          currency: s.currency || "MMK",

          po_no: s.po_no || "",

          notify_before_days: s.notify_before_days ?? 30,
        })),
      }));
    }

    if (Array.isArray(l.customers)) {
      setFormData((prev) => ({
        ...prev,

        customers: l.customers.map((c: any) => ({
          customer_id: c.customer_id || undefined,

          company_name: c.company_name || "",

          contact_person: c.contact_person || "",

          contact_email: c.contact_email || "",

          contact_number: c.contact_number || "",

          address: c.address || "",
        })),
      }));
    }

    if (Array.isArray(l.distributors)) {
      setFormData((prev) => ({
        ...prev,

        distributors: l.distributors.map((d: any) => ({
          distributor_id: d.distributor_id || undefined,

          company_name: d.company_name || "",

          contact_person: d.contact_person || "",

          contact_email: d.contact_email || "",

          contact_number: d.contact_number || "",
        })),
      }));
    }
  }, [license]);

  useEffect(() => {
    if (!license) return;

    (async () => {
      try {
        const { data: attachRows } = await supabase

          .from("license_attachments")

          .select("id,file_name,file_url,file_size,uploaded_at")

          .eq("license_id", license.id)

          .order("uploaded_at", { ascending: false });

        setExistingAttachments(
          (attachRows || []).map((a: any) => ({
            id: a.id,

            file_name: a.file_name,

            file_url: a.file_url,

            file_size: a.file_size,
          })),
        );
      } catch (e) {
        console.error("Failed to load existing attachments", e);
      }
    })();
  }, [license]);

  const addFileInputRef = useRef<HTMLInputElement>(null);

  const handleClickAddAttachment = () => {
    addFileInputRef.current?.click();
  };

  const handleAddAttachmentFiles = async (files: FileList | null) => {
    if (!license || !files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (file.size < MIN_FILE_SIZE) {
        setAttachmentError(`File "${file.name}" is smaller than 2 KB`);

        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setAttachmentError(`File "${file.name}" exceeds 5 MB`);

        return;
      }
    }

    setAttachmentError(null);

    for (const file of Array.from(files)) {
      await addAttachment(license.id, file);
    }

    const refreshed = await fetchAttachments(license.id);

    setExistingAttachments(
      (refreshed || []).map((a: any) => ({
        id: a.id,

        file_name: a.file_name,

        file_url: a.file_url,

        file_size: a.file_size,

        uploaded_at: a.uploaded_at,
      })),
    );
  };

  const handleDeleteExistingAttachment = async (id: string) => {
    await deleteAttachment(id);

    setExistingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDownloadExistingAttachment = async (att: {
    id: string;
    file_name: string;
    file_url: string;
    file_size: number;
  }) => {
    await downloadAttachment(att as any);
  };

  const handleChange = (field: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear errors when user starts typing

    if (errors.length > 0) {
      setErrors([]);
    }
  };

  // Dynamic arrays handlers

  const addSerial = () => {
    setFormData((prev) => ({
      ...prev,

      serials: [
        ...prev.serials,

        {
          serial_or_contract: "",

          start_date: "",

          end_date: "",

          qty: 1,

          unit_price: 0,

          currency: "MMK" as "MMK" | "USD",

          po_no: "",

          notify_before_days: 30, // add this to satisfy inferred type
        },
      ],
    }));
  };

  const removeSerial = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      serials: prev.serials.filter((_, i) => i !== index),
    }));
  };

  const updateSerial = (
    index: number,
    key:
      | "serial_or_contract"
      | "start_date"
      | "end_date"
      | "qty"
      | "unit_price"
      | "currency"
      | "po_no"
      | "notify_before_days",
    value: any,
  ) => {
    setFormData((prev) => {
      const serials = [...prev.serials];

      (serials[index] as any)[key] = value;

      return { ...prev, serials };
    });
  };

  const addCustomer = () => {
    setFormData((prev) => ({
      ...prev,

      customers: [
        ...prev.customers,
        {
          company_name: "",
          contact_person: "",
          contact_email: "",
          contact_number: "",
          address: "",
        },
      ],
    }));
  };

  const removeCustomer = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      customers: prev.customers.filter((_, i) => i !== index),
    }));
  };

  const updateCustomer = (
    index: number,
    key:
      | "company_name"
      | "contact_person"
      | "contact_email"
      | "contact_number"
      | "address",
    value: any,
  ) => {
    setFormData((prev) => {
      const customers = [...prev.customers];

      (customers[index] as any)[key] = value;

      return { ...prev, customers };
    });
  };

  const addDistributor = () => {
    setFormData((prev) => ({
      ...prev,

      distributors: [
        ...prev.distributors,
        {
          company_name: "",
          contact_person: "",
          contact_email: "",
          contact_number: "",
        },
      ],
    }));
  };

  const removeDistributor = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      distributors: prev.distributors.filter((_, i) => i !== index),
    }));
  };

  const updateDistributor = (
    index: number,
    key: "company_name" | "contact_person" | "contact_email" | "contact_number",
    value: any,
  ) => {
    setFormData((prev) => {
      const distributors = [...prev.distributors];

      (distributors[index] as any)[key] = value;

      return { ...prev, distributors };
    });
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const validFiles: File[] = [];

    let errorMsg: string | null = null;

    for (const file of Array.from(files)) {
      if (file.size < MIN_FILE_SIZE) {
        errorMsg = `File "${file.name}" is smaller than 2 KB`;

        break;
      }

      if (file.size > MAX_FILE_SIZE) {
        errorMsg = `File "${file.name}" exceeds 5 MB`;

        break;
      }

      validFiles.push(file);
    }

    if (errorMsg) {
      setAttachmentError(errorMsg);

      return;
    }

    setAttachmentError(null);

    setFormData((prev) => ({
      ...prev,

      attachments: [...prev.attachments, ...validFiles],
    }));
  };

  const removeAttachment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  // Vendor is a manual input field (no dropdown)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);

    if (attachmentError) {
      setErrors([attachmentError]);

      toast.error(attachmentError);

      setIsSubmitting(false);

      return;
    }

    try {
      // Build payload for new schema

      const payload: any = {
        vendor: formData.vendor,

        project_name: formData.project_name,

        project_assign: formData.project_assign || undefined,

        item_description: formData.item_description || "",

        remark: formData.remark || "",

        priority: formData.priority,

        status: formData.status,

        // dynamic arrays

        serials: formData.serials,

        customers: formData.customers,

        distributors: formData.distributors,

        attachments: formData.attachments,

        // compatibility (optional values retained)

        company: formData.company,

        customer_name: formData.customer_name,

        business_unit: formData.business_unit,

        user_name: formData.user_name,

        // license_start_date: formData.license_start_date,

        // license_end_date: formData.license_end_date,
      };

      // Validate using store rules

      const validation = validateLicense(payload);

      if (!validation.isValid) {
        setErrors(validation.errors);

        setIsSubmitting(false);

        return;
      }

      await onSave(payload as any);
    } catch (error) {
      console.error("Error submitting form:", error);

      setErrors([
        error instanceof Error
          ? error.message
          : "An error occurred while saving",
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const priorityOptions = [
    { value: "low", label: "Low" },

    { value: "medium", label: "Medium" },

    { value: "high", label: "High" },

    { value: "critical", label: "Critical" },
  ];

  const statusOptions = [
    { value: "pending", label: "Pending" },

    { value: "in_progress", label: "In Progress" },

    { value: "active", label: "Active" },

    { value: "expired", label: "Expired" },

    { value: "suspended", label: "Suspended" },

    { value: "completed", label: "Completed" },
  ];

  // Permission-aware, dynamic project assignment options (super_user only sees assigned)

  const projectAssignOptions = useMemo(() => {
    // All from DB

    const all = (assigns || []).map((a) => ({ value: a.name, label: a.name }));

    // Admin can see all

    if (user?.role === "admin") {
      return all;
    }

    // super_user and others: only assigned from authStore.assignments

    const allowed = new Set(
      (assignments || []).map((a) => a.trim()).filter(Boolean),
    );

    const filtered = all.filter((o) => allowed.has(o.value));

    // If editing legacy data outside allowed list, include it so the form renders

    if (
      license &&
      (license as any).project_assign &&
      !filtered.find((o) => o.value === (license as any).project_assign)
    ) {
      const val = String((license as any).project_assign);

      filtered.push({ value: val, label: `${val} (not permitted)` });
    }

    return filtered;
  }, [assigns, user?.role, assignments, license]);

  const [existingAttachments, setExistingAttachments] = useState<
    Array<{
      id: string;

      file_name: string;

      file_url: string;

      file_size: number;

      uploaded_at?: string;
    }>
  >([]);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Error Display */}

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-red-800 font-medium mb-2">
            Please fix the following errors:
          </h4>

          <ul className="text-red-700 text-sm space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* License Information */}

      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900">
          License Information
        </h3>

        <p className="text-sm text-gray-600 mb-4">
          Core details about this license
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* <Input

            label="Vendor Name"

            value={formData.vendor}

            onChange={(value) => handleChange('vendor', value)}

            required

            placeholder="e.g., Cisco, Fortinet, Palo Alto"

            error={errors.find(e => e.includes('Vendor'))}

          /> */}

          <Select
            label="Vendor Name"
            value={formData.vendor}
            onChange={(value) => handleChange("vendor", value)}
            options={vendorOptions}
            required
          />

          {/* <Input

            label="Project Name"

            value={formData.project_name}

            onChange={(value) => handleChange('project_name', value)}

            required

            placeholder="FY25/Project Name"

            error={errors.find(e => e.includes('Project name is required'))}

          /> */}

          <div className="relative">
            <Input
              label="Project Name"
              value={formData.project_name}
              onChange={(value) => handleChange("project_name", value)}
              required
              placeholder="FY25/Project Name"
              error={errors.find((e) => e.includes("Project name is required"))}
              onFocus={() => setShowProjectNameSuggestions(true)}
              onBlur={() =>
                setTimeout(() => setShowProjectNameSuggestions(false), 150)
              }
            />

            {showProjectNameSuggestions &&
              projectNameSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-auto">
                  <ul className="py-1 text-sm text-gray-700">
                    {projectNameSuggestions.map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-100"
                          onMouseDown={(e) => e.preventDefault()} // keep dropdown open for click
                          onClick={() => selectProjectName(name)}
                        >
                          {name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>

          {/* <Select

            label="Project Assign"

            value={formData.project_assign}

            onChange={(value) => handleChange('project_assign', value)}

            options={projectAssignOptions}

            required

          /> */}

          <Select
            label="Project Assign"
            value={formData.project_assign}
            onChange={(value) => handleChange("project_assign", value)}
            options={projectAssignOptions}
            required
          />

          {/* <Input

            label="License Start Date"

            type="date"

            value={formData.license_start_date}

            onChange={(value) => handleChange('license_start_date', value)}

          />

          <Input

            label="License End Date"

            type="date"

            value={formData.license_end_date}

            onChange={(value) => handleChange('license_end_date', value)}

          /> */}

          <Input
            label="Product"
            value={formData.item_description}
            onChange={(value) => handleChange("item_description", value)}
            placeholder="Model Number"
          />

          <Select
            label="Priority"
            value={formData.priority}
            onChange={(value) => handleChange("priority", value)}
            options={priorityOptions}
            required
          />

          <Select
            label="Status"
            value={formData.status}
            onChange={(value) => handleChange("status", value)}
            options={statusOptions}
            required
          />
        </div>

        {/* Serials list */}

        <div className="mt-8">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-md font-semibold text-gray-900">
              Serial Number / Contract No.
            </h4>

            <Button type="button" size="sm" icon={Plus} onClick={addSerial}>
              Add
            </Button>
          </div>

          <div className="space-y-4">
            {formData.serials.map((s, idx) => {
              const rowTotal =
                (Number(s.unit_price) || 0) * (Number(s.qty) || 0);

              return (
                <div key={idx} className="p-4 bg-white rounded border">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="Serial/License Name."
                      value={s.serial_or_contract}
                      onChange={(v) =>
                        updateSerial(idx, "serial_or_contract", v)
                      }
                      required
                    />

                    <Input
                      label="Start Date"
                      type="date"
                      value={s.start_date}
                      onChange={(v) => updateSerial(idx, "start_date", v)}
                      required
                    />

                    <Input
                      label="End Date"
                      type="date"
                      value={s.end_date}
                      onChange={(v) => updateSerial(idx, "end_date", v)}
                      required
                    />

                    <Input
                      label="Qty"
                      type="number"
                      min={1}
                      value={String(s.qty)}
                      onChange={(v) =>
                        updateSerial(
                          idx,
                          "qty",
                          Math.max(1, parseInt(v || "1", 10)),
                        )
                      }
                      required
                    />

                    {/* <Select label="Currency" value={s.currency} onChange={(v) => updateSerial(idx, 'currency', v as any)} options={[{ value: 'MMK', label: 'MMK' }, { value: 'USD', label: 'USD' }]} /> */}

                    {/* <Input label="Unit Price" type="number" min={0} step={0.01} value={String(s.unit_price)} onChange={(v) => updateSerial(idx, 'unit_price', parseFloat(v || '0') || 0)} /> */}

                    <Input
                      label="Notify On (date)"
                      type="date"
                      value={computeNotifyDate(
                        s.end_date,
                        s.notify_before_days,
                      )}
                      disabled={!s.end_date} // cannot select notify-on before end_date is chosen
                      onChange={(notifyOn) => {
                        // guard: ensure notify-on is not after end_date

                        let chosen = notifyOn;

                        if (
                          s.end_date &&
                          chosen &&
                          parseISO(chosen) > parseISO(s.end_date)
                        ) {
                          chosen = s.end_date; // clamp to end_date if user picks later date
                        }

                        const offset = computeNotifyBeforeDays(
                          s.end_date,
                          chosen,
                        );

                        updateSerial(idx, "notify_before_days", offset ?? 0);
                      }}
                    />

                    <Input
                      label="PO No. to Distributor"
                      value={s.po_no || ""}
                      onChange={(v) => updateSerial(idx, "po_no", v)}
                      placeholder="Optional"
                    />

                    {/* <div className="flex items-end"><div className="text-sm text-gray-600">Total: {s.currency} {rowTotal.toLocaleString()}</div></div> */}
                  </div>

                  <div className="mt-3 flex justify-end">
                    {formData.serials.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() => removeSerial(idx)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Attachments */}

        {license && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-md font-semibold text-gray-900">
                Attachments ({existingAttachments.length})
              </h4>

              <div>
                <input
                  type="file"
                  ref={addFileInputRef}
                  className="hidden"
                  multiple
                  onChange={(e) => handleAddAttachmentFiles(e.target.files)}
                />

                {attachmentError && (
                  <p className="mt-2 text-sm text-red-600">{attachmentError}</p>
                )}

                <Button
                  type="button"
                  icon={Paperclip}
                  onClick={handleClickAddAttachment}
                >
                  Add Attachment
                </Button>
              </div>
            </div>

            {existingAttachments.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
                No attachments yet.
              </div>
            ) : (
              <div className="space-y-3">
                {existingAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Paperclip className="w-4 h-4 text-gray-500" />

                      <div>
                        <a
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {att.file_name}
                        </a>

                        <div className="text-xs text-gray-500">
                          {(att.file_size / (1024 * 1024)).toFixed(2)} MB
                          {att.uploaded_at
                            ? ` · ${new Date(att.uploaded_at).toLocaleDateString()}`
                            : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={Download}
                        onClick={() => handleDownloadExistingAttachment(att)}
                        title="Download"
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() => handleDeleteExistingAttachment(att.id)}
                        title="Delete"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add mode: show uploader for new files as before */}

        {!license && (
          <div className="mt-8">
            <h4 className="text-md font-semibold text-gray-900 mb-2">
              Attachments (Multiple)
            </h4>

            <input
              type="file"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="block w-full text-sm text-gray-700"
            />

            {attachmentError && (
              <p className="mt-1 text-sm text-red-600">{attachmentError}</p>
            )}

            {formData.attachments.length > 0 && (
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                {formData.attachments.map((f, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span>
                      {f.name} — {(f.size / (1024 * 1024)).toFixed(2)} MB
                    </span>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => removeAttachment(i)}
                    />
                  </div>
                ))}

                <p className="text-xs text-gray-500">
                  Max 50 MB, Min 10 KB per file
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Customer Information (Multiple Optional) */}

      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900">
          Customer Information
        </h3>

        <p className="text-sm text-gray-600 mb-4">
          You can add multiple customers (optional)
        </p>

        <div className="mb-2">
          <Button type="button" size="sm" icon={Plus} onClick={addCustomer}>
            Add Customer
          </Button>
        </div>

        <div className="space-y-4">
          {formData.customers.map((c, idx) => (
            <div key={idx} className="p-4 bg-white rounded border">
              {/* NEW: Master customer dropdown per row */}

              <Select
                label="Customer (from master)"
                value={formData.customers[idx].customer_id || ""}
                onChange={(val) => selectExistingCustomer(idx, val)}
                options={customerOptions}
                placeholder="Select existing customer (optional)"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Input
                  label="Company Name"
                  value={c.company_name}
                  onChange={(v) => updateCustomer(idx, "company_name", v)}
                />

                <Input
                  label="Contact Person"
                  value={c.contact_person || ""}
                  onChange={(v) => updateCustomer(idx, "contact_person", v)}
                />

                <Input
                  label="Contact Email"
                  type="email"
                  value={c.contact_email || ""}
                  onChange={(v) => updateCustomer(idx, "contact_email", v)}
                />

                <Input
                  label="Contact Number"
                  value={c.contact_number || ""}
                  onChange={(v) => updateCustomer(idx, "contact_number", v)}
                />

                <Input
                  label="Address"
                  value={c.address || ""}
                  onChange={(v) => updateCustomer(idx, "address", v)}
                />
              </div>

              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={() => removeCustomer(idx)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}

          {formData.customers.length === 0 && (
            <p className="text-sm text-gray-500">No customers added.</p>
          )}
        </div>
      </div>

      {/* Distributor Information (Multiple Optional) */}

      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900">
          Distributor Information
        </h3>

        <p className="text-sm text-gray-600 mb-4">
          You can add multiple distributors (optional)
        </p>

        <div className="mb-2">
          <Button type="button" size="sm" icon={Plus} onClick={addDistributor}>
            Add Distributor
          </Button>
        </div>

        <div className="space-y-4">
          {formData.distributors.map((d, idx) => (
            <div key={idx} className="p-4 bg-white rounded border">
              <Select
                label="Distributor (from master)"
                value={formData.distributors[idx].distributor_id || ""}
                onChange={(val) => selectExistingDistributor(idx, val)}
                options={distributorOptions}
                placeholder="Select existing distributor (optional)"
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Input
                  label="Company Name"
                  value={d.company_name}
                  onChange={(v) => updateDistributor(idx, "company_name", v)}
                />

                <Input
                  label="Contact Person"
                  value={d.contact_person || ""}
                  onChange={(v) => updateDistributor(idx, "contact_person", v)}
                />

                <Input
                  label="Contact Email"
                  type="email"
                  value={d.contact_email || ""}
                  onChange={(v) => updateDistributor(idx, "contact_email", v)}
                />

                <Input
                  label="Contact Number"
                  value={d.contact_number || ""}
                  onChange={(v) => updateDistributor(idx, "contact_number", v)}
                />
              </div>

              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  onClick={() => removeDistributor(idx)}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}

          {formData.distributors.length === 0 && (
            <p className="text-sm text-gray-500">No distributors added.</p>
          )}
        </div>
      </div>

      {/* Additional Information */}

      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Additional Information
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Remarks
            </label>

            <textarea
              value={formData.remark}
              onChange={(e) => handleChange("remark", e.target.value)}
              rows={3}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3"
              placeholder="Additional notes or remarks..."
            />
          </div>

          {/* Auto Renew removed */}
        </div>
      </div>

      {/* Form Actions */}

      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        <Button
          type="button"
          variant="secondary"
          icon={X}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>

        <Button
          type="submit"
          icon={Save}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          {license ? "Update License" : "Create License"}
        </Button>
      </div>
    </form>
  );
};
