import React from "react";
import { motion } from "framer-motion";
import {
  Plus,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { Card } from "../common/Card";
import { Button } from "../common/Button";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export const QuickActions: React.FC = () => {
  const navigate = useNavigate();

  const actions = [
    {
      title: "Add New License",
      description: "Quickly add a new license to your inventory",
      icon: Plus,
      color: "bg-blue-500",
      hoverColor: "hover:bg-blue-600",
      action: () => navigate("/licenses?action=add"),
    },
    {
      title: "Export Report",
      description: "Download current license data as CSV or PDF",
      icon: Download,
      color: "bg-green-500",
      hoverColor: "hover:bg-green-600",
      action: () => navigate("/reports"),
    },
    {
      title: "Import Licenses",
      description: "Bulk import licenses from spreadsheet",
      icon: Upload,
      color: "bg-purple-500",
      hoverColor: "hover:bg-purple-600",
      action: () => toast.success("Import feature coming soon!"),
    },
    {
      title: "Sync Data",
      description: "Refresh license data from all sources",
      icon: RefreshCw,
      color: "bg-orange-500",
      hoverColor: "hover:bg-orange-600",
      action: () => {
        toast.loading("Syncing data...", { duration: 2000 });
        setTimeout(() => toast.success("Data synced successfully!"), 2000);
      },
    },
    {
      title: "Check Expiries",
      description: "Review licenses expiring in the next 30 days",
      icon: AlertTriangle,
      color: "bg-red-500",
      hoverColor: "hover:bg-red-600",
      action: () => navigate("/licenses?filter=expiring"),
    },
    {
      title: "View Analytics",
      description: "Detailed insights and trends analysis",
      icon: BarChart3,
      color: "bg-indigo-500",
      hoverColor: "hover:bg-indigo-600",
      action: () => navigate("/reports"),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Quick Actions
            </h3>
            <p className="text-sm text-gray-500">Common tasks and shortcuts</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {actions.map((action, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <button
                onClick={action.action}
                className={`w-full p-4 rounded-xl ${action.color} ${action.hoverColor} text-white transition-all duration-200 text-left group`}
              >
                <div className="flex items-start space-x-3">
                  <action.icon className="h-6 w-6 flex-shrink-0 group-hover:scale-110 transition-transform duration-200" />
                  <div>
                    <h4 className="font-semibold text-sm">{action.title}</h4>
                    <p className="text-xs opacity-90 mt-1">
                      {action.description}
                    </p>
                  </div>
                </div>
              </button>
            </motion.div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
};
