import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, TrendingUp, PieChart as PieChartIcon } from 'lucide-react';
import { useLicenseStore } from '../../store/licenseStore';
import { Card } from '../common/Card';
import { Button } from '../common/Button';

export const ChartWidget: React.FC = () => {
  const [activeChart, setActiveChart] = useState<'cost' | 'expiry' | 'vendor'>('cost');
  const { getCostTrends, getExpiryTrends, getVendorStats } = useLicenseStore();

  const costData = getCostTrends();
  const expiryData = getExpiryTrends();
  const vendorData = getVendorStats().slice(0, 6);

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

  const chartConfigs = {
    cost: {
      title: 'Cost Trends',
      subtitle: 'Monthly license costs over time',
      icon: TrendingUp,
      component: (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={costData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(value) => [`$${value.toLocaleString()}`, 'Cost']}
            />
            <Line 
              type="monotone" 
              dataKey="cost" 
              stroke="#3B82F6" 
              strokeWidth={3}
              dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )
    },
    expiry: {
      title: 'Expiry Trends',
      subtitle: 'Licenses expiring by month',
      icon: BarChart3,
      component: (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={expiryData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(value) => [`${value} licenses`, 'Expiring']}
            />
            <Bar dataKey="expiring" fill="#F59E0B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )
    },
    vendor: {
      title: 'Vendor Distribution',
      subtitle: 'License distribution by vendor',
      icon: PieChartIcon,
      component: (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={vendorData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ vendor, percent }) => `${vendor} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="count"
            >
              {vendorData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              formatter={(value, name, props) => [
                `${value} licenses ($${props.payload.totalCost.toLocaleString()})`,
                props.payload.vendor
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      )
    }
  };

  const currentConfig = chartConfigs[activeChart];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-50 p-2 rounded-lg">
              <currentConfig.icon className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{currentConfig.title}</h3>
              <p className="text-sm text-gray-500">{currentConfig.subtitle}</p>
            </div>
          </div>
          
          <div className="flex space-x-2">
            {Object.entries(chartConfigs).map(([key, config]) => (
              <Button
                key={key}
                variant={activeChart === key ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setActiveChart(key as any)}
                icon={config.icon}
                animate={false}
              >
                {config.title.split(' ')[0]}
              </Button>
            ))}
          </div>
        </div>
        
        <div className="w-full">
          {currentConfig.component}
        </div>
      </Card>
    </motion.div>
  );
};