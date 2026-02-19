-- Create table to track which users have read which notifications
CREATE TABLE notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamp with time zone DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_notification_reads_notification_id ON notification_reads(notification_id);
CREATE INDEX idx_notification_reads_user_id ON notification_reads(user_id);


-- Create trigger to remove read records when notification is deleted
CREATE OR REPLACE FUNCTION cleanup_notification_reads()
RETURNS trigger AS $$
BEGIN
  DELETE FROM notification_reads WHERE notification_id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_notification_reads
AFTER DELETE ON notifications
FOR EACH ROW
EXECUTE FUNCTION cleanup_notification_reads();