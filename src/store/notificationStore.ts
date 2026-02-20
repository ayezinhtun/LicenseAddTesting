import { create } from "zustand";

import { supabase } from "../lib/supabase";

import { useAuthStore } from "./authStore";

import { EmailService } from "../lib/emailService";

export interface Notification {
  id: string;

  type: "expiry" | "renewal" | "comment" | "system" | "warning" | "info";

  title: string;

  message: string;

  license_id: string | null;

  user_id: string;

  is_read: boolean;

  priority: "low" | "medium" | "high";

  action_required: boolean;

  action_url: string | null;

  created_at: string;

  expires_at: string | null;
}

interface NotificationState {
  notifications: Notification[];

  unreadCount: number;

  isLoading: boolean;

  realtimeSubscription: any;

  emailNotificationsEnabled: boolean;

  // Actions

  fetchNotifications: () => Promise<void>;

  markAsRead: (id: string) => Promise<void>;

  markAllAsRead: () => Promise<void>;

  deleteNotification: (id: string) => Promise<void>;

  createNotification: (
    notification: Omit<Notification, "id" | "created_at">,
  ) => Promise<Notification>;

  subscribeToRealtime: () => void;

  unsubscribeFromRealtime: () => void;

  sendDailyExpiryReminders: () => Promise<void>;

  sendEmailNotification: (
    notification: Notification,
    userEmail: string,
  ) => Promise<void>;

  getCurrentUser: () => Promise<{
    id: string;
    name: string;
    email: string;
  } | null>;

  // Email settings

  setEmailNotificationsEnabled: (enabled: boolean) => void;

  sendNotificationToUser: (
    userId: string,
    notification: Omit<Notification, "id" | "created_at" | "user_id">,
    userEmail?: string,
  ) => Promise<void>;

  // Bulk operations

  bulkMarkAsRead: (ids: string[]) => Promise<void>;

  bulkDelete: (ids: string[]) => Promise<void>;

  // Filtering and search

  getNotificationsByType: (type: string) => Notification[];

  getUnreadNotifications: () => Notification[];

  searchNotifications: (query: string) => Notification[];
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

  unreadCount: 0,

  isLoading: false,

  realtimeSubscription: null,

  emailNotificationsEnabled: true,

