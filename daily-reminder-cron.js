// Daily Expiry Reminder Cron Job
// Schedule this to run daily at 9:00 AM

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kioqpivshgtpacwklcho.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtpb3FwaXZzaGd0cGFjd2tsY2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MjUyODgsImV4cCI6MjA3NDEwMTI4OH0.svofeF_4ER7AcqbWBWVORk7ejHcA9ZGQfVcOP47j8s8';
const supabase = createClient(supabaseUrl, supabaseKey);

async function sendDailyReminders() {
  console.log('🚀 Starting daily expiry reminders at:', new Date().toISOString());
  
  try {
    // Call the notification store function
    // This simulates calling your notificationStore.sendDailyExpiryReminders()
    
    const today = new Date();
    const todayUTC = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
    );
    const todayStr = todayUTC.toISOString().slice(0, 10);

    // Find expired serials
    const { data: expiredSerials, error: expiredError } = await supabase
      .from("license_serials")
      .select(`*, licenses!inner(created_by, item_description, project_assign)`)
      .lt("end_date", todayStr);

    if (expiredError) throw expiredError;

    console.log(`🔍 Found ${expiredSerials?.length || 0} expired serials`);

    // Process expired serials
    for (const serial of expiredSerials || []) {
      const daysOverdue = Math.ceil(
        (todayUTC.getTime() - new Date(serial.end_date).getTime()) /
        (1000 * 60 * 60 * 24),
      );

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
          // Create notification
          await supabase
            .from("notifications")
            .insert({
              type: "expiry",
              title: "Serial License Expired",
              message: `${serial.serial_or_contract} for ${serial.licenses.item_description} expired ${daysOverdue} day(s) ago`,
              license_id: serial.license_id,
              serial_id: serial.id,
              user_id: profile.id,
              is_read: false,
              priority: "high",
              action_required: true,
              action_url: `/licenses/${serial.license_id}?serial=${serial.id}`,
              expires_at: null,
            });

          // Send email via Edge Function
          await supabase.functions.invoke('send-email-notification', {
            body: {
              to: profile.email,
              subject: `URGENT: ${serial.serial_or_contract} License Expired`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">License Management System</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">One Cloud Technology</p>
                  </div>
                  <div style="background: #dc3545; color: white; padding: 15px 20px; text-align: center; font-weight: 600; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
                    URGENT - LICENSE EXPIRED
                  </div>
                  <div style="padding: 30px 20px; background: white; margin: 0 20px;">
                    <h2 style="color: #dc3545; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">
                      ⚠️ License Expired
                    </h2>
                    <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                      ${serial.serial_or_contract} for ${serial.licenses.item_description} expired ${daysOverdue} day(s) ago.
                    </p>
                    <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px; margin: 25px 0;">
                      <h4 style="margin: 0 0 10px 0; color: #721c24; font-size: 16px; font-weight: 600;">📋 Immediate Action Required:</h4>
                      <ul style="margin: 0; padding-left: 20px; color: #721c24;">
                        <li>Contact vendor immediately for renewal options</li>
                        <li>Check if service is still active</li>
                        <li>Update license status in system</li>
                        <li>Notify relevant team members</li>
                      </ul>
                    </div>
                  </div>
                  <div style="background: #343a40; color: white; padding: 25px 20px; text-align: center; margin: 0 20px;">
                    <p style="margin: 0; font-size: 12px; color: #6c757d;">
                      © ${new Date().getFullYear()} One Cloud Technology. All rights reserved.
                    </p>
                  </div>
                </div>
              `
            }
          });
          
          console.log(`📧 Sent expiry notification to: ${profile.email} for ${serial.serial_or_contract}`);
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
