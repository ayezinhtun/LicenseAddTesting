import React, { useEffect, useState } from "react";
import { Card } from "../common/Card";
import { Button } from "../common/Button";
import { RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useLicenseStore, License } from "../../store/licenseStore";
import toast from "react-hot-toast";

export const RecentlyDeleted: React.FC = () => {
  const [rows, setRows] = useState<License[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      // Auto purge anything older than 30 days
      await useLicenseStore.getState().purgeOldDeletedLicenses();
      // Then load only last 30 days
      const data = await useLicenseStore.getState().fetchRecentlyDeleted();
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRecover = async (id: string) => {
    await useLicenseStore.getState().recoverLicense(id);
    await useLicenseStore.getState().fetchLicenses();
    await load();
    toast.success("License recovered");
  };

  const handlePermanentDelete = async (id: string) => {
    if (
      !window.confirm("Permanently delete this license? This cannot be undone.")
    )
      return;
    await useLicenseStore.getState().permanentlyDeleteLicense(id);
    await useLicenseStore.getState().fetchLicenses();
    await load();
    toast.success("License permanently deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recently Deleted</h1>
          <p className="text-gray-600 mt-1">
            Items deleted within the last 30 days
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" icon={RefreshCw} onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-6 text-gray-500">
              No recently deleted licenses.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Deleted At
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {l.project_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {l.vendor}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {l.item_description}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {(l as any).deleted_at
                        ? new Date((l as any).deleted_at).toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={RotateCcw}
                          onClick={() => handleRecover(l.id)}
                        >
                          Recover
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Trash2}
                          className="text-red-600 hover-text-red-700"
                          onClick={() => handlePermanentDelete(l.id)}
                        >
                          Delete Permently
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
};

export default RecentlyDeleted;
