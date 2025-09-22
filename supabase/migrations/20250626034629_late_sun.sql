/*
  # Fix audit logs RLS policy

  1. Security Updates
    - Drop existing RLS policy that has type mismatch
    - Create new RLS policy that properly handles UUID to text conversion
    - Ensure authenticated users can insert their own audit logs
    - Maintain read access for authenticated users

  2. Changes
    - Fix INSERT policy to properly cast auth.uid() to text for comparison
    - Keep existing SELECT policy as it works correctly
*/

-- Drop the existing INSERT policy that has the type mismatch issue
DROP POLICY IF EXISTS "Authenticated users can insert their audit logs" ON audit_logs;

-- Create a new INSERT policy with proper type casting
CREATE POLICY "Authenticated users can insert their audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid())::text = user_id);

-- Ensure the SELECT policy exists and works correctly
DROP POLICY IF EXISTS "Authenticated users can view audit logs" ON audit_logs;

CREATE POLICY "Authenticated users can view audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (true);