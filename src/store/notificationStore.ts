import { create } from "zustand";



import { supabase } from "../lib/supabase";



import { useAuthStore } from "./authStore";



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



  // sendDailyExpiryReminders removed - now handled by backend daily job



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
    set({isLoading: true});

    try {
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


  sendEmailNotification: async (notification: any, userEmail: string) => {
    // ... (rest of the code remains the same)
    try {

      if (!userEmail) {
        return;

      }


      // ✅ KEY FIX: Use Supabase Edge Function directly (more reliable)

      const { data, error } = await supabase.functions.invoke('send-email-notification', {

        body: {

          to: userEmail,

          subject: notification.title,

          html: `

            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">

              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">

                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">License Management System</h1>

                <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">1Cloud Technology</p>

              </div>

              <div style="padding: 30px 20px; background: white; margin: 0 20px;">

                <h2 style="color: #333; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">${notification.title}</h2>

                <p style="color: #666; font-size: 16px; line-height: 1.6;">${notification.message}</p>

                <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0;">

                  <p style="margin: 0; color: #495057; font-size: 14px;">

                    <strong>📋 Action Required:</strong> Please review this license status and take appropriate action.

                  </p>

                </div>

                ${notification.action_url ? `

                  <div style="text-align: center; margin: 30px 0;">

                    <a href="${window.location.origin}${notification.action_url}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px;">View License Details</a>

                  </div>

                ` : ''}

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">


                  <p style="margin: 5px 0 0 0; color: #6c757d; font-size: 12px;">

                    If you have questions, please contact your system administrator.

                  </p>

                </div>

              </div>

              <div style="background: #343a40; color: white; padding: 25px 20px; text-align: center; margin: 0 20px;">

                <p style="margin: 0; font-size: 12px; color: #6c757d;">&copy; ${new Date().getFullYear()} 1Cloud Technology. All rights reserved.</p>

              </div>

            </div>

          `,

        }

      });



      if (error) {

        console.error("❌ Email function error:", error);

        throw error;

      }

    } catch (err) {

      console.error("❌ Email failed:", err);

    }

  },

}));