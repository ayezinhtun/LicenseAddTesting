import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("🚀 CORRECTED: Daily expiry reminders");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date();
    const todayUTC = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
    );
    const todayStr = todayUTC.toISOString().slice(0, 10);
    
    console.log("📅 Today's date (UTC):", todayStr);

    // Get ALL serials
    const { data: allSerials, error: allError } = await supabase
      .from("license_serials")
      .select(`*, licenses!inner(created_by, item_description, project_assign)`);

    if (allError) throw allError;
    console.log(`🔍 Found ${allSerials?.length || 0} total serials`);

    // Find expired serials
    const expiredSerials = allSerials?.filter((serial: any) => {
      const endDate = new Date(serial.end_date);
      return endDate < todayUTC;
    }) || [];

    console.log(`🔍 Found ${expiredSerials.length} expired serials`);

    // Find expiring soon serials - CORRECTED LOGIC
    const expiringSoon = allSerials?.filter((serial: any) => {
      const notifyDays = serial.notify_before_days ?? 30;
      
      // ✅ CORRECTED: Calculate notify date properly
      const endDate = new Date(serial.end_date);
      const notifyDate = new Date(endDate.getTime() - (notifyDays * 24 * 60 * 60 * 1000));
      
      // ✅ CORRECTED: Only notify when notify date is reached OR passed
      const shouldNotify = todayUTC >= notifyDate && todayUTC <= endDate;
      
      console.log(`🔍 ${serial.serial_or_contract}:`);
      console.log(`   - End Date: ${serial.end_date} (${endDate.toISOString()})`);
      console.log(`   - Notify Days: ${notifyDays}`);
      console.log(`   - Notify Date: ${notifyDate.toISOString().slice(0, 10)}`);
      console.log(`   - Today: ${todayStr}`);
      console.log(`   - Should Notify: ${shouldNotify}`);
      console.log(`   - Today >= Notify: ${todayUTC >= notifyDate}`);
      console.log(`   - Today <= End: ${todayUTC <= endDate}`);
      console.log(`---`);
      
      return shouldNotify;
    }) || [];

    console.log(`🔍 Found ${expiringSoon.length} serials expiring soon`);

    // Process all notifications
    const allNotifications = [...expiredSerials, ...expiringSoon];
    let totalNotificationsCreated = 0;
    
    for (const serial of allNotifications) {
      const isExpired = new Date(serial.end_date) < todayUTC;
      const daysUntil = Math.ceil(
        (new Date(serial.end_date).getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysOverdue = Math.abs(daysUntil);

      console.log("🔔 Processing: ${serial.serial_or_contract} for ${serial.licenses.item_description} (${serial.licenses.project_assign})");

      // Get all users assigned to this project
      console.log(`🔍 Looking for users assigned to project: ${serial.licenses.project_assign}`);
      const { data: projectAssignments, error: assignError } = await supabase
        .from("user_project_assigns")
        .select("user_id")
        .eq("project_assign", serial.licenses.project_assign);

      if (assignError) {
        console.error("❌ Error getting project assignments:", assignError);
        continue;
      }

      console.log(`📋 Found ${projectAssignments?.length || 0} project assignments:`, projectAssignments);

      if (!projectAssignments || projectAssignments.length === 0) {
        console.log(`⚠️ No users assigned to project: ${serial.licenses.project_assign}`);
        continue;
      }

      // Get user details for all assigned users
      const userIds = projectAssignments.map((a: any) => a.user_id);
      console.log("🔍 User IDs to lookup:", userIds);
      
      // Try individual queries instead of OR query
      const userProfiles: any[] = [];
      for (const userId of userIds) {
        console.log(`🔍 Looking up user: ${userId}`);
        const { data: userProfile, error: singleUserError } = await supabase
          .from("user_profiles")
          .select("id, email, full_name")
          .eq("user_id", userId)  // ✅ FIXED: Use user_id instead of id
          .single();
        
        if (singleUserError) {
          console.error(`❌ Error getting user ${userId}:`, singleUserError);
        } else if (userProfile) {
          console.log(`✅ Found user: ${userProfile.email}`);
          userProfiles.push(userProfile);
        }
      }

      console.log("👤 User profiles found:", userProfiles);
      console.log(`👥 Found ${userProfiles?.length || 0} users for project ${serial.licenses.project_assign}:`, userProfiles?.map((u: any) => u.email));

      // Send to each assigned user
      for (const user of userProfiles || []) {

        // Check if notification already sent today
        const { data: existingNotif } = await supabase
          .from("notifications")
          .select("id")
          .eq("type", "expiry")
          .eq("license_id", serial.license_id)
          .eq("serial_id", serial.id)
          .eq("user_id", user.id)
          .gte("created_at", todayStr + "T00:00:00.000Z")
          .maybeSingle();

        if (!existingNotif) {
          // Create notification
          const notificationData = {
            type: "expiry",
            title: isExpired ? "Serial License Expired" : "Serial License Expiring Soon",
            message: `${serial.serial_or_contract} for ${serial.licenses.item_description} ${isExpired ? `expired ${daysOverdue} day(s) ago` : `expires in ${daysUntil} day(s)`}`,
            license_id: serial.license_id,
            serial_id: serial.id,
            user_id: user.id,
            is_read: false,
            priority: daysUntil <= 7 || isExpired ? "high" : "medium",
            action_required: true,
            action_url: `/licenses/${serial.license_id}?serial=${serial.id}`,
            expires_at: null,
          };

          const { error: insertError } = await supabase
            .from("notifications")
            .insert(notificationData);

          if (insertError) {
            console.error("❌ Error inserting notification:", insertError);
            continue;
          }

          totalNotificationsCreated++;

          // Send email to user
          const urgencyLevel = isExpired || daysUntil <= 7 ? "URGENT" : "IMPORTANT";
          const urgencyColor = isExpired || daysUntil <= 7 ? "#dc3545" : "#fd7e14";
          
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/send-email-notification`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                to: user.email,
                subject: `${urgencyLevel}: ${serial.serial_or_contract} License ${isExpired ? 'Expired' : 'Expiring Soon'}`,
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
                  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">License Management System</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">1Cloud Technology</p>
                  </div>
                  <div style="background: ${urgencyColor}; color: white; padding: 15px 20px; text-align: center; font-weight: 600; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
                    ${urgencyLevel} - ACTION REQUIRED
                  </div>
                  <div style="padding: 30px 20px; background: white; margin: 0 20px;">
                    <h2 style="color: #dc3545; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">
                      ⚠️ License ${isExpired ? 'Expired' : 'Expiring Soon'}
                    </h2>
                    <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                      ${serial.serial_or_contract} for ${serial.licenses.item_description} ${isExpired ? `expired ${daysOverdue} day(s) ago` : `expires in ${daysUntil} day(s)`}.
                    </p>
                    <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px; margin: 25px 0;">
                      <h4 style="margin: 0 0 10px 0; color: #721c24; font-size: 16px; font-weight: 600;">📋 Action Required:</h4>
                      <ul style="margin: 0; padding-left: 20px; color: #721c24;">
                        <li>${isExpired ? 'Contact vendor immediately' : 'Review license details'}</li>
                        <li>Check renewal options</li>
                        <li>Update license information in system</li>
                        <li>Notify relevant team members</li>
                      </ul>
                    </div>
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="https://your-app-domain.com${notificationData.action_url}" 
                         style="background: ${urgencyColor}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 14px;">
                        View License Details
                      </a>
                    </div>
                  </div>
                  <div style="background: #343a40; color: white; padding: 25px 20px; text-align: center; margin: 0 20px;">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #adb5bd;">
                      This is an automated notification from 1Cloud Technology License Management System.
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #6c757d;">
                      © ${new Date().getFullYear()} 1Cloud Technology. All rights reserved.
                    </p>
                  </div>
                </div>
              `
              })
            });

            if (!response.ok) {
              const errorData = await response.json();
              console.error("❌ Error sending email:", errorData);
            } else {
              console.log(`📧 Sent ${isExpired ? 'expiry' : 'expiring'} notification to: ${user.email} for ${serial.serial_or_contract}`);
            }
          } catch (emailError) {
            console.error("❌ Error sending email:", emailError);
          }
        } else {
          console.log(`⏭️ Notification already sent today to: ${user.email} for ${serial.serial_or_contract}`);
        }
      }
    }

    console.log("✅ Daily expiry reminders completed successfully!");
    console.log(`📊 Summary: ${totalNotificationsCreated} new notifications created`);

    return new Response(
      JSON.stringify({ 
        message: "Daily reminders sent successfully",
        expiredCount: expiredSerials.length,
        expiringSoonCount: expiringSoon.length,
        totalProcessed: allNotifications.length,
        notificationsCreated: totalNotificationsCreated,
        todayUTC: todayStr
      }), 
      {
        status: 200,
        headers: corsHeaders,
      }
    );

  } catch (err: any) {
    console.error("❌ Error in daily reminders:", err);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        message: err.message 
      }), 
      { 
        status: 500,
        headers: corsHeaders,
      }
    );
  }
});