  getCurrentUser: async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        return {
          id: user.id,

          name: user.user_metadata?.name || user.email || "Unknown User",

          email: user.email || "",
        };
      }

      return null;
    } catch (error) {
      console.error("Error getting current user:", error);

      return null;
    }
  },

  fetchNotifications: async () => {
    try {
      set({ isLoading: true });

      const currentUser = await get().getCurrentUser();
      if (!currentUser) {
        set({ notifications: [], unreadCount: 0, isLoading: false });
        return;
      }

      const { user, assignments } = useAuthStore.getState();
      const role = user?.role;

      let baseNotifications: any[] = [];

      if (role === "admin") {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);

        if (error) throw error;

        baseNotifications = data || [];
      }

      else if (role === "super_user" || role === "user") {

        const assignList =
          assignments && assignments.length > 0 ? assignments : [];

        let expiryRows: any[] = [];

        // 🔹 Expiry notifications for assigned projects
        if (assignList.length > 0) {
          const { data: joined, error: joinErr } = await supabase
            .from("notifications")
            .select(`
            *,
            licenses!inner(
              id,
              project_assign
            )
          `)
            .eq("type", "expiry")
            .in("licenses.project_assign", assignList as any)
            .order("created_at", { ascending: false })
            .limit(200);

          if (!joinErr && joined) {
            expiryRows = joined;
          }
        }

        // 🔹 Non-expiry notifications for self
        const { data: ownRows, error: ownErr } = await supabase
          .from("notifications")
          .select("*")
          .neq("type", "expiry")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false })
          .limit(200);

        if (ownErr) throw ownErr;

        baseNotifications = [...expiryRows, ...(ownRows || [])]
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
          .slice(0, 200);
      }

      else {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false })
          .limit(200);

        if (error) throw error;

        baseNotifications = data || [];
      }


      const notificationIds = baseNotifications.map(n => n.id);

      let readMap: Record<string, boolean> = {};
      let deletedMap: Record<string, boolean> = {};

      if (notificationIds.length > 0) {

        // Get read notifications
        const { data: readData } = await supabase
          .from("notification_reads")
          .select("notification_id")
          .eq("user_id", currentUser.id)
          .in("notification_id", notificationIds);

        readMap = (readData || []).reduce((acc: any, item: any) => {
          acc[item.notification_id] = true;
          return acc;
        }, {});

        // Get deleted notifications
        const { data: deletedData } = await supabase
          .from("notification_deletions")
          .select("notification_id")
          .eq("user_id", currentUser.id)
          .in("notification_id", notificationIds);

        deletedMap = (deletedData || []).reduce((acc: any, item: any) => {
          acc[item.notification_id] = true;
          return acc;
        }, {});
      }

      const finalNotifications = baseNotifications
        .map(n => ({
          ...n,
          is_read: readMap[n.id] || false,
        }))
        .filter(n => {
          // 🔥 If expiry → always show
          if (n.type === "expiry") return true;

          // Other types → hide if deleted
          return !deletedMap[n.id];
        });


      const unreadCount = finalNotifications.filter(
        n => !n.is_read
      ).length;

      set({
        notifications: finalNotifications,
        unreadCount,
        isLoading: false,
      });

    } catch (error) {
      console.error("Error fetching notifications:", error);
      set({ isLoading: false });
    }
  },


  markAsRead: async (id) => {
    try {
      const { user } = useAuthStore.getState();
      if (!user) return;

      const { error } = await supabase
        .from('notification_reads')
        .upsert(
          {
            notification_id: id,
            user_id: user.id
          },
          {
            onConflict: 'notification_id,user_id'
          }
        );

      if (error) throw error;

      set(state => ({
        notifications: state.notifications.map(n =>
          n.id === id ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));

    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  },


  markAllAsRead: async () => {
    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) return;

      // Get all unread notifications for current user
      const unreadNotifications = get().notifications.filter(n => !n.is_read);

      // Insert read records for current user ONLY
      const readRecords = unreadNotifications.map(n => ({
        notification_id: n.id,
        user_id: currentUser.id
      }));

      if (readRecords.length > 0) {
        const { error } = await supabase
          .from('notification_reads')
          .insert(readRecords);

        if (error) throw error;
      }

      // Update local state
      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, is_read: true })),
        unreadCount: 0
      }));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  },

  deleteNotification: async (id) => {
    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) return;

      // Insert per-user deletion record
      const { error } = await supabase
        .from("notification_deletions")
        .upsert(
          {
            notification_id: id,
            user_id: currentUser.id,
          },
          {
            onConflict: "notification_id,user_id",
          }
        );

      if (error) throw error;

      // Remove from local state only
      set((state) => {
        const notification = state.notifications.find(n => n.id === id);

        const updatedNotifications = state.notifications.filter(
          n => n.id !== id
        );

        const newUnreadCount =
          notification && !notification.is_read
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount;

        return {
          notifications: updatedNotifications,
          unreadCount: newUnreadCount,
        };
      });

    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  },


  createNotification: async (notificationData) => {
    try {
      const currentUser = await get().getCurrentUser();

      if (!currentUser) {
        throw new Error("No authenticated user found");
      }

      const { data, error } = await supabase

        .from("notifications")

        .insert({
          ...notificationData,
          user_id: currentUser.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Send email notification if enabled

      if (get().emailNotificationsEnabled && data) {
        await get().sendEmailNotification(data, currentUser.email);
      }

      set((state) => {
        if (state.notifications.some((n) => n.id === data.id)) return state;

        return {
          notifications: [data, ...state.notifications],

          unreadCount: state.unreadCount + 1,
        };
      });

      return data;
    } catch (error) {
      console.error("Error creating notification:", error);

      throw error;
    }
  },

  sendNotificationToUser: async (userId, notificationData, userEmail) => {
    try {
      // Create notification in database

      const { data, error } = await supabase

        .from("notifications")

        .insert([
          {
            ...notificationData,

            user_id: userId,
          },
        ])

        .select()

        .single();

      if (error) throw error;

      // Send email notification if enabled and user email is provided

      if (get().emailNotificationsEnabled && userEmail && data) {
        await get().sendEmailNotification(data, userEmail);
      }

      // Update local state if this is for the current user

      const currentUser = await get().getCurrentUser();

      if (currentUser && currentUser.id === userId) {
        set((state) => {
          if (state.notifications.some((n) => n.id === data.id)) return state;

          return {
            notifications: [data, ...state.notifications],

            unreadCount: state.unreadCount + 1,
          };
        });
      }
    } catch (error) {
      console.error("Error sending notification to user:", error);

      throw error;
    }
  },

  setEmailNotificationsEnabled: (enabled) => {
    set({ emailNotificationsEnabled: enabled });
  },

  bulkMarkAsRead: async (ids) => {
    try {
      const { error } = await supabase

        .from("notifications")

        .update({ is_read: true })

        .in("id", ids);

      if (error) throw error;

      set((state) => {
        const updatedNotifications = state.notifications.map((n) =>
          ids.includes(n.id) ? { ...n, is_read: true } : n,
        );

        const markedCount = state.notifications.filter(
          (n) => ids.includes(n.id) && !n.is_read,
        ).length;

        return {
          notifications: updatedNotifications,

          unreadCount: Math.max(0, state.unreadCount - markedCount),
        };
      });
    } catch (error) {
      console.error("Error bulk marking notifications as read:", error);

      throw error;
    }
  },

  bulkDelete: async (ids) => {
    try {
      const { error } = await supabase

        .from("notifications")

        .delete()

        .in("id", ids);

      if (error) throw error;

      set((state) => {
        const deletedUnreadCount = state.notifications.filter(
          (n) => ids.includes(n.id) && !n.is_read,
        ).length;

        return {
          notifications: state.notifications.filter((n) => !ids.includes(n.id)),

          unreadCount: Math.max(0, state.unreadCount - deletedUnreadCount),
        };
      });
    } catch (error) {
      console.error("Error bulk deleting notifications:", error);

      throw error;
    }
  },

  getNotificationsByType: (type) => {
    return get().notifications.filter((n) => n.type === type);
  },

  getUnreadNotifications: () => {
    return get().notifications.filter((n) => !n.is_read);
  },

  searchNotifications: (query) => {
    const lowerQuery = query.toLowerCase();

    return get().notifications.filter(
      (n) =>
        n.title.toLowerCase().includes(lowerQuery) ||
        n.message.toLowerCase().includes(lowerQuery),
    );
  },

  subscribeToRealtime: () => {
    // Check if subscription already exists to prevent duplicate subscriptions

    if (get().realtimeSubscription) {
      return;
    }

    const subscription = supabase

      .channel("notifications")

      .on(
        "postgres_changes",

        { event: "INSERT", schema: "public", table: "notifications" },

        async (payload) => {
          const newNotification = payload.new as Notification;

          const role = useAuthStore.getState().user?.role;

          const currentUser = await get().getCurrentUser();

          const isVisible =
            role === "admin" ||
            (currentUser && currentUser.id === newNotification.user_id);

          if (!isVisible) return;

          // Send email notification for current user if enabled

          if (
            get().emailNotificationsEnabled &&
            currentUser &&
            currentUser.id === newNotification.user_id
          ) {
            await get().sendEmailNotification(
              newNotification,
              currentUser.email,
            );
          }

          set((state) => {
            if (state.notifications.some((n) => n.id === newNotification.id))
              return state;

            return {
              notifications: [newNotification, ...state.notifications],

              unreadCount: state.unreadCount + 1,
            };
          });
        },
      )

      .on(
        "postgres_changes",

        { event: "UPDATE", schema: "public", table: "notifications" },

        async (payload) => {
          const updatedNotification = payload.new as Notification;

          const role = useAuthStore.getState().user?.role;

          const currentUser = await get().getCurrentUser();

          const isVisible =
            role === "admin" ||
            (currentUser && currentUser.id === updatedNotification.user_id);

          if (!isVisible) return;

          set((state) => ({
            notifications: state.notifications.map((n) =>
              n.id === updatedNotification.id ? updatedNotification : n,
            ),
          }));
        },
      )

      .on(
        "postgres_changes",

        { event: "DELETE", schema: "public", table: "notifications" },

        async (payload) => {
          const deleted = payload.old as any;

          const role = useAuthStore.getState().user?.role;

          const currentUser = await get().getCurrentUser();

          const isVisible =
            role === "admin" ||
            (currentUser && currentUser.id === deleted.user_id);

          if (!isVisible) return;

          const deletedId = deleted.id;

          set((state) => ({
            notifications: state.notifications.filter(
              (n) => n.id !== deletedId,
            ),
          }));
        },
      )

      .subscribe();

    set({ realtimeSubscription: subscription });
  },

  unsubscribeFromRealtime: () => {
    const { realtimeSubscription } = get();

    if (realtimeSubscription) {
      supabase.removeChannel(realtimeSubscription);

      set({ realtimeSubscription: null });
    }
  },

  

  sendDailyExpiryReminders: async () => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);

      // Get all expired serials (end_date < today)
      const { data: expiredSerials, error: expiredError } = await supabase
        .from("license_serials")
        .select(`
        *,
        licenses!inner(created_by, item_description)
      `)
        .lt("end_date", todayStr);

      if (expiredError) throw expiredError;

      // Get all expiring soon serials (today to +30 days)
      const thirtyDaysFromNow = new Date(today);
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      const endStr = thirtyDaysFromNow.toISOString().slice(0, 10);

      const { data: expiringSerials, error: expiringError } = await supabase
        .from("license_serials")
        .select(`
        *,
        licenses!inner(created_by, item_description)
      `)
        .gte("end_date", todayStr)
        .lte("end_date", endStr);

      if (expiringError) throw expiringError;

      // Process expired serials
      for (const serial of expiredSerials || []) {
        const daysOverdue = Math.ceil(
          (today.getTime() - new Date(serial.end_date).getTime()) / (1000 * 60 * 60 * 24)
        );

        // SIMPLER CHECK: Get all notifications for this serial today
        const { data: existingNotifications } = await supabase
          .from("notifications")
          .select("id, created_at")
          .eq("type", "expiry")
          .eq("license_id", serial.license_id)
          .gte("created_at", todayStr + "T00:00:00.000Z");

        // ONLY CREATE IF NO NOTIFICATIONS EXIST TODAY
        if (!existingNotifications || existingNotifications.length === 0) {
          console.log("Creating expired notification for:", serial.serial_or_contract);

          await get().sendNotificationToUser(serial.licenses.created_by, {
            type: "expiry",
            title: "Serial License Expired",
            message: `${serial.serial_or_contract} for ${serial.licenses.item_description} expired ${daysOverdue} day(s) ago`,
            license_id: serial.license_id,
            is_read: false,
            priority: "high",
            action_required: true,
            action_url: `/licenses/${serial.license_id}?serial=${serial.id}`,
            expires_at: null,
          });
        } else {
          console.log("Notification already exists for:", serial.serial_or_contract);
        }
      }

      // Process expiring soon serials
      for (const serial of expiringSerials || []) {
        const daysUntil = Math.ceil(
          (new Date(serial.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        // SIMPLER CHECK: Get all notifications for this serial today
        const { data: existingNotifications } = await supabase
          .from("notifications")
          .select("id, created_at")
          .eq("type", "expiry")
          .eq("license_id", serial.license_id)
          .gte("created_at", todayStr + "T00:00:00.000Z");

        // ONLY CREATE IF NO NOTIFICATIONS EXIST TODAY
        if (!existingNotifications || existingNotifications.length === 0) {
          console.log("Creating expiring soon notification for:", serial.serial_or_contract);

          await get().sendNotificationToUser(serial.licenses.created_by, {
            type: "expiry",
            title: "Serial License Expiring Soon",
            message: `${serial.serial_or_contract} for ${serial.licenses.item_description} expires in ${daysUntil} day(s)`,
            license_id: serial.license_id,
            is_read: false,
            priority: daysUntil <= 7 ? "high" : "medium",
            action_required: true,
            action_url: `/licenses/${serial.license_id}?serial=${serial.id}`,
            expires_at: null,
          });
        } else {
          console.log("Expiring soon notification already exists for:", serial.serial_or_contract);
        }
      }
    } catch (error) {
      console.error("Error sending daily expiry reminders:", error);
    }
  },

  sendEmailNotification: async (notification, userEmail) => {
    try {
      if (!userEmail) {
        console.log("No user email provided, skipping email notification");

        return;
      }

      const emailService = EmailService.getInstance();

      // Get notification priority styling

      const getPriorityColor = (priority: string) => {
        switch (priority) {
          case "high":
            return "#dc3545";

          case "medium":
            return "#fd7e14";

          case "low":
            return "#28a745";

          default:
            return "#6c757d";
        }
      };

      const getPriorityIcon = (type: string) => {
        switch (type) {
          case "expiry":
            return "⚠️";

          case "renewal":
            return "🔄";

          case "comment":
            return "💬";

          case "system":
            return "🔔";

          case "warning":
            return "⚠️";

          case "info":
            return "ℹ️";

          default:
            return "📢";
        }
      };

      const priorityColor = getPriorityColor(notification.priority);

      const typeIcon = getPriorityIcon(notification.type);

      await emailService.sendNotificationEmail({
        to: userEmail,

        subject: `${typeIcon} ${notification.title} - 1Cloud Technology`,

        html: `

          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">

            <!-- Header -->

            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">

              <img src="https://1cloudtechnology.com/assets/onecloudlogo.png" alt="1Cloud Technology" style="height: 50px; margin-bottom: 15px;">

              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">License Management System</h1>

              <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Notification Alert</p>

            </div>

            

            <!-- Content -->

            <div style="padding: 30px 20px; background: white; margin: 0 20px;">

              <!-- Priority Badge -->

              <div style="text-align: center; margin-bottom: 25px;">

                <span style="background: ${priorityColor}; color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">

                  ${notification.priority} Priority

                </span>

              </div>

              
              <!-- Notification Content -->

              <div style="background: #f8f9fa; padding: 25px; border-radius: 12px; border-left: 4px solid ${priorityColor}; margin-bottom: 25px;">

                <h2 style="color: #333; margin: 0 0 15px 0; font-size: 20px; font-weight: 600;">

                  ${typeIcon} ${notification.title}

                </h2>

                <p style="color: #666; margin: 0; font-size: 16px; line-height: 1.6;">

                  ${notification.message}

                </p>

              </div>

              

              <!-- Action Button -->

              ${notification.action_url
            ? `

                <div style="text-align: center; margin: 30px 0;">

                  <a href="${window.location.origin}${notification.action_url}" 

                     style="background: ${priorityColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: all 0.3s ease;">

                    View Details

                  </a>

                </div>

              `
            : ""
          }

              

              <!-- Additional Info -->

              ${notification.action_required
            ? `

                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin-top: 20px;">

                  <p style="margin: 0; color: #856404; font-size: 14px; font-weight: 500;">

                    ⚡ Action Required: This notification requires your immediate attention.

                  </p>

                </div>

              `
            : ""
          }

            </div>

            

            <!-- Footer -->

            <div style="background: #343a40; color: white; padding: 25px 20px; text-align: center; margin: 0 20px;">

              <p style="margin: 0 0 10px 0; font-size: 14px; color: #adb5bd;">

                This is an automated notification from 1Cloud Technology License Management System.

              </p>

              <p style="margin: 0; font-size: 12px; color: #6c757d;">

                © ${new Date().getFullYear()} 1Cloud Technology. All rights reserved.

              </p>

              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #495057;">

                <p style="margin: 0; font-size: 11px; color: #6c757d;">

                  If you no longer wish to receive these notifications, please contact your system administrator.

                </p>

              </div>

            </div>

            

            <!-- Bottom Spacing -->

            <div style="height: 20px;"></div>

          </div>

        `,

        type: notification.type,
      });

      console.log(
        `Email notification sent to ${userEmail} for: ${notification.title}`,
      );
    } catch (error) {
      console.error("Error sending email notification:", error);

      // Don't throw the error to prevent breaking the notification creation
    }
  },
}));
