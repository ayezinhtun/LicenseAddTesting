/*
  # Fix audit logs RLS policy

  1. Security Changes
    - Update the INSERT policy for `audit_logs` table to allow authenticated users to insert their own audit logs
    - The policy will check that the user_id matches the authenticated user's ID from auth.uid()
    - This ensures users can only create audit logs for themselves while maintaining security

  2. Policy Updates
    - Drop the existing overly restrictive INSERT policy
    - Create a new INSERT policy that properly validates user ownership
    - Maintain existing SELECT policy for viewing audit logs
*/

-- Drop the existing INSERT policy that's too restrictive
DROP POLICY IF EXISTS "Users can insert audit logs" ON audit_logs;

-- Create a new INSERT policy that allows authenticated users to insert audit logs
-- where the user_id matches their authenticated user ID
CREATE POLICY "Authenticated users can insert their audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

-- Ensure the SELECT policy allows authenticated users to view all audit logs
-- (keeping existing policy or creating if it doesn't exist)
DROP POLICY IF EXISTS "Users can view audit logs" ON audit_logs;

CREATE POLICY "Authenticated users can view audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (true);