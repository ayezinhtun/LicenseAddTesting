import React, { useState } from 'react';
import { Bell, CheckCircle, AlertTriangle, MessageSquare, Trash2, Settings, Mail, Mail as MailOff, Send, TestTube } from 'lucide-react';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { useLicenseStore } from '../../store/licenseStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useAuthStore } from '../../store/authStore';
import { format, parseISO, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';

export const Notifications: React.FC = () => {
  const { getLicensesNearExpiry } = useLicenseStore();
  const { 
    notifications, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    emailNotificationsEnabled,
    setEmailNotificationsEnabled,
    createNotification
  } = useNotificationStore();
  const { user } = useAuthStore();
  
  const [showSettings, setShowSettings] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  
  const licensesNearExpiry = getLicensesNearExpiry(30);

  const allNotifications = [
    ...notifications,
    ...licensesNearExpiry.map(license => ({
      id: `expiry-${license.id}`,
      type: 'expiry' as const,
      title: 'License Expiring Soon',
      message: `${license.item_description} license for ${license.project_name} expires on ${format(parseISO(license.license_end_date), 'MMM dd, yyyy')}`,
      time: 'Today',
      isRead: false,
      icon: AlertTriangle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      created_at: new Date().toISOString(),
      user_id: 'current-user',
      is_read: false,
      priority: 'high' as const,
      action_required: true,
      action_url: `/licenses/${license.id}`,
      license_id: license.id,
      expires_at: null
    })),

    // Add some system notifications if no real notifications exist
    ...(notifications.length === 0 ? [
      {
        id: 'welcome',
        type: 'system' as const,
        title: 'Welcome to License Manager',
        message: 'Your license management system is ready to use. Email notifications are enabled.',
        time: '2 hours ago',
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        isRead: true,
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        user_id: 'current-user',
        is_read: true,
        priority: 'low' as const,
        action_required: false,
        action_url: null,
        license_id: null,
        expires_at: null
      }
    ] : [])
  ].slice(0, 20);


  const unreadCount = allNotifications.filter(n => !n.is_read).length;

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      if (!notificationId.startsWith('expiry-') && !notificationId.startsWith('welcome')) {
        await markAsRead(notificationId);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      if (!notificationId.startsWith('expiry-') && !notificationId.startsWith('welcome')) {
        await deleteNotification(notificationId);
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleSendTestNotification = async () => {
    if (!user?.email) {
      toast.error('No email address found for current user');
      return;
    }

    setIsSendingTest(true);
    
    try {
      await createNotification({
        type: 'system',
        title: '🧪 Test Email Notification',
        message: `This is a test email notification sent to ${user.email}. If you receive this email, your notification system is working correctly!`,
        license_id: null,
        user_id: user.id,
        is_read: false,
        priority: 'medium',
        action_required: false,
        action_url: '/notifications',
        expires_at: null
      });

      toast.success(`Test notification sent to ${user.email}! Check your inbox.`);
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast.error('Failed to send test notification');
    } finally {
      setIsSendingTest(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'expiry': return AlertTriangle;
      case 'renewal': return CheckCircle;
      case 'comment': return MessageSquare;
      case 'system': return Bell;
      case 'warning': return AlertTriangle;
      case 'info': return Bell;
      default: return Bell;
    }
  };

  const getNotificationColor = (type: string, priority: string) => {
    if (priority === 'high') return 'text-red-600 bg-red-50';
    
    switch (type) {
      case 'expiry': return 'text-orange-600 bg-orange-50';
      case 'renewal': return 'text-green-600 bg-green-50';
      case 'comment': return 'text-blue-600 bg-blue-50';
      case 'system': return 'text-purple-600 bg-purple-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'info': return 'text-cyan-600 bg-cyan-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatNotificationTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (diffInHours < 1) return 'Just now';
      if (diffInHours < 24) return `${diffInHours} hours ago`;
      if (diffInHours < 48) return 'Yesterday';
      return format(date, 'MMM dd, yyyy');
    } catch (error) {
      return 'Recently';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="text-gray-600 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All notifications read'}
          </p>
        </div>
        <div className="flex space-x-3">
          <Button 
            variant="secondary" 
            icon={Settings}
            onClick={() => setShowSettings(!showSettings)}
          >
            Settings
          </Button>
          {unreadCount > 0 && (
            <Button onClick={handleMarkAllAsRead}>
              Mark All as Read
            </Button>
          )}
        </div>
      </div>

      {/* Email Settings */}
      {showSettings && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Notification Settings
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {emailNotificationsEnabled ? (
                    <Mail className="h-5 w-5 text-green-600" />
                  ) : (
                    <MailOff className="h-5 w-5 text-gray-400" />
                  )}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
                    <p className="text-sm text-gray-500">
                      {emailNotificationsEnabled 
                        ? 'Receive email alerts for all notifications' 
                        : 'Email notifications are disabled'
                      }
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={emailNotificationsEnabled}
                  onChange={(e) => setEmailNotificationsEnabled(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              {/* Test Email Section */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <TestTube className="h-5 w-5 text-blue-600" />
                    <h4 className="text-sm font-medium text-blue-900">Test Email Notifications</h4>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Send}
                    onClick={handleSendTestNotification}
                    loading={isSendingTest}
                    disabled={!emailNotificationsEnabled || !user?.email}
                  >
                    Send Test Email
                  </Button>
                </div>
                <p className="text-sm text-blue-700 mb-2">
                  Send a test notification to <strong>{user?.email || 'your email'}</strong> to verify email delivery is working.
                </p>
                {!emailNotificationsEnabled && (
                  <p className="text-sm text-blue-600 font-medium">
                    Enable email notifications above to send test emails.
                  </p>
                )}
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-green-900 mb-2">Email Notification Features:</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• License expiry alerts with detailed information</li>
                  <li>• Renewal confirmations and updates</li>
                  <li>• Comment notifications and mentions</li>
                  <li>• System alerts and important updates</li>
                  <li>• Beautiful HTML emails with action buttons</li>
                  <li>• Priority-based styling and urgency indicators</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Notifications List */}
      <Card>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Bell className="h-5 w-5 mr-2 text-blue-600" />
              All Notifications
              {emailNotificationsEnabled && (
                <Badge variant="success" size="sm" className="ml-2">
                  <Mail className="h-3 w-3 mr-1" />
                  Email Enabled
                </Badge>
              )}
            </h2>
            <span className="text-sm text-gray-500">{allNotifications.length} notifications</span>
          </div>
        </div>
        
        <div className="divide-y divide-gray-100">
          {allNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
              <p className="text-gray-500">You're all caught up! Check back later for updates.</p>
            </div>
          ) : (
            allNotifications.map((notification) => {
              const NotificationIcon = getNotificationIcon(notification.type);
              const colorClasses = getNotificationColor(notification.type, notification.priority);
              
              return (
                <div 
                  key={notification.id} 
                  className={`p-6 hover:bg-gray-50 transition-colors duration-150 ${
                    !notification.is_read ? 'bg-blue-50/30 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className={`${colorClasses} p-2 rounded-lg flex-shrink-0`}>
                        <NotificationIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-sm font-medium text-gray-900">
                            {notification.title}
                          </h3>
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                          )}
                          <Badge 
                            variant={notification.priority === 'high' ? 'danger' : notification.priority === 'medium' ? 'warning' : 'secondary'}
                            size="sm"
                          >
                            {notification.priority}
                          </Badge>
                          {notification.action_required && (
                            <Badge variant="warning" size="sm">
                              Action Required
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500">
                            {formatNotificationTime(notification.created_at)}
                          </p>
                          {notification.action_url && (
                            <a 
                              href={notification.action_url}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                              View Details →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {!notification.is_read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          Mark Read
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() => handleDeleteNotification(notification.id)}
                        className="text-gray-400 hover:text-red-600"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Quick Actions */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">License Expiry Alerts</h3>
                <p className="text-sm text-gray-500">Get notified when licenses are about to expire</p>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Comment Notifications</h3>
                <p className="text-sm text-gray-500">Get notified when someone comments on licenses</p>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Renewal Confirmations</h3>
                <p className="text-sm text-gray-500">Get notified when licenses are renewed</p>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">System Updates</h3>
                <p className="text-sm text-gray-500">Get notified about system maintenance and updates</p>
              </div>
              <input
                type="checkbox"
                defaultChecked
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};