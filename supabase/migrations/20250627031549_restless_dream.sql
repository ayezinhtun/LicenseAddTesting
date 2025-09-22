/*
  # Fix audit logs RLS policy

  1. Security Updates
    - Update RLS policy for audit_logs table to allow authenticated users to insert logs
    - The policy should allow users to insert audit logs where user_id matches their auth.uid()
    - Also allow reading audit logs for authenticated users

  2. Changes
    - Drop existing restrictive INSERT policy
    - Create new INSERT policy that allows authenticated users to log their actions
    - Ensure SELECT policy allows authenticated users to view audit logs
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Users can view all audit logs" ON audit_logs;

-- Create new INSERT policy that allows authenticated users to insert their own audit logs
CREATE POLICY "Allow authenticated users to insert audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

-- Create SELECT policy that allows authenticated users to view all audit logs
CREATE POLICY "Allow authenticated users to view audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (true);