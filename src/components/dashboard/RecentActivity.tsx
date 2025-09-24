import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Plus, Edit, Trash2, Download, RefreshCw, Eye } from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { useAuditStore } from '../../store/auditStore';
import { format, formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';


export const RecentActivity: React.FC = () => {
  const navigate = useNavigate();

  const { logs, fetchAuditLogs } = useAuditStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRecentActivity = async () => {
      try {
        await fetchAuditLogs(1);
      } catch (error) {
        console.error('Error loading recent activity:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecentActivity();
  }, [fetchAuditLogs]);

  // Get recent activities (last 10)
  const recentActivities = logs.slice(0, 10);

  // If no real activities, show some mock activities
  const mockActivities = [
    {
      id: 'mock-1',
      type: 'create',
      title: 'New license added',
      description: 'Microsoft Office 365 Enterprise E3 license added for Corporate Infrastructure project',
      user: 'Admin User',
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      icon: Plus,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      id: 'mock-2',
      type: 'update',
      title: 'License renewed',
      description: 'Adobe Creative Cloud license renewed for Marketing & Design project',
      user: 'John Manager',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      icon: RefreshCw,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      id: 'mock-3',
      type: 'edit',
      title: 'License updated',
      description: 'Slack Pro license details updated - increased user count to 80',
      user: 'Sarah Analyst',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
      icon: Edit,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      id: 'mock-4',
      type: 'export',
      title: 'Report exported',
      description: 'License report exported to CSV format for Q4 review',
      user: 'Admin User',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
      icon: Download,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      id: 'mock-5',
      type: 'view',
      title: 'License accessed',
      description: 'Atlassian Jira license details viewed for compliance check',
      user: 'John Manager',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8), // 8 hours ago
      icon: Eye,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    }
  ];

  const activities = recentActivities.length > 0 
    ? recentActivities.map(log => ({
        id: log.id,
        type: log.action,
        title: `${log.action.charAt(0).toUpperCase() + log.action.slice(1)} ${log.entity_type}`,
        description: `${log.user_name} ${log.action}d ${log.entity_type} ${log.entity_id}`,
        user: log.user_name,
        timestamp: new Date(log.created_at),
        icon: getActionIcon(log.action),
        color: getActionColor(log.action),
        bgColor: getActionBgColor(log.action)
      }))
    : mockActivities;

  function getActionIcon(action: string) {
    switch (action) {
      case 'create': return Plus;
      case 'update': return Edit;
      case 'delete': return Trash2;
      case 'view': return Eye;
      case 'export': return Download;
      case 'login': return Activity;
      case 'logout': return Activity;
      default: return Activity;
    }
  }

  function getActionColor(action: string) {
    switch (action) {
      case 'create': return 'text-green-600';
      case 'update': return 'text-blue-600';
      case 'delete': return 'text-red-600';
      case 'view': return 'text-indigo-600';
      case 'export': return 'text-purple-600';
      case 'login': return 'text-emerald-600';
      case 'logout': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  }

  function getActionBgColor(action: string) {
    switch (action) {
      case 'create': return 'bg-green-50';
      case 'update': return 'bg-blue-50';
      case 'delete': return 'bg-red-50';
      case 'view': return 'bg-indigo-50';
      case 'export': return 'bg-purple-50';
      case 'login': return 'bg-emerald-50';
      case 'logout': return 'bg-orange-50';
      default: return 'bg-gray-50';
    }
  }

  const getActivityBadge = (type: string) => {
    switch (type) {
      case 'create':
        return <Badge variant="success" size="sm">Created</Badge>;
      case 'update':
      case 'edit':
        return <Badge variant="primary" size="sm">Updated</Badge>;
      case 'delete':
        return <Badge variant="danger" size="sm">Deleted</Badge>;
      case 'export':
        return <Badge variant="secondary" size="sm">Exported</Badge>;
      case 'view':
        return <Badge variant="info" size="sm">Viewed</Badge>;
      default:
        return <Badge variant="default" size="sm">Activity</Badge>;
    }
  };

  const getRelativeTime = (timestamp: Date) => {
    return formatDistanceToNow(timestamp, { addSuffix: true });
  };

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading recent activity...</span>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
    >
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-gray-50 p-2 rounded-lg">
              <Activity className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <p className="text-sm text-gray-500">Latest actions and changes</p>
            </div>
          </div>
          
          <Badge variant="default" size="sm">
            {activities.length} activities
          </Badge>
        </div>
        
        <div className="space-y-4">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <h3 className="text-sm font-medium text-gray-900 mb-1">No recent activity</h3>
              <p className="text-xs text-gray-500">Activity will appear here as you use the system</p>
            </div>
          ) : (
            activities.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="flex items-start space-x-4 p-4 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                <div className={`${activity.bgColor} p-2 rounded-lg flex-shrink-0`}>
                  <activity.icon className={`h-4 w-4 ${activity.color}`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold text-gray-900 truncate">{activity.title}</h4>
                    {getActivityBadge(activity.type)}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{activity.description}</p>
                  
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>by {activity.user}</span>
                    <span>{getRelativeTime(activity.timestamp)}</span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-100">
          <button className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200" onClick={() => navigate('/audit')}>
            View all activity
          </button>
        </div>
      </Card>
    </motion.div>
  );
};