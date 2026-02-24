import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { OverviewCards } from "./OverviewCards";
import { NotificationsList } from "./NotificationsList";
import { RecentActivity } from "./RecentActivity";
import { QuickActions } from "./QuickActions";
import { useLicenseStore } from "../../store/licenseStore";
import { useAuthStore } from "../../store/authStore";

export const Dashboard: React.FC = () => {
  const { fetchLicenses } = useLicenseStore();
  const { user } = useAuthStore();
  useEffect(() => {
    fetchLicenses();
  }, [fetchLicenses]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-4xl font-bold text-gray-900">
            {getGreeting()}, {user?.name?.split(" ")[0]}! 👋
          </h1>
          <p className="text-gray-600 mt-2 text-lg">
            Here's what's happening with your licenses today
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </motion.div>

      {/* Overview Cards */}
      <OverviewCards />

      {/* Quick Actions */}
      <QuickActions />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Charts and Analytics */}
        <div className="lg:col-span-2 space-y-8">
          {/* <ChartWidget /> */}
          <RecentActivity />
        </div>

        {/* Right Column - Notifications and Calendar */}
        <div className="space-y-8">
          {/* <CalendarWidget /> */}
          <NotificationsList />
        </div>
      </div>
    </div>
  );
};
