/*
  # Fix audit logs RLS policy

  1. Security Changes
    - Update the INSERT policy for `audit_logs` table to allow all authenticated users to insert audit logs
    - This enables system-wide audit logging functionality for all authenticated users
    - The policy ensures only authenticated users can create audit logs, maintaining security

  2. Changes Made
    - Drop the existing restrictive INSERT policy
    - Create a new INSERT policy that allows all authenticated users to insert audit logs
*/

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can insert their own audit logs" ON audit_logs;

-- Create a new policy that allows all authenticated users to insert audit logs
CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);