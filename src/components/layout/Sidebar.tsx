import React from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Bell,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  User,
  Shield,
  Activity,
  HelpCircle,
  Zap,
  Building2,
  Users,
  ClipboardList,
  Trash,
  Clock,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { Button } from "../common/Button";
import { Badge } from "../common/Badge";
// import { useLicenseStore } from '../../store/licenseStore';
import { useNotificationStore } from "../../store/notificationStore";

const menuItems = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    path: "/dashboard",
    badge: null,
  },
  {
    icon: Users,
    label: "Vendor Manager",
    path: "/vendors",
    badge: null,
    adminOnly: true,
  },
  {
    icon: ClipboardList,
    label: "Project Assign",
    path: "/project-assign",
    badge: null,
    adminOnly: true,
  },
  {
    icon: User,
    label: "Customer Manager",
    path: "/customers",
    badge: null,
    adminOnly: true,
  },
  {
    icon: Building2,
    label: "Distributor Manager",
    path: "/distributors",
    badge: null,
    adminOnly: true,
  },
  { icon: FileText, label: "License Manager", path: "/licenses", badge: null },
  {
    icon: Clock,
    label: "Recent Deleted",
    path: "/licenses/deleted",
    badge: null,
    adminOnly: true,
  },
  {
    icon: BarChart3,
    label: "Reports & Analytics",
    path: "/reports",
    badge: null,
  },
  {
    icon: Bell,
    label: "Notifications",
    path: "/notifications",
    badge: "notifications",
  },
  { icon: Activity, label: "Audit Logs", path: "/audit", badge: null },
  { icon: Settings, label: "Account Settings", path: "/account", badge: null },
];

export const Sidebar: React.FC<{
  isCollapsed: boolean;
  onToggle: () => void;
  isHidden?: boolean;
  onHideToggle?: () => void;
}> = ({ isCollapsed, onToggle, isHidden = false, onHideToggle }) => {
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const visibleItems = menuItems.filter(
    (item) =>
      !("adminOnly" in item) || !item.adminOnly || user?.role === "admin",
  );

  // const { getLicensesNearExpiry } = useLicenseStore();

  const { notifications } = useNotificationStore();
  const notificationCount = notifications.filter((n) => !n.is_read).length;

  const handleLogout = () => {
    logout();
  };

  const getBadgeCount = (badgeType: string | null) => {
    switch (badgeType) {
      case "notifications":
        return notificationCount > 0 ? notificationCount : null;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ x: -280 }}
      animate={{ x: isHidden ? -280 : 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`bg-white shadow-xl h-screen fixed left-0 top-0 z-40 transition-all duration-300 ${
        isHidden ? "w-0 overflow-hidden" : isCollapsed ? "w-20" : "w-72"
      } flex flex-col min-h-0`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex items-center space-x-3"
              >
                <img
                  src="https://1cloudtechnology.com/assets/onecloudlogo.png"
                  alt="1Cloud Technology"
                  className="h-10 w-auto"
                />
                <div>
                  <h1 className="font-bold text-gray-900 text-lg">
                    License Manager
                  </h1>
                  <p className="text-xs text-gray-500">1Cloud Technology</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            variant="ghost"
            size="sm"
            icon={isCollapsed ? ChevronRight : ChevronLeft}
            onClick={onToggle}
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            animate={false}
          />
        </div>
      </div>

      {/* User Profile */}
      <AnimatePresence>
        {!isCollapsed && user && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-4 border-b border-gray-100"
          >
            <div className="flex items-center space-x-3">
              <div className="relative">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 border-2 border-white rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {user.name}
                </p>
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                <Badge variant="primary" size="sm" className="mt-1">
                  {user.role}
                </Badge>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {visibleItems.map((item, index) => {
          const isActive = location.pathname === item.path;
          const badgeCount = getBadgeCount(item.badge);

          return (
            <motion.div
              key={item.path}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <Link
                to={item.path}
                className={`flex items-center px-3 py-3 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <item.icon
                  className={`${isCollapsed ? "mx-auto" : "mr-3"} h-5 w-5 flex-shrink-0`}
                />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center justify-between flex-1"
                    >
                      <span className="font-medium">{item.label}</span>
                      {badgeCount && (
                        <Badge variant="danger" size="sm">
                          {badgeCount}
                        </Badge>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </Link>
            </motion.div>
          );
        })}

        {/* Admin-only: User Management */}
        {user?.role === "admin" && (
          <motion.div
            key="/users"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: menuItems.length * 0.05 }}
          >
            <Link
              to="/users"
              className={`flex items-center px-3 py-3 rounded-xl transition-all duration-200 group ${
                location.pathname === "/users"
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <User
                className={`${isCollapsed ? "mx-auto" : "mr-3"} h-5 w-5 flex-shrink-0`}
              />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between flex-1"
                  >
                    <span className="font-medium">User Management</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </Link>
          </motion.div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <Button
          variant="ghost"
          icon={LogOut}
          onClick={handleLogout}
          className={`w-full text-gray-600 hover:text-red-600 hover:bg-red-50 ${
            isCollapsed ? "px-0 justify-center" : "justify-start"
          }`}
          animate={false}
        >
          {!isCollapsed && "Sign Out"}
        </Button>

        
      </div>
    </motion.div>
  );
};
