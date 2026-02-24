// Daily Expiry Reminder Cron Job
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kioqpivshgtpacwklcho.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpb3FwaXZzaGd0cGFjd2tsY2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MjUyODgsImV4cCI6MjA3NDEwMTI4OH0.svofeF_4ER7AcqbWBWVORk7ejHcA9ZGQfVcOP47j8s8';
const supabase = createClient(supabaseUrl, supabaseKey);

const today = new Date();
const todayUTC = new Date(
  Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
);
const todayStr = todayUTC.toISOString().slice(0, 10);

async function sendDailyReminders() {
  console.log('🚀 Starting daily expiry reminders at:', new Date().toISOString());
  
  try {
    // Get ALL serials first
    const { data: allSerials, error: allError } = await supabase
      .from("license_serials")
      .select(`*, licenses!inner(created_by, item_description, project_assign)`);

    if (allError) throw allError;

    console.log(`🔍 Found ${allSerials?.length || 0} total serials in database`);

    // ✅ KEY FIX: Filter for serials that need notifications TODAY
    const serialsNeedingNotifications = (allSerials || []).filter(serial => {
      const notifyDays = serial.notify_before_days ?? 30;
      const notifyDate = new Date(
        new Date(serial.end_date).getTime() - notifyDays * 24 * 60 * 60 * 1000,
      );
      
      // Send when notify date is reached (like dashboard)
      const shouldNotify = todayUTC >= notifyDate && todayUTC <= new Date(serial.end_date);
      
      if (shouldNotify) {
        console.log(`✅ ${serial.serial_or_contract} needs notification (notify ${notifyDays} days before expiry)`);
      }
      
      return shouldNotify;
    });

    console.log(`🎯 Found ${serialsNeedingNotifications.length} serials needing notifications today`);

    for (const serial of serialsNeedingNotifications) {
      const notifyDays = serial.notify_before_days ?? 30;
      const daysUntil = Math.ceil(
        (new Date(serial.end_date).getTime() - todayUTC.getTime()) /
        (1000 * 60 * 60 * 24),
      );

      console.log(`🔔 Processing: ${serial.serial_or_contract} for ${serial.licenses.item_description}`);
      
      // Get assigned users for this project
      const { data: assignments } = await supabase
        .from("user_project_assigns")
        .select("user_id")
        .eq("project_assign", serial.licenses.project_assign);

      const userIds = (assignments || []).map(a => a.user_id);
      
      if (userIds.length > 0) {
        // Get user emails
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("id, email, full_name")
          .in("id", `(${userIds.map(id => `'${id}'`).join(',')})`);

        for (const profile of profiles || []) {
          console.log(`📧 Sending to: ${profile.full_name} (${profile.email})`);
          
          // Create notification
          await supabase
            .from("notifications")
            .insert({
              type: "expiry",
              title: daysUntil <= 7 ? "URGENT: License Expiring Soon" : "License Expiring Soon",
              message: `${serial.serial_or_contract} for ${serial.licenses.item_description} expires in ${daysUntil} day(s)`,
              license_id: serial.license_id,
              serial_id: serial.id,
              user_id: profile.id,
              is_read: false,
              priority: daysUntil <= 7 ? "high" : "medium",
              action_required: true,
              action_url: `/licenses/${serial.license_id}?serial=${serial.id}`,
              expires_at: null,
            });

          // Send email
          await supabase.functions.invoke('send-email-notification', {
            body: {
              to: profile.email,
              subject: `${daysUntil <= 7 ? 'URGENT' : 'IMPORTANT'}: ${serial.serial_or_contract} License Expiring Soon`,
              html: `...your email template...`
            }
          });
        }
      }
    }

    console.log('✅ Daily expiry reminders completed successfully!');
    
  } catch (error) {
    console.error('❌ Error in daily reminders:', error);
  }
}

// Run the function
sendDailyReminders();