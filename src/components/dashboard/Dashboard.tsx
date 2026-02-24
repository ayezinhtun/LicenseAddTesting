import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { OverviewCards } from "./OverviewCards";
import { NotificationsList } from "./NotificationsList";
import { RecentActivity } from "./RecentActivity";
import { QuickActions } from "./QuickActions";
import { useLicenseStore } from "../../store/licenseStore";
import { useAuthStore } from "../../store/authStore";
import { useNotificationStore } from "../../store/notificationStore";
import { createClient } from "@supabase/supabase-js";

export const Dashboard: React.FC = () => {
  const { fetchLicenses } = useLicenseStore();
  const { user } = useAuthStore();
  const { notifications, fetchNotifications } = useNotificationStore();

  useEffect(() => {
    if (!user) return;

    const supabaseUrl = process.env.SUPABASE_URL || Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload: PostgresChangesPayload<any>) => {
        console.log('New notification received:', payload);
        // New notification received - fetch immediately
        fetchNotifications();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id]);

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
