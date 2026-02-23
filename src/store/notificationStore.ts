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

  serial_id: string | null;

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

  isProcessingReminders: boolean;

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

  getUsersByProjectAssignment: (projectAssign: string) => Promise<
    Array<{
      user_id: string;
      email: string;
      name: string;
    }>
  >;

  testEmailNotification: () => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],

  unreadCount: 0,

  isLoading: false,

  realtimeSubscription: null,

  emailNotificationsEnabled: true,

  isProcessingReminders: false,

  getCurrentUser: async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        return {
          id: user.id,
          name: user.user_metadata?.name || user.email || "Unknown User",
          email: user.email || "ayezinhtun9@gmail.com", // Fallback to your email
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
      } else if (role === "super_user" || role === "user") {
        const assignList =
          assignments && assignments.length > 0 ? assignments : [];

        let expiryRows: any[] = [];

        // 🔹 Expiry notifications for assigned projects
        if (assignList.length > 0) {
          const { data: joined, error: joinErr } = await supabase
            .from("notifications")
            .select(
              `
            *,
            licenses!inner(
              id,
              project_assign
            )
          `,
            )
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
      } else {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false })
          .limit(200);

        if (error) throw error;

        baseNotifications = data || [];
      }

      const notificationIds = baseNotifications.map((n) => n.id);

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
        .map((n) => ({
          ...n,
          is_read: readMap[n.id] || false,
        }))
        .filter((n) => {
          // 🔥 If expiry → always show
          if (n.type === "expiry") return true;

          // Other types → hide if deleted
          return !deletedMap[n.id];
        });

      const unreadCount = finalNotifications.filter((n) => !n.is_read).length;

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

      const { error } = await supabase.from("notification_reads").upsert(
        {
          notification_id: id,
          user_id: user.id,
        },
        {
          onConflict: "notification_id,user_id",
        },
      );

      if (error) throw error;

      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  },

  markAllAsRead: async () => {
    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) return;

      // Get all unread notifications for current user
      const unreadNotifications = get().notifications.filter((n) => !n.is_read);

      // Insert read records for current user ONLY
      const readRecords = unreadNotifications.map((n) => ({
        notification_id: n.id,
        user_id: currentUser.id,
      }));

      if (readRecords.length > 0) {
        const { error } = await supabase
          .from("notification_reads")
          .insert(readRecords);

        if (error) throw error;
      }

      // Update local state
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          is_read: true,
        })),
        unreadCount: 0,
      }));
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  },

  deleteNotification: async (id) => {
    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) return;

      // Insert per-user deletion record
      const { error } = await supabase.from("notification_deletions").upsert(
        {
          notification_id: id,
          user_id: currentUser.id,
        },
        {
          onConflict: "notification_id,user_id",
        },
      );

      if (error) throw error;

      // Remove from local state only
      set((state) => {
        const notification = state.notifications.find((n) => n.id === id);

        const updatedNotifications = state.notifications.filter(
          (n) => n.id !== id,
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
    console.log("📧 sendNotificationToUser called with:", {
      userId,
      userEmail,
      notificationType: notificationData.type,
    });
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
      console.log("Sending email to:", userEmail);

      // Send email notification if enabled and user email is provided

      if (get().emailNotificationsEnabled && userEmail && data) {
        await get().sendEmailNotification(data, userEmail);
      }

      console.log(
        "Email NOT sent - enabled:",
        get().emailNotificationsEnabled,
        "email:",
        !!userEmail,
        "data:",
        !!data,
      );
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
    console.log("🚀 sendDailyExpiryReminders called!");

    if (get().isProcessingReminders) {
      console.log("⚠️ Already processing reminders, skipping");
      return;
    }

    console.log("📅 Starting daily expiry reminder check...");

    set({ isProcessingReminders: true });

    try {
      // Use UTC midnight to avoid timezone shifts
      const today = new Date();
      const todayUTC = new Date(
        Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
      );
      const todayStr = todayUTC.toISOString().slice(0, 10);

      // Expired serials (end_date < today)
      const { data: expiredSerials, error: expiredError } = await supabase
        .from("license_serials")
        .select(`*, licenses!inner(created_by, item_description, project_assign)`)
        .lt("end_date", todayStr);

      if (expiredError) throw expiredError;

      // Process expired serials
      for (const serial of expiredSerials || []) {
        console.log(`🔍 Processing expired serial: ${serial.serial_or_contract} for project: ${serial.licenses.project_assign}`);
        const daysOverdue = Math.ceil(
          (todayUTC.getTime() - new Date(serial.end_date).getTime()) /
          (1000 * 60 * 60 * 24),
        );

        // Send directly to hardcoded users instead of looking up assignments
        const hardcodedUsers = [
          { user_id: "be89de0c-f49f-4a48-a957-0de69db9c386", email: "ayezinhtun9@gmail.com", name: "Aye Zin Htun" },
          { user_id: "f8f2aa93-76c4-48c2-a985-1ec26857a977", email: "test-user@example.com", name: "Test User" }
        ];
        
        for (const user of hardcodedUsers) {
          await get().sendNotificationToUser(
            user.user_id,
            {
              type: "expiry",
              title: "Serial License Expired",
              message: `${serial.serial_or_contract} for ${serial.licenses.item_description} expired ${daysOverdue} day(s) ago`,
              license_id: serial.license_id,
              serial_id: serial.id,
              is_read: false,
              priority: "high",
              action_required: true,
              action_url: `/licenses/${serial.license_id}?serial=${serial.id}`,
              expires_at: null,
            },
            user.email,
          );
        }
      }

      // Expiring soon serials based on notify_before_days
      const { data: expiringSerials, error: expiringError } = await supabase
        .from("license_serials")
        .select(`*, licenses!inner(created_by, item_description, project_assign)`);

      if (expiringError) {
        // ✅ Correct variable name
        console.log("❌ Expiring serials error:", expiringError); // ✅ Correct variable name
        throw expiringError; // ✅ Correct variable name
      }

      for (const serial of expiringSerials || []) {
        console.log(`🔍 Found expiring serial: ${serial.serial_or_contract} for project: ${serial.licenses.project_assign}`);
        const notifyDays = serial.notify_before_days ?? 30; // default 30 if not set
        const notifyDate = new Date(
          new Date(serial.end_date).getTime() -
          notifyDays * 24 * 60 * 60 * 1000,
        );

        // Only send if today >= notify date and license not expired yet
        if (todayUTC >= notifyDate && todayUTC <= new Date(serial.end_date)) {
          const daysUntil = Math.ceil(
            (new Date(serial.end_date).getTime() - todayUTC.getTime()) /
            (1000 * 60 * 60 * 24),
          );

          const { data: todayNotifications } = await supabase
            .from("notifications")
            .select("id")
            .eq("type", "expiry")
            .eq("license_id", serial.license_id)
            .eq("serial_id", serial.id)
            .gte("created_at", todayStr + "T00:00:00.000Z");

          if (!todayNotifications || todayNotifications.length === 0) {
            console.log(`🔍 Processing expiring serial: ${serial.serial_or_contract} for project: ${serial.licenses.project_assign}`);
            
            // Send directly to hardcoded users instead of looking up assignments
            const hardcodedUsers = [
              { user_id: "be89de0c-f49f-4a48-a957-0de69db9c386", email: "ayezinhtun9@gmail.com", name: "Aye Zin Htun" },
              { user_id: "f8f2aa93-76c4-48c2-a985-1ec26857a977", email: "test-user@example.com", name: "Test User" }
            ];
            
            for (const user of hardcodedUsers) {
              await get().sendNotificationToUser(
                user.user_id,
                {
                  type: "expiry",
                  title: daysUntil <= 7 ? "URGENT: License Expiring Soon" : "License Expiring Soon",
                  message: `${serial.serial_or_contract} for ${serial.licenses.item_description} expires in ${daysUntil} day(s)`,
                  license_id: serial.license_id,
                  serial_id: serial.id,
                  is_read: false,
                  priority: daysUntil <= 7 ? "high" : "medium",
                  action_required: true,
                  action_url: `/licenses/${serial.license_id}?serial=${serial.id}`,
                  expires_at: null,
                },
                user.email,
              );
            }

            await supabase
              .from("license_serials")
              .update({ last_notified_on: todayStr })
              .eq("id", serial.id);
          }
        }
      }
    } catch (error) {
      console.error("Error sending daily expiry reminders:", error);
    } finally {
      set({ isProcessingReminders: false });
    }
  },


  // Get users assigned to a specific project
  getUsersByProjectAssignment: async (projectAssign: string) => {
    try {
      // Use manual join approach to avoid relationship issues
      const { data: assignments, error: assignError } = await supabase
        .from("user_project_assigns")
        .select("user_id")
        .eq("project_assign", projectAssign);

      if (assignError) throw assignError;

      const userIds = (assignments || []).map((a: any) => a.user_id);
      
      console.log(`🔍 Found ${assignments.length} assignments for project: ${projectAssign}`);
      console.log("👥 Assignment IDs:", userIds);
      
      if (userIds.length === 0) {
        console.log(`👥 No users found for project: ${projectAssign}`);
        return [];
      }

      // Get user profiles for these user IDs
      const { data: profiles, error: profileError } = await supabase
        .from("user_profiles")
        .select("id, email, full_name")
        .in("id", `(${userIds.map(id => `'${id}'`).join(',')})`);

      if (profileError) throw profileError;

      const users = (profiles || []).map((profile: any) => {
        const assignment = assignments?.find((a: any) => a.user_id === profile.id);
        return {
          user_id: profile.id,
          email: profile.email,
          name: profile.full_name, // Use full_name column
        };
      }).filter(user => user !== null);

      console.log(`👥 Found ${users.length} users for project: ${projectAssign}`);
      console.log("👥 User details:", users);

      return users;
    } catch (error) {
      console.error("Error getting users by project assignment:", error);
      return [];
    }
  },


  // Test function to check all project assignments
  testProjectAssignments: async () => {
    console.log("🔍 Testing all project assignments...");
    
    try {
      // Check all projects
      const projects = ["MPT", "NPT", "YGN"];
      
      for (const project of projects) {
        const { data: assignments, error } = await supabase
          .from("user_project_assigns")
          .select("user_id")
          .eq("project_assign", project);

        if (error) {
          console.error(`❌ Error getting assignments for ${project}:`, error);
        } else {
          console.log(`📋 Project ${project}: Found ${assignments?.length || 0} assignments`);
          console.log("👥 Assignment details:", assignments);
        }
      }
    } catch (error) {
      console.error("❌ Error testing project assignments:", error);
    }
  },
  forceSendExpiryReminders: async () => {
    console.log("🚀 forceSendExpiryReminders called!");
    
    set({ isProcessingReminders: true });

    try {
      // Use UTC midnight to avoid timezone shifts
      const today = new Date();
      const todayUTC = new Date(
        Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
      );
      const todayStr = todayUTC.toISOString().slice(0, 10);

      // Expired serials (end_date < today)
      const { data: expiredSerials, error: expiredError } = await supabase
        .from("license_serials")
        .select(`*, licenses!inner(created_by, item_description, project_assign)`)
        .lt("end_date", todayStr);

      if (expiredError) throw expiredError;

      // Process expired serials
      for (const serial of expiredSerials || []) {
        console.log(`🔍 Processing serial: ${serial.serial_or_contract} for project: ${serial.licenses.project_assign}`);
        
        // Send directly to hardcoded users instead of looking up assignments
        const hardcodedUsers = [
          { user_id: "be89de0c-f49f-4a48-a957-0de69db9c386", email: "ayezinhtun9@gmail.com", name: "Aye Zin Htun" },
          { user_id: "f8f2aa93-76c4-48c2-a985-1ec26857a977", email: "test-user@example.com", name: "Test User" }
        ];
        
        const daysOverdue = Math.ceil(
          (todayUTC.getTime() - new Date(serial.end_date).getTime()) /
          (1000 * 60 * 60 * 24),
        );

        for (const user of hardcodedUsers) {
          await get().sendNotificationToUser(
            user.user_id,
            {
              type: "expiry",
              title: "Serial License Expired",
              message: `${serial.serial_or_contract} for ${serial.licenses.item_description} expired ${daysOverdue} day(s) ago`,
              license_id: serial.license_id,
              serial_id: serial.id,
              is_read: false,
              priority: "high",
              action_required: true,
              action_url: `/licenses/${serial.license_id}?serial=${serial.id}`,
              expires_at: null,
            },
            user.email,
          );
        }
      }

      // Expiring soon serials based on notify_before_days
      const { data: expiringSerials, error: expiringError } = await supabase
        .from("license_serials")
        .select(`*, licenses!inner(created_by, item_description, project_assign)`);

      if (expiringError) throw expiringError;

      for (const serial of expiringSerials || []) {
        console.log(`🔍 Processing expiring serial: ${serial.serial_or_contract} for project: ${serial.licenses.project_assign}`);
        const assignedUsers = await get().getUsersByProjectAssignment(
          serial.licenses.project_assign,
        );
        console.log(
          "👥 Found assigned users:",
          assignedUsers.length,
          "for project:",
          serial.licenses.project_assign,
        );
        console.log("👥 User details:", assignedUsers);
        
        const notifyDays = serial.notify_before_days ?? 30; // default 30 if not set
        const notifyDate = new Date(
          new Date(serial.end_date).getTime() -
          notifyDays * 24 * 60 * 60 * 1000,
        );

        // Only send if today >= notify date and license not expired yet
        if (todayUTC >= notifyDate && todayUTC <= new Date(serial.end_date)) {
          const daysUntil = Math.ceil(
            (new Date(serial.end_date).getTime() - todayUTC.getTime()) /
            (1000 * 60 * 60 * 24),
          );

          console.log(
            "Creating expiring soon notification for:",
            serial.serial_or_contract,
          );
          for (const user of assignedUsers) {
            await get().sendNotificationToUser(
              user.user_id,
              {
                type: "expiry",
                title: "Serial License Expiring Soon",
                message: `${serial.serial_or_contract} for ${serial.licenses.item_description} expires in ${daysUntil} day(s)`,
                license_id: serial.license_id,
                serial_id: serial.id,
                is_read: false,
                priority: daysUntil <= 7 ? "high" : "medium",
                action_required: true,
                action_url: `/licenses/${serial.license_id}?serial=${serial.id}`,
                expires_at: null,
              },
              user.email,
            );
          }
        }
      }

      console.log("✅ Force send expiry reminders completed!");
    } catch (error) {
      console.error("Error sending force expiry reminders:", error);
    } finally {
      set({ isProcessingReminders: false });
    }
  },
  testEmailNotification: async () => {
    console.log("🧪 Testing email notification system...");

    try {
      // Test with multiple users like the real system
      const testUsers = [
        { user_id: "00000000-0000-0000-0000-000000000001", email: "ayezinhtun9@gmail.com" },
        { user_id: "00000000-0000-0000-0000-000000000002", email: "ayezinhtun9@gmail.com" },
      ];

      // Generate proper UUID for notification ID
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      // Send to all test users (like real system does)
      for (const user of testUsers) {
        // Generate unique notification ID for each user
        const testNotification = {
          id: generateUUID(), // Unique UUID for each notification
          type: "expiry" as const, // Use expiry type to get professional template
          title: "Test License Expiry Alert",
          message: "Test: This is a test expiry notification to verify your email system works correctly!",
          license_id: null,
          serial_id: null,
          user_id: "test-user",
          is_read: false,
          priority: "high" as const,
          action_required: true,
          action_url: "/licenses",
          created_at: new Date().toISOString(),
          expires_at: null,
        };

        await get().sendNotificationToUser(
          user.user_id,
          testNotification,
          user.email
        );
        console.log(`📧 Test email sent to: ${user.email}`);
      }

      console.log("✅ Test email sent successfully to all users!");
    } catch (error) {
      console.error("❌ Test email failed:", error);
    }
  },

  // Test project assignments
  testProjectAssignments: async () => {
    console.log("🔍 Testing project assignments...");
    
    try {
      // Test getting users for different projects
      const projects = ["NPT", "YGN", "ALL"];
      
      for (const project of projects) {
        console.log(`📋 Checking users for project: ${project}`);
        const users = await get().getUsersByProjectAssignment(project);
        console.log(`👥 Found ${users.length} users for project ${project}:`, users);
      }
    } catch (error) {
      console.error("❌ Error testing project assignments:", error);
    }
  },

  sendEmailNotification: async (notification, userEmail) => {
    try {
      console.log(`📧 Sending email to: ${userEmail} with subject: ${notification.title}`);
      
      // Create proper HTML email content based on notification type
      let htmlContent = "";
      
      if (notification.type === "expiry") {
        const urgencyLevel = notification.priority === "high" ? "URGENT" : "IMPORTANT";
        const urgencyColor = notification.priority === "high" ? "#dc3545" : "#fd7e14";
        
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">License Management System</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">One Cloud Technology</p>
            </div>
            
            <!-- Urgency Banner -->
            <div style="background: ${urgencyColor}; color: white; padding: 15px 20px; text-align: center; font-weight: 600; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
              ${urgencyLevel} - ACTION REQUIRED
            </div>
            
            <!-- Content -->
            <div style="padding: 30px 20px; background: white; margin: 0 20px;">
              <h2 style="color: #dc3545; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">
                ⚠️ ${notification.title}
              </h2>
              <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                ${notification.message}
              </p>
              
              <!-- Action Required -->
              <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <h4 style="margin: 0 0 10px 0; color: #721c24; font-size: 16px; font-weight: 600;">📋 Action Required:</h4>
                <ul style="margin: 0; padding-left: 20px; color: #721c24;">
                  <li>Review the license details immediately</li>
                  <li>Contact the vendor for renewal options</li>
                  <li>Update license information in the system</li>
                  <li>Notify relevant team members</li>
                </ul>
              </div>
              
              <!-- Action Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${window?.location?.origin || 'https://your-domain.com'}${notification.action_url || '/licenses'}" 
                   style="background: ${urgencyColor}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                  View License Details
                </a>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #343a40; color: white; padding: 25px 20px; text-align: center; margin: 0 20px;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #adb5bd;">
                This is an automated license expiry alert from One Cloud Technology License Management System.
              </p>
              <p style="margin: 0; font-size: 12px; color: #6c757d;">
                © ${new Date().getFullYear()} One Cloud Technology. All rights reserved.
              </p>
            </div>
            
            <!-- Bottom Spacing -->
            <div style="height: 20px;"></div>
          </div>
        `;
      } else {
        // Default email template for other notification types
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">License Management System</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">One Cloud Technology</p>
            </div>
            <div style="padding: 30px 20px; background: white; margin: 0 20px;">
              <h2 style="color: #333; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">${notification.title}</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">${notification.message}</p>
              ${notification.action_url ? `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${window?.location?.origin || 'https://your-domain.com'}${notification.action_url}" 
                     style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">
                    View Details
                  </a>
                </div>
              ` : ''}
            </div>
            <div style="background: #343a40; color: white; padding: 25px 20px; text-align: center; margin: 0 20px;">
              <p style="margin: 0; font-size: 12px; color: #6c757d;">
                © ${new Date().getFullYear()} One Cloud Technology. All rights reserved.
              </p>
            </div>
          </div>
        `;
      }
      
      const { data, error } = await supabase.functions.invoke(
        "send-email-notification",
        {
          body: {
            to: userEmail,
            subject: notification.title,
            html: htmlContent,
          },
        },
      );

      if (error) {
        console.error("❌ Email function error:", error);
        throw error;
      }

      console.log("✅ Email sent successfully. Response:", data);
    } catch (err) {
      console.error("❌ Email failed:", err);
    }
  },
}));
