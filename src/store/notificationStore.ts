import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';
import { EmailService } from '../lib/emailService';

export interface Notification {
  id: string;
  type: 'expiry' | 'renewal' | 'comment' | 'system' | 'warning' | 'info';
  title: string;
  message: string;
  license_id: string | null;
  user_id: string;
  is_read: boolean;
  priority: 'low' | 'medium' | 'high';
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
  createNotification: (notification: Omit<Notification, 'id' | 'created_at'>) => Promise<Notification>;
  subscribeToRealtime: () => void;
  unsubscribeFromRealtime: () => void;
  checkLicenseExpiries: () => Promise<void>;
  checkSerialExpiries: () => Promise<void>;
  sendEmailNotification: (notification: Notification, userEmail: string) => Promise<void>;
  getCurrentUser: () => Promise<{ id: string; name: string; email: string } | null>;
  
  // Email settings
  setEmailNotificationsEnabled: (enabled: boolean) => void;
  sendNotificationToUser: (userId: string, notification: Omit<Notification, 'id' | 'created_at' | 'user_id'>, userEmail?: string) => Promise<void>;
  
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
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        return {
          id: user.id,
          name: user.user_metadata?.name || user.email || 'Unknown User',
          email: user.email || ''
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  },

  fetchNotifications: async () => {
    set({ isLoading: true });
    
    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) {
        set({ notifications: [], unreadCount: 0, isLoading: false });
        return;
      }
      const role = useAuthStore.getState().user?.role;

      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      // Admin sees all notifications, others only their own
      if (role !== 'admin') {
        query = query.eq('user_id', currentUser.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      const unreadCount = data?.filter(n => !n.is_read).length || 0;
      
      set({
        notifications: data || [],
        unreadCount,
        isLoading: false
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      set({ isLoading: false });
    }
  },

  markAsRead: async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;

      set(state => ({
        notifications: state.notifications.map(n => 
          n.id === id ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },

  markAllAsRead: async () => {
    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false);

      if (error) throw error;

      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, is_read: true })),
        unreadCount: 0
      }));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  },

  deleteNotification: async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;

      set(state => {
        const notification = state.notifications.find(n => n.id === id);
        const newNotifications = state.notifications.filter(n => n.id !== id);
        const newUnreadCount = notification && !notification.is_read 
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount;
        
        return {
          notifications: newNotifications,
          unreadCount: newUnreadCount
        };
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  },

  createNotification: async (notificationData) => {
    try {
      const currentUser = await get().getCurrentUser();
      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      const { data, error } = await supabase
        .from('notifications')
        .insert([{
          ...notificationData,
          user_id: currentUser.id
        }])
        .select()
        .single();

      if (error) throw error;

      // Send email notification if enabled
      if (get().emailNotificationsEnabled && data) {
        await get().sendEmailNotification(data, currentUser.email);
      }

      set(state => ({
        notifications: [data, ...state.notifications],
        unreadCount: state.unreadCount + 1
      }));

      return data;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  },

  sendNotificationToUser: async (userId, notificationData, userEmail) => {
    try {
      // Create notification in database
      const { data, error } = await supabase
        .from('notifications')
        .insert([{
          ...notificationData,
          user_id: userId
        }])
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
        set(state => ({
          notifications: [data, ...state.notifications],
          unreadCount: state.unreadCount + 1
        }));
      }
    } catch (error) {
      console.error('Error sending notification to user:', error);
      throw error;
    }
  },

  setEmailNotificationsEnabled: (enabled) => {
    set({ emailNotificationsEnabled: enabled });
  },

  bulkMarkAsRead: async (ids) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', ids);

      if (error) throw error;

      set(state => {
        const updatedNotifications = state.notifications.map(n => 
          ids.includes(n.id) ? { ...n, is_read: true } : n
        );
        const markedCount = state.notifications.filter(n => 
          ids.includes(n.id) && !n.is_read
        ).length;
        
        return {
          notifications: updatedNotifications,
          unreadCount: Math.max(0, state.unreadCount - markedCount)
        };
      });
    } catch (error) {
      console.error('Error bulk marking notifications as read:', error);
      throw error;
    }
  },

  bulkDelete: async (ids) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .in('id', ids);

      if (error) throw error;

      set(state => {
        const deletedUnreadCount = state.notifications.filter(n => 
          ids.includes(n.id) && !n.is_read
        ).length;
        
        return {
          notifications: state.notifications.filter(n => !ids.includes(n.id)),
          unreadCount: Math.max(0, state.unreadCount - deletedUnreadCount)
        };
      });
    } catch (error) {
      console.error('Error bulk deleting notifications:', error);
      throw error;
    }
  },

  getNotificationsByType: (type) => {
    return get().notifications.filter(n => n.type === type);
  },

  getUnreadNotifications: () => {
    return get().notifications.filter(n => !n.is_read);
  },

  searchNotifications: (query) => {
    const lowerQuery = query.toLowerCase();
    return get().notifications.filter(n => 
      n.title.toLowerCase().includes(lowerQuery) ||
      n.message.toLowerCase().includes(lowerQuery)
    );
  },

  subscribeToRealtime: () => {
    // Check if subscription already exists to prevent duplicate subscriptions
    if (get().realtimeSubscription) {
      return;
    }

    const subscription = supabase
      .channel('notifications')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        async (payload) => {
          const newNotification = payload.new as Notification;
          const role = useAuthStore.getState().user?.role;
          const currentUser = await get().getCurrentUser();
          const isVisible = role === 'admin' || (currentUser && currentUser.id === newNotification.user_id);
          if (!isVisible) return;

          // Send email notification for current user if enabled
          if (get().emailNotificationsEnabled && currentUser && currentUser.id === newNotification.user_id) {
            await get().sendEmailNotification(newNotification, currentUser.email);
          }

          set(state => ({
            notifications: [newNotification, ...state.notifications],
            unreadCount: state.unreadCount + 1
          }));
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications' },
        async (payload) => {
          const updatedNotification = payload.new as Notification;
          const role = useAuthStore.getState().user?.role;
          const currentUser = await get().getCurrentUser();
          const isVisible = role === 'admin' || (currentUser && currentUser.id === updatedNotification.user_id);
          if (!isVisible) return;
          set(state => ({
            notifications: state.notifications.map(n => 
              n.id === updatedNotification.id ? updatedNotification : n
            )
          }));
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications' },
        async (payload) => {
          const deleted = payload.old as any;
          const role = useAuthStore.getState().user?.role;
          const currentUser = await get().getCurrentUser();
          const isVisible = role === 'admin' || (currentUser && currentUser.id === deleted.user_id);
          if (!isVisible) return;
          const deletedId = deleted.id;
          set(state => ({
            notifications: state.notifications.filter(n => n.id !== deletedId)
          }));
        }
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

  checkLicenseExpiries: async () => {
    try {
      // Get licenses expiring in the next 30 days
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { data: licenses, error } = await supabase
        .from('licenses')
        .select('*')
        .lte('license_end_date', thirtyDaysFromNow.toISOString())
        .gte('license_end_date', new Date().toISOString())
        .eq('status', 'active');

      if (error) throw error;

      // Create notifications for expiring licenses
      for (const license of licenses || []) {
        const daysUntilExpiry = Math.ceil(
          (new Date(license.license_end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if notification already exists - use maybeSingle() instead of single()
        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('license_id', license.id)
          .eq('type', 'expiry')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
          .maybeSingle();

        if (!existingNotification) {
          // Send notification to license creator (no email since we can't get it client-side)
          await get().sendNotificationToUser(license.created_by, {
            type: 'expiry',
            title: 'License Expiring Soon',
            message: `${license.item_description} license expires in ${daysUntilExpiry} days`,
            license_id: license.id,
            is_read: false,
            priority: daysUntilExpiry <= 7 ? 'high' : 'medium',
            action_required: true,
            action_url: `/licenses/${license.id}`,
            expires_at: null
          });

          // If license.user_name is an email address, send notification with email
          if (license.user_name && license.user_name.includes('@') && license.user_name !== license.created_by) {
            // For now, we'll create the notification without trying to resolve the user ID
            // since we can't use admin functions client-side
            console.log(`Would send notification to ${license.user_name} for license ${license.item}`);
          }
        }
      }
    } catch (error) {
      console.error('Error checking license expiries:', error);
    }
  },

  checkSerialExpiries: async () => {
    try {
      // Helpers for yyyy-MM-dd (date columns in license_serials)
      const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  
      const today = new Date();
      const todayStr = toYMD(today);
  
      const end = new Date(today);
      end.setDate(today.getDate() + 30);
      const endStr = toYMD(end);
  
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);
      const sevenDaysAgoStr = toYMD(sevenDaysAgo);
  
      const dedupeSinceISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
      // Common select with join to get license info and created_by
      const selectCols = `
        id,
        license_id,
        serial_or_contract,
        end_date,
        licenses!inner(
          id,
          item_description,
          project_name,
          created_by
        )
      `;
  
      // 1) Serial Expired (in the last 7 days)
      const { data: expired, error: expErr } = await supabase
        .from('license_serials')
        .select(selectCols)
        .lt('end_date', todayStr)
        .gte('end_date', sevenDaysAgoStr)
        .order('end_date', { ascending: true });
  
      if (expErr) throw expErr;
  
      for (const row of expired || []) {
        const serialId = row.id;
        const serialNo = row.serial_or_contract;
        const license = row.licenses;
        const daysOverdue = Math.ceil((Date.now() - new Date(row.end_date).getTime()) / (1000 * 60 * 60 * 24));
        const titleExpired = `Serial ${serialNo} Expired`;
  
        // Dedupe exact title in last 24h
        const { data: existsExpired } = await supabase
          .from('notifications')
          .select('id, is_read, created_at')
          .eq('type', 'expiry')
          .eq('license_id', license.id)
          .eq('title', titleExpired)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
  
          if (!existsExpired) {
            await get().sendNotificationToUser(license.created_by, {
              type: 'expiry',
              title: titleExpired,
              message: `${serialNo} for ${license.item_description} expired ${daysOverdue} day(s) ago`,
              license_id: license.id,
              is_read: false,
              priority: 'high',
              action_required: true,
              action_url: `/licenses/${license.id}?serial=${serialId}`,
              expires_at: null
            });
          } else {
            const { error: updErr } = await supabase
              .from('notifications')
              .update({
                message: `${serialNo} for ${license.item_description} expired ${daysOverdue} day(s) ago`,
                priority: 'high',
                action_url: `/licenses/${license.id}?serial=${serialId}`,
              })
              .eq('id', existsExpired.id);
            if (updErr) console.error('Failed to update expired notification:', updErr);
          }
      }
  
      // 2) Serial Expiring Soon (today .. +30 days)
      const { data: upcoming, error: upErr } = await supabase
        .from('license_serials')
        .select(selectCols)
        .gte('end_date', todayStr)
        .lte('end_date', endStr)
        .order('end_date', { ascending: true });
  
      if (upErr) throw upErr;
  
      for (const row of upcoming || []) {
        const serialId = row.id;
        const serialNo = row.serial_or_contract;
        const endDateStr = row.end_date;
        const license = row.licenses;
  
        const daysUntil = Math.ceil((new Date(endDateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const titleSoon = `Serial ${serialNo} Expiring Soon`;
  
        // Dedupe exact title in last 24h
        let { data: existsSoon } = await supabase
        .from('notifications')
        .select('id, is_read, created_at')
        .eq('type', 'expiry')
        .eq('license_id', license.id)
        .eq('title', titleSoon)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
  
        if (!existsSoon) {
          // legacy title fallback
          const { data: legacy } = await supabase
            .from('notifications')
            .select('id, is_read, created_at')
            .eq('type', 'expiry')
            .eq('license_id', license.id)
            .eq('title', 'Serial Expiring Soon')
            .ilike('message', `%${serialNo}%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (legacy) existsSoon = legacy;
        }
        
        if (!existsSoon) {
          await get().sendNotificationToUser(license.created_by, {
            type: 'expiry',
            title: titleSoon,
            message: `${serialNo} for ${license.item_description} expires soon in ${daysUntil} day(s)`,
            license_id: license.id,
            is_read: false,
            priority: daysUntil <= 7 ? 'high' : 'medium',
            action_required: true,
            action_url: `/licenses/${license.id}?serial=${serialId}`,
            expires_at: null
          });
        } else {
          const { error: updErr } = await supabase
            .from('notifications')
            .update({
              title: titleSoon, // migrate legacy to new per-serial title
              message: `${serialNo} for ${license.item_description} expires soon in ${daysUntil} day(s)`,
              priority: daysUntil <= 7 ? 'high' : 'medium',
              action_url: `/licenses/${license.id}?serial=${serialId}`,
            })
            .eq('id', existsSoon.id);
          if (updErr) console.error('Failed to update soon notification:', updErr);
        }

      }
    } catch (err) {
      console.error('Error checking serial expiries:', err);
    }
  },

  sendEmailNotification: async (notification, userEmail) => {
    try {
      if (!userEmail) {
        console.log('No user email provided, skipping email notification');
        return;
      }

      const emailService = EmailService.getInstance();
      
      // Get notification priority styling
      const getPriorityColor = (priority: string) => {
        switch (priority) {
          case 'high': return '#dc3545';
          case 'medium': return '#fd7e14';
          case 'low': return '#28a745';
          default: return '#6c757d';
        }
      };

      const getPriorityIcon = (type: string) => {
        switch (type) {
          case 'expiry': return '⚠️';
          case 'renewal': return '🔄';
          case 'comment': return '💬';
          case 'system': return '🔔';
          case 'warning': return '⚠️';
          case 'info': return 'ℹ️';
          default: return '📢';
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
              ${notification.action_url ? `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${window.location.origin}${notification.action_url}" 
                     style="background: ${priorityColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: all 0.3s ease;">
                    View Details
                  </a>
                </div>
              ` : ''}
              
              <!-- Additional Info -->
              ${notification.action_required ? `
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin-top: 20px;">
                  <p style="margin: 0; color: #856404; font-size: 14px; font-weight: 500;">
                    ⚡ Action Required: This notification requires your immediate attention.
                  </p>
                </div>
              ` : ''}
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
        type: notification.type
      });

      console.log(`Email notification sent to ${userEmail} for: ${notification.title}`);
    } catch (error) {
      console.error('Error sending email notification:', error);
      // Don't throw the error to prevent breaking the notification creation
    }
  }
}));