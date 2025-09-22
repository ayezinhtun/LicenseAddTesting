/*
  # Fix audit logs RLS policy

  1. Security Updates
    - Update the INSERT policy for audit_logs table to allow authenticated users to insert audit logs
    - The current policy is too restrictive and prevents proper audit logging
    - Change from checking user_id match to allowing all authenticated users to insert audit logs

  2. Changes
    - Drop the existing restrictive INSERT policy
    - Create a new INSERT policy that allows all authenticated users to insert audit logs
    - This is necessary because audit logs should capture all user actions, not just self-referential ones
*/

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can insert their own audit logs" ON audit_logs;

-- Create a new INSERT policy that allows all authenticated users to insert audit logs
CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);