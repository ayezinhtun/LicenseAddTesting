import React from 'react';
import { Calendar, Clock, AlertTriangle } from 'lucide-react';
import { useLicenseStore } from '../../store/licenseStore';
import { format, parseISO, differenceInDays } from 'date-fns';

export const CalendarWidget: React.FC = () => {
  const { getLicensesNearExpiry } = useLicenseStore();
  
  const upcomingExpirations = getLicensesNearExpiry(60)
    .sort((a, b) => parseISO(a.license_end_date).getTime() - parseISO(b.license_end_date).getTime())
    .slice(0, 5);

  const getDaysUntilExpiry = (dateString: string) => {
    return differenceInDays(parseISO(dateString), new Date());
  };

  const getUrgencyColor = (days: number) => {
    if (days <= 0) return 'text-red-600 bg-red-50 border-red-200';
    if (days <= 7) return 'text-red-600 bg-red-50 border-red-200';
    if (days <= 30) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  const getUrgencyIcon = (days: number) => {
    if (days <= 7) return AlertTriangle;
    return Clock;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-blue-600" />
          Upcoming Expirations
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {upcomingExpirations.length} licenses expiring in the next 60 days
        </p>
      </div>
      
      <div className="p-4">
        {upcomingExpirations.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">No upcoming expirations</h3>
            <p className="text-xs text-gray-500">All licenses are up to date</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingExpirations.map((license) => {
              const daysUntilExpiry = getDaysUntilExpiry(license.license_end_date);
              const urgencyColor = getUrgencyColor(daysUntilExpiry);
              const UrgencyIcon = getUrgencyIcon(daysUntilExpiry);
              
              return (
                <div key={license.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors duration-150">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {license.item}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {license.vendor} • {license.project_name}
                        </p>
                      </div>
                      <div className={`ml-3 px-2 py-1 rounded-full text-xs font-medium border ${urgencyColor}`}>
                        <div className="flex items-center space-x-1">
                          <UrgencyIcon className="h-3 w-3" />
                          <span>
                            {daysUntilExpiry <= 0 
                              ? 'Expired' 
                              : daysUntilExpiry === 1 
                                ? '1 day' 
                                : `${daysUntilExpiry} days`}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-600 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        Expires: {format(parseISO(license.license_end_date), 'MMM dd, yyyy')}
                      </p>
                      <p className="text-xs font-medium text-gray-900">
                        ${license.license_cost.toLocaleString()}
                      </p>
                    </div>
                    
                    {license.auto_renew && (
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Auto-renew enabled
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {upcomingExpirations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <button className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200">
              View all upcoming expirations
            </button>
          </div>
        )}
      </div>
    </div>
  );
};