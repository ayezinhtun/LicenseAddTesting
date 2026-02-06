import React, { useEffect, useState } from "react";
import { Calendar, Clock, AlertTriangle } from "lucide-react";
import { useLicenseStore } from "../../store/licenseStore";
import { format, parseISO, differenceInDays } from "date-fns";

export const CalendarWidget: React.FC = () => {
  const { getSerialsNearExpiry } = useLicenseStore();
  const [upcomingSerials, setUpcomingSerials] = useState<
    Array<{ license: any; serial: any }>
  >([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const rows = await getSerialsNearExpiry(60);
      if (!mounted) return;
      const sorted = [...rows]
        .sort(
          (a, b) =>
            parseISO(a.serial.end_date).getTime() -
            parseISO(b.serial.end_date).getTime(),
        )
        .slice(0, 5);
      setUpcomingSerials(sorted);
    })();
    return () => {
      mounted = false;
    };
  }, [getSerialsNearExpiry]);

  const getDaysUntilExpiry = (dateString: string) =>
    differenceInDays(parseISO(dateString), new Date());
  const getUrgencyColor = (days: number) => {
    if (days <= 0) return "text-red-600 bg-red-50 border-red-200";
    if (days <= 7) return "text-red-600 bg-red-50 border-red-200";
    if (days <= 30) return "text-orange-600 bg-orange-50 border-orange-200";
    return "text-blue-600 bg-blue-50 border-blue-200";
  };
  const getUrgencyIcon = (days: number) => (days <= 7 ? AlertTriangle : Clock);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-blue-600" />
          Upcoming Serial Expirations
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {upcomingSerials.length} serials expiring in the next 60 days
        </p>
      </div>

      <div className="p-4">
        {upcomingSerials.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              No upcoming serial expirations
            </h3>
            <p className="text-xs text-gray-500">All serials are up to date</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingSerials.map(({ license, serial }) => {
              const daysUntil = getDaysUntilExpiry(serial.end_date);
              const urgencyColor = getUrgencyColor(daysUntil);
              const UrgencyIcon = getUrgencyIcon(daysUntil);

              return (
                <div
                  key={serial.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors duration-150"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {serial.serial_or_contract}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {license.vendor} • {license.project_name}
                        </p>
                      </div>
                      <div
                        className={`ml-3 px-2 py-1 rounded-full text-xs font-medium border ${urgencyColor}`}
                      >
                        <div className="flex items-center space-x-1">
                          <UrgencyIcon className="h-3 w-3" />
                          <span>
                            {daysUntil <= 0
                              ? "Expired"
                              : daysUntil === 1
                                ? "1 day"
                                : `${daysUntil} days`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-600 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        Expires:{" "}
                        {format(parseISO(serial.end_date), "MMM dd, yyyy")}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
