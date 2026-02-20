import React, { useEffect } from 'react';

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { Toaster } from 'react-hot-toast';

import { useAuthStore } from './store/authStore';

import { useNotificationStore } from './store/notificationStore';

import { useLicenseStore } from './store/licenseStore';

import { Layout } from './components/layout/Layout';

import { Login } from './components/auth/Login';

import { SignUp } from './components/auth/SignUp';

import { Dashboard } from './components/dashboard/Dashboard';

import { LicenseManagement } from './components/licenses/LicenseManagement';

import { LicenseDetails } from './components/licenses/LicenseDetails';

import { Reports } from './components/reports/Reports';

import { UserManagement } from './components/users/UserManagement';

import { Notifications } from './components/notifications/Notifications';

import { AccountSettings } from './components/account/AccountSettings';

import { AuditLogs } from './components/audit/AuditLogs';

import { PendingApproval } from './components/auth/PendingApproval';

import { VendorPage } from './components/vendors/VendorPage';

import { ProjectAssignPage } from './components/projectAssign/ProjectAssignPage';

import { CustomerPage } from './components/customers/CustomerPage';

import { DistributorPage } from './components/distributors/DistributorPage';

import { RecentlyDeleted } from './components/licenses/RecentlyDeleted';


function App() {

  const { isAuthenticated, getCurrentUser, user, profileStatus } = useAuthStore();

  const { subscribeToRealtime, unsubscribeFromRealtime, fetchNotifications, sendDailyExpiryReminders } = useNotificationStore();

  const { fetchLicenses } = useLicenseStore();

  // const checkSerials = useLicenseStore(s => s.checkSerialExpiryNotifications);


  // Run daily at midnight
  const setupDailyReminders = () => {
    // Run immediately when app starts
    sendDailyExpiryReminders();

    // Then run every 24 hours
    setInterval(() => {
      sendDailyExpiryReminders();
    }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
  };

  // Call this when your app starts
  useEffect(() => {
    setupDailyReminders();
  }, []);

  useEffect(() => {
    // Check authentication status on app load

    const checkAuth = async () => {

      try {

        await getCurrentUser();

      } catch (error) {

        console.error('Error checking authentication:', error);

      }

    };



    checkAuth();

  }, [getCurrentUser]);


  useEffect(() => {

    if (isAuthenticated) {

      // Initialize data when user is authenticated

      const initializeData = async () => {

        try {

          // Fetch initial data

          await Promise.all([

            fetchLicenses(),

            fetchNotifications()

          ]);



          // Subscribe to real-time notifications
          subscribeToRealtime();

        } catch (error) {

          console.error('Error initializing data:', error);

        }

      };



      initializeData();

    }

  }, [isAuthenticated, subscribeToRealtime, unsubscribeFromRealtime, fetchLicenses, fetchNotifications]);



  if (!isAuthenticated) {

    return (

      <>

        <Router>

          <Routes>

            <Route path="/login" element={<Login />} />

            <Route path="/signup" element={<SignUp />} />

            {/* Allow pending-approval landing even before session is restored */}

            <Route path="/pending-approval" element={<PendingApproval />} />

            <Route path="*" element={<Navigate to="/login" replace />} />

          </Routes>

        </Router>

        <Toaster

          position="top-right"

          toastOptions={{

            duration: 4000,

            style: {

              background: '#fff',

              color: '#374151',

              border: '1px solid #e5e7eb',

              borderRadius: '8px',

            },

            success: {

              iconTheme: {

                primary: '#10b981',

                secondary: '#fff'

              }

            },

            error: {

              iconTheme: {

                primary: '#ef4444',

                secondary: '#fff'

              }

            }

          }}

        />

      </>

    );

  }



  // If authenticated and pending, show approval page WITHOUT layout/sidebar

  if (profileStatus === 'pending' || profileStatus === 'rejected') {

    return (

      <>

        <Router>

          <Routes>

            <Route path="/pending-approval" element={<PendingApproval />} />

            <Route path="*" element={<Navigate to="/pending-approval" replace />} />

          </Routes>

        </Router>

        <Toaster

          position="top-right"

          toastOptions={{

            duration: 4000,

            style: {

              background: '#fff',

              color: '#374151',

              border: '1px solid #e5e7eb',

              borderRadius: '8px',

            },

            success: {

              iconTheme: {

                primary: '#10b981',

                secondary: '#fff'

              }

            },

            error: {

              iconTheme: {

                primary: '#ef4444',

                secondary: '#fff'

              }

            }

          }}

        />

      </>

    );

  }



  return (

    <>

      <Router>

        <Layout>

          <Routes>

            <Route path="/pending-approval" element={<PendingApproval />} />



            {/* Protected routes */}

            <Route path="/dashboard" element={<Dashboard />} />

            <Route path="/vendors" element={<VendorPage />} />

            <Route path="/project-assign" element={<ProjectAssignPage />} />

            <Route path="/customers" element={<CustomerPage />} />

            <Route path="/distributors" element={<DistributorPage />} />

            <Route path="/licenses" element={<LicenseManagement />} />

            <Route path="/licenses/deleted" element={<RecentlyDeleted />} />

            <Route path="/licenses/:id" element={<LicenseDetails />} />

            <Route path="/users" element={user?.role === 'admin' ? <UserManagement /> : <Navigate to="/dashboard" replace />} />

            <Route path="/reports" element={<Reports />} />

            <Route path="/notifications" element={<Notifications />} />

            <Route path="/audit" element={<AuditLogs />} />

            <Route path="/account" element={<AccountSettings />} />



            <Route path="/" element={<Navigate to={'/dashboard'} replace />} />

            <Route path="*" element={<Navigate to={'/dashboard'} replace />} />

          </Routes>

        </Layout>

      </Router>

      <Toaster

        position="top-right"

        toastOptions={{

          duration: 4000,

          style: {

            background: '#fff',

            color: '#374151',

            border: '1px solid #e5e7eb',

            borderRadius: '8px',

          },

          success: {

            iconTheme: {

              primary: '#10b981',

              secondary: '#fff'

            }

          },

          error: {

            iconTheme: {

              primary: '#ef4444',

              secondary: '#fff'

            }

          }

        }}

      />

    </>

  );

}



export default App;