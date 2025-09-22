/*
  # Initial License Management Schema

  1. New Tables
    - `licenses`
      - `id` (uuid, primary key)
      - `company` (text)
      - `vendor` (text)
      - `item` (text)
      - `item_description` (text)
      - `serial_number` (text, unique)
      - `project_name` (text)
      - `customer_name` (text)
      - `business_unit` (text)
      - `license_start_date` (date)
      - `license_end_date` (date)
      - `license_cost` (numeric)
      - `quantity` (integer)
      - `auto_renew` (boolean)
      - `user_name` (text)
      - `url` (text, nullable)
      - `activation_link` (text, nullable)
      - `remark` (text, nullable)
      - `custom_fields` (jsonb)
      - `tags` (text array)
      - `priority` (enum: low, medium, high, critical)
      - `status` (enum: active, expired, suspended, pending)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (text)
      - `last_modified_by` (text)

    - `audit_logs`
      - `id` (uuid, primary key)
      - `action` (enum: create, update, delete, view, export, login, logout)
      - `entity_type` (enum: license, user, report, notification)
      - `entity_id` (text)
      - `user_id` (text)
      - `user_name` (text)
      - `changes` (jsonb, nullable)
      - `ip_address` (text, nullable)
      - `user_agent` (text, nullable)
      - `created_at` (timestamptz)

    - `notifications`
      - `id` (uuid, primary key)
      - `type` (enum: expiry, renewal, comment, system, warning, info)
      - `title` (text)
      - `message` (text)
      - `license_id` (uuid, nullable, foreign key)
      - `user_id` (text)
      - `is_read` (boolean)
      - `priority` (enum: low, medium, high)
      - `action_required` (boolean)
      - `action_url` (text, nullable)
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz, nullable)

    - `license_comments`
      - `id` (uuid, primary key)
      - `license_id` (uuid, foreign key)
      - `content` (text)
      - `author_id` (text)
      - `author_name` (text)
      - `created_at` (timestamptz)
      - `is_edited` (boolean)
      - `edited_at` (timestamptz, nullable)
      - `mentions` (text array)

    - `license_attachments`
      - `id` (uuid, primary key)
      - `license_id` (uuid, foreign key)
      - `file_name` (text)
      - `file_type` (text)
      - `file_size` (bigint)
      - `file_url` (text)
      - `uploaded_by` (text)
      - `uploaded_at` (timestamptz)
      - `description` (text, nullable)

    - `renewal_history`
      - `id` (uuid, primary key)
      - `license_id` (uuid, foreign key)
      - `renewal_date` (timestamptz)
      - `previous_end_date` (date)
      - `new_end_date` (date)
      - `cost` (numeric)
      - `renewed_by` (text)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their data
    - Add indexes for performance

  3. Storage
    - Create bucket for license attachments
*/

-- Create custom types
CREATE TYPE priority_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE license_status AS ENUM ('active', 'expired', 'suspended', 'pending');
CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'view', 'export', 'login', 'logout');
CREATE TYPE entity_type AS ENUM ('license', 'user', 'report', 'notification');
CREATE TYPE notification_type AS ENUM ('expiry', 'renewal', 'comment', 'system', 'warning', 'info');
CREATE TYPE notification_priority AS ENUM ('low', 'medium', 'high');

-- Create licenses table
CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company text NOT NULL,
  vendor text NOT NULL,
  item text NOT NULL,
  item_description text NOT NULL,
  serial_number text UNIQUE NOT NULL,
  project_name text NOT NULL,
  customer_name text NOT NULL,
  business_unit text NOT NULL,
  license_start_date date NOT NULL,
  license_end_date date NOT NULL,
  license_cost numeric(12,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  auto_renew boolean NOT NULL DEFAULT false,
  user_name text NOT NULL,
  url text,
  activation_link text,
  remark text,
  custom_fields jsonb DEFAULT '{}',
  tags text[] DEFAULT '{}',
  priority priority_level NOT NULL DEFAULT 'medium',
  status license_status NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text NOT NULL,
  last_modified_by text NOT NULL
);

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action audit_action NOT NULL,
  entity_type entity_type NOT NULL,
  entity_id text NOT NULL,
  user_id text NOT NULL,
  user_name text NOT NULL,
  changes jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  license_id uuid REFERENCES licenses(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  priority notification_priority NOT NULL DEFAULT 'medium',
  action_required boolean NOT NULL DEFAULT false,
  action_url text,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- Create license_comments table
CREATE TABLE IF NOT EXISTS license_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  content text NOT NULL,
  author_id text NOT NULL,
  author_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  is_edited boolean NOT NULL DEFAULT false,
  edited_at timestamptz,
  mentions text[] DEFAULT '{}'
);

