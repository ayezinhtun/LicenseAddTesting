/*
  # Fix RLS policies for audit_logs table

  1. Security Updates
    - Drop existing INSERT policy that may be causing issues
    - Create new INSERT policy that properly allows authenticated users to insert audit logs
    - Ensure the policy works with the current authentication setup

  2. Policy Changes
    - Allow authenticated users to insert audit logs without restrictions
    - Keep existing SELECT policy for viewing audit logs
*/

-- Drop the existing INSERT policy if it exists
DROP POLICY IF EXISTS "Users can insert audit logs" ON audit_logs;

-- Create a new INSERT policy that allows authenticated users to insert audit logs
CREATE POLICY "Enable insert for authenticated users"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Ensure the SELECT policy exists and works correctly
DROP POLICY IF EXISTS "Users can view audit logs" ON audit_logs;

CREATE POLICY "Enable read access for authenticated users"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (true);