import React from 'react';
import { Bell, AlertTriangle, CheckCircle, MessageSquare, Calendar, RefreshCw, Info, AlertCircle } from 'lucide-react';
import { useLicenseStore } from '../../store/licenseStore';
import { useNotificationStore } from '../../store/notificationStore';
import { format, parseISO } from 'date-fns';
import type { Notification } from '../../store/notificationStore';

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'expiry':
      return AlertTriangle;
    case 'renewal':
      return RefreshCw;
    case 'comment':
      return MessageSquare;
    case 'system':
      return CheckCircle;
    case 'warning':
      return AlertCircle;
    case 'info':
    default:
      return Info;
  }
};

const getNotificationColor = (type: Notification['type'], priority: Notification['priority']) => {
  if (priority === 'high') {
    return {
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    };
  }
  
  switch (type) {
    case 'expiry':
    case 'warning':
      return {
        color: 'text-orange-600',
        bgColor: 'bg-orange-50'
      };
    case 'renewal':
      return {
        color: 'text-blue-600',
        bgColor: 'bg-blue-50'
      };
    case 'comment':
      return {
        color: 'text-purple-600',
        bgColor: 'bg-purple-50'
      };
    case 'system':
      return {
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      };
    case 'info':
    default:
      return {
        color: 'text-gray-600',
        bgColor: 'bg-gray-50'
      };
  }
};

export const NotificationsList: React.FC = () => {
  const { getLicensesNearExpiry } = useLicenseStore();
  const { notifications } = useNotificationStore();
  
  const licensesNearExpiry = getLicensesNearExpiry(30);

  // Combine real notifications with license expiry alerts
  const allNotifications = [
    ...notifications.slice(0, 3), // Show first 3 real notifications
    ...licensesNearExpiry.slice(0, 2).map(license => ({
      id: `expiry-${license.id}`,
      type: 'expiry' as const,
      title: 'License Expiring Soon',
      message: `${license.item} license expires on ${format(parseISO(license.license_end_date), 'MMM dd, yyyy')}`,
      time: 'Today',
      priority: 'high' as const,
      isRead: false
    })),
    // Add some system notifications if no real notifications exist
    ...(notifications.length === 0 ? [
      {
        id: 'welcome',
        type: 'system' as const,
        title: 'Welcome to License Manager',
        message: 'Your license management system is ready to use',
        time: '2 hours ago',
        priority: 'medium' as const,
        isRead: true
      },
      {
        id: 'sync',
        type: 'system' as const,
        title: 'Data Synchronized',
        message: 'All license data has been synchronized successfully',
        time: '1 day ago',
        priority: 'medium' as const,
        isRead: false
      }
    ] : [])
  ].slice(0, 5);

  const unreadCount = allNotifications.filter(n => !n.isRead).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Bell className="h-5 w-5 mr-2 text-blue-600" />
            Recent Notifications
          </h2>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {unreadCount} unread
              </span>
            )}
            <span className="text-sm text-gray-500">{allNotifications.length} total</span>
          </div>
        </div>
      </div>
      
      <div className="divide-y divide-gray-100">
        {allNotifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">No notifications yet</h3>
            <p className="text-xs text-gray-500">You'll see important updates here</p>
          </div>
        ) : (
          allNotifications.map((notification) => {
            const IconComponent = getNotificationIcon(notification.type);
            const { color, bgColor } = getNotificationColor(notification.type, notification.priority);
            
            return (
              <div 
                key={notification.id} 
                className={`p-4 hover:bg-gray-50 transition-colors duration-150 ${
                  !notification.isRead ? 'bg-blue-50/30 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className={`${bgColor} p-2 rounded-lg flex-shrink-0`}>
                    <IconComponent className={`h-4 w-4 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {notification.title}
                      </p>
                      {!notification.isRead && (
                        <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 ml-2"></span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{notification.message}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500 flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {notification.time || 'Just now'}
                      </p>
                      {notification.type === 'expiry' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          Action Required
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      
      {allNotifications.length > 0 && (
        <div className="p-4 border-t border-gray-100">
          <button className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200">
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
};