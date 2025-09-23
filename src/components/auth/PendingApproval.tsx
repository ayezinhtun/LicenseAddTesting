import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

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
          <div className="mt-4">
            <Button onClick={handleRefreshStatus}>Refresh status</Button>
          </div>
          {message && (
            <p className="text-red-600 mt-3">{message}</p>
          )}
          <div className="mt-6">
            <Button onClick={logout}>Sign out</Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