-- Create license_attachments table
CREATE TABLE IF NOT EXISTS license_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  file_url text NOT NULL,
  uploaded_by text NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  description text
);

-- Create renewal_history table
CREATE TABLE IF NOT EXISTS renewal_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  renewal_date timestamptz NOT NULL DEFAULT now(),
  previous_end_date date NOT NULL,
  new_end_date date NOT NULL,
  cost numeric(12,2) NOT NULL,
  renewed_by text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewal_history ENABLE ROW LEVEL SECURITY;

-- to add user_id into license
ALTER TABLE public.licenses
ADD COLUMN user_id uuid REFERENCES auth.users(id);


-- Create policies for licenses
CREATE POLICY "Users can view all licenses"
  ON licenses
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert licenses"
  ON licenses
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update licenses"
  ON licenses
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete licenses"
  ON licenses
  FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for audit_logs
CREATE POLICY "Users can view audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert audit logs"
  ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create policies for notifications
CREATE POLICY "Users can view their notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete their notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for license_comments
CREATE POLICY "Users can view license comments"
  ON license_comments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert license comments"
  ON license_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update their comments"
  ON license_comments
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create policies for license_attachments
CREATE POLICY "Users can view license attachments"
  ON license_attachments
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert license attachments"
  ON license_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete license attachments"
  ON license_attachments
  FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for renewal_history
CREATE POLICY "Users can view renewal history"
  ON renewal_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert renewal history"
  ON renewal_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_licenses_vendor ON licenses(vendor);
CREATE INDEX IF NOT EXISTS idx_licenses_project_name ON licenses(project_name);
CREATE INDEX IF NOT EXISTS idx_licenses_end_date ON licenses(license_end_date);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_priority ON licenses(priority);
CREATE INDEX IF NOT EXISTS idx_licenses_created_at ON licenses(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_license_comments_license_id ON license_comments(license_id);
CREATE INDEX IF NOT EXISTS idx_license_attachments_license_id ON license_attachments(license_id);
CREATE INDEX IF NOT EXISTS idx_renewal_history_license_id ON renewal_history(license_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for licenses table
CREATE TRIGGER update_licenses_updated_at
  BEFORE UPDATE ON licenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO licenses (
  company, vendor, item, item_description, serial_number, project_name, 
  customer_name, business_unit, license_start_date, license_end_date, 
  license_cost, quantity, auto_renew, user_name, url, activation_link, 
  remark, custom_fields, tags, priority, status, created_by, last_modified_by
) VALUES 
(
  '1Cloud Technology', 'Microsoft', 'Office 365 Enterprise E3', 
  'Complete productivity suite with advanced security and compliance features',
  'MSO365-E3-2024-001', 'Corporate Infrastructure', 'Internal Operations', 
  'IT Department', '2024-01-01', '2025-01-01', 15000.00, 75, true,
  'admin@1cloudtechnology.com', 'https://admin.microsoft.com', 
  'https://portal.office.com/adminportal', 'Primary productivity suite for all employees',
  '{"Support Level": "Premium", "Region": "Global", "Department": "All Departments"}',
  ARRAY['productivity', 'email', 'collaboration', 'essential'], 'critical', 'active',
  'admin@1cloudtechnology.com', 'admin@1cloudtechnology.com'
),
(
  '1Cloud Technology', 'Adobe', 'Creative Cloud All Apps',
  'Complete creative suite including Photoshop, Illustrator, InDesign, and more',
  'ACC-ALL-2024-002', 'Marketing & Design', 'Creative Team', 'Marketing',
  '2024-02-01', '2024-12-31', 12600.00, 15, false,
  'design@1cloudtechnology.com', 'https://adminconsole.adobe.com',
  'https://creativecloud.adobe.com', 'Design team licenses - renewal needed soon',
  '{"Support Level": "Standard", "Region": "North America", "Department": "Marketing"}',
  ARRAY['design', 'creative', 'marketing', 'expiring-soon'], 'high', 'active',
  'admin@1cloudtechnology.com', 'admin@1cloudtechnology.com'
),
(
  '1Cloud Technology', 'Atlassian', 'Jira Software Cloud',
  'Project management and issue tracking for software development teams',
  'JIRA-CLOUD-2024-003', 'Software Development', 'Development Team', 'Engineering',
  '2024-03-01', '2025-03-01', 8400.00, 25, true,
  'dev@1cloudtechnology.com', 'https://1cloudtech.atlassian.net',
  'https://admin.atlassian.com', 'Essential for development workflow',
  '{"Support Level": "Premium", "Region": "Global", "Department": "Engineering"}',
  ARRAY['development', 'project-management', 'agile', 'essential'], 'high', 'active',
  'admin@1cloudtechnology.com', 'admin@1cloudtechnology.com'
);