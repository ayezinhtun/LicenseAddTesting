/*
  # Fix audit logs RLS policy

  1. Security Updates
    - Update the INSERT policy for audit_logs table to allow authenticated users to insert audit logs
    - The policy ensures that users can only insert logs with their own user_id
    - This fixes the RLS violation error when logging actions

  2. Changes
    - Drop the existing restrictive INSERT policy
    - Create a new INSERT policy that properly handles user authentication
    - Ensure the policy allows authenticated users to log their own actions
*/

-- Drop the existing INSERT policy that's causing issues
DROP POLICY IF EXISTS "Authenticated users can insert their audit logs" ON audit_logs;

-- Create a new INSERT policy that allows authenticated users to insert audit logs
-- The policy ensures that the user_id in the audit log matches the authenticated user's ID
CREATE POLICY "Users can insert their own audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

-- Also ensure we have a proper SELECT policy for viewing audit logs
DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON audit_logs;

CREATE POLICY "Users can view all audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (true);