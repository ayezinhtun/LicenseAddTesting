/*
  # Fix Audit Logs RLS Policy

  1. Security Updates
    - Update the INSERT policy for audit_logs table to properly validate user_id
    - Ensure authenticated users can only insert audit logs with their own user_id
    - This prevents users from inserting audit logs on behalf of other users

  2. Changes
    - Drop the existing overly restrictive INSERT policy
    - Create a new INSERT policy that checks auth.uid() = user_id::uuid
    - This ensures audit logs can only be created by the authenticated user for themselves
*/

-- Drop the existing INSERT policy that's causing issues
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_logs;

-- Create a new INSERT policy that properly validates the user_id
CREATE POLICY "Users can insert their own audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

-- Also ensure the SELECT policy allows users to view audit logs
-- (keeping the existing one but making sure it's properly defined)
DROP POLICY IF EXISTS "Users can view all audit logs" ON audit_logs;

CREATE POLICY "Users can view all audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (true);