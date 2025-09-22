import React from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  AlertTriangle,
  DollarSign,
  Building,
  FolderOpen,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useLicenseStore } from '../../store/licenseStore';
import { Card } from '../common/Card';
import { differenceInDays } from 'date-fns';

export const OverviewCards: React.FC = () => {
  const { licenses, getLicensesNearExpiry, getExpiredLicenses } = useLicenseStore();
  
  const licensesNearExpiry = getLicensesNearExpiry(30);
  const expiredLicenses = getExpiredLicenses();
  const activeLicenses = licenses.filter(l => l.status === 'active');
  const totalCost = licenses.reduce((sum, license) => sum + license.license_cost, 0);
  const uniqueVendors = new Set(licenses.map(license => license.vendor)).size;
  const uniqueProjects = new Set(licenses.map(license => license.project_name)).size;
  const uniqueCustomers = new Set(licenses.map(license => license.customer_name)).size;
  const autoRenewCount = licenses.filter(l => l.auto_renew).length;

  // Calculate growth percentages (mock data for demonstration)
  const getGrowthPercentage = (current: number, type: string) => {
    // In a real app, you'd compare with previous period data
    const growthRates = {
      total: 12,
      cost: 8.2,
      vendors: 15,
      projects: 25,
      customers: 5,
      autoRenew: 18
    };
    return growthRates[type as keyof typeof growthRates] || 0;
  };

  const cards = [
    {
      title: 'Total Licenses',
      value: licenses.length.toString(),
      change: `+${getGrowthPercentage(licenses.length, 'total')}%`,
      changeType: 'positive' as const,
      icon: FileText,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'All licenses in system'
    },
    {
      title: 'Expiring Soon',
      value: licensesNearExpiry.length.toString(),
      subtitle: 'Next 30 days',
      change: licensesNearExpiry.length > 5 ? 'High Alert' : 'Normal',
      changeType: licensesNearExpiry.length > 5 ? 'negative' : 'neutral' as const,
      icon: AlertTriangle,
      color: 'bg-orange-500',
      textColor: 'text-orange-600',
      bgColor: 'bg-orange-50',
      description: 'Require attention'
    },
    {
      title: 'Annual Cost',
      value: `$${totalCost.toLocaleString()}`,
      change: `+${getGrowthPercentage(totalCost, 'cost')}%`,
      changeType: 'positive' as const,
      icon: DollarSign,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'Total yearly spend'
    },
    {
      title: 'Active Licenses',
      value: activeLicenses.length.toString(),
      change: `${Math.round((activeLicenses.length / licenses.length) * 100)}%`,
      changeType: 'neutral' as const,
      icon: CheckCircle,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      description: 'Currently active'
    },
    {
      title: 'Expired Licenses',
      value: expiredLicenses.length.toString(),
      change: expiredLicenses.length > 0 ? 'Action needed' : 'All good',
      changeType: expiredLicenses.length > 0 ? 'negative' : 'positive' as const,
      icon: XCircle,
      color: 'bg-red-500',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50',
      description: 'Need renewal'
    },
    {
      title: 'Auto Renewals',
      value: autoRenewCount.toString(),
      change: `${Math.round((autoRenewCount / licenses.length) * 100)}%`,
      changeType: 'positive' as const,
      icon: Clock,
      color: 'bg-purple-500',
      textColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: 'Automated renewals'
    },
    {
      title: 'Vendors',
      value: uniqueVendors.toString(),
      change: `+${getGrowthPercentage(uniqueVendors, 'vendors')}%`,
      changeType: 'positive' as const,
      icon: Building,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      description: 'Unique vendors'
    },
    {
      title: 'Projects',
      value: uniqueProjects.toString(),
      change: `+${getGrowthPercentage(uniqueProjects, 'projects')}%`,
      changeType: 'positive' as const,
      icon: FolderOpen,
      color: 'bg-cyan-500',
      textColor: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
      description: 'Active projects'
    },
    {
      title: 'Customers',
      value: uniqueCustomers.toString(),
      change: `+${getGrowthPercentage(uniqueCustomers, 'customers')}%`,
      changeType: 'positive' as const,
      icon: Users,
      color: 'bg-teal-500',
      textColor: 'text-teal-600',
      bgColor: 'bg-teal-50',
      description: 'Active customers'
    }
  ];

  const getChangeColor = (type: 'positive' | 'negative' | 'neutral') => {
    switch (type) {
      case 'positive':
        return 'text-green-600 bg-green-50';
      case 'negative':
        return 'text-red-600 bg-red-50';
      case 'neutral':
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((card, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
        >
          <Card hover className="h-full">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <div className={`${card.bgColor} p-2 rounded-lg`}>
                    <card.icon className={`h-5 w-5 ${card.textColor}`} />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                  
                  {card.subtitle && (
                    <p className="text-sm text-gray-500">{card.subtitle}</p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">{card.description}</p>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getChangeColor(card.changeType)}`}>
                      {card.changeType === 'positive' && <TrendingUp className="w-3 h-3 mr-1" />}
                      {card.change}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};