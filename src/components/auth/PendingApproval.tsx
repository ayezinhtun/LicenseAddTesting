import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export const PendingApproval: React.FC = () => {
  const { logout, user, profileStatus } = useAuthStore();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);

  const userId = user?.id;

  // If there's no auth session (e.g., after refresh without tokens), go to Login
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate('/login', { replace: true });
      }
    })();
  }, [navigate]);

  useEffect(() => {
    if (!userId) return;

    const checkStatus = async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('status')
        .eq('user_id', userId)
        .single();

      if (!error && data?.status === 'approved') {
        await logout();
        navigate('/login', { replace: true });
      } else if (!error && data?.status === 'rejected') {
        setMessage('Your account has been rejected. Please contact an administrator.');
        useAuthStore.setState({ profileStatus: 'rejected' as any });
        toast.error('Your sign-up request was rejected by the administrator.');
      }
    };
    checkStatus();

    const channel = supabase
      .channel('user-approval-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles', filter: `user_id=eq.${userId}` },
        async (payload: any) => {
          const newRow = payload.new || payload.record || {};
          const status = newRow.status as string | undefined;
          if (status === 'approved') {
            await logout();
            navigate('/login', { replace: true });
          } else if (status === 'rejected') {
            setMessage('Your account has been rejected. Please contact an administrator.');
            useAuthStore.setState({ profileStatus: 'rejected' as any });
            toast.error('Your sign-up request was rejected by the administrator.');
          }
        }
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [userId, navigate, logout]);

  const handleRefreshStatus = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      navigate('/login', { replace: true });
      return;
    }
    const { data: prof } = await supabase
      .from('user_profiles')
      .select('status')
      .eq('user_id', userId as string)
      .single();
    if (prof?.status === 'approved') {
      await logout();
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card>
        <div className="p-8 max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-900">Account Pending Approval</h1>
          <p className="text-gray-600 mt-3">
            {user?.email || 'Your account'} has been created and email verified.
            An administrator must review and approve your access before you can use the app.
          </p>
          <p className="text-gray-600 mt-2">Please check back later or contact an administrator.</p>
          {message && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-left">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.72-1.36 3.485 0l6.518 11.6c.718 1.277-.196 2.866-1.742 2.866H3.48c-1.546 0-2.46-1.589-1.742-2.866l6.519-11.6zM11 14a1 1 0 10-2 0 1 1 0 002 0zm-.293-6.707a1 1 0 00-1.414 0l-.293.293V11a1 1 0 102 0V7.586l-.293-.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-semibold text-red-800">Account Rejected</h3>
                  <div className="mt-1 text-sm text-red-700">
                    <p>{message}</p>
                  </div>
                  
                </div>
              </div>
            </div>
          )}
          <div className="mt-4">
            <Button onClick={handleRefreshStatus}>Refresh status</Button>
          </div>
          
          <div className="mt-6">
            <Button onClick={logout}>Sign out</Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
