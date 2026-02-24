import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("🚀 Daily expiry reminders triggered at:", new Date().toISOString());

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date();
    const todayUTC = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
    );
    const todayStr = todayUTC.toISOString().slice(0, 10);

    console.log("📅 Today's date (UTC):", todayStr);

    // Find expired serials
    const { data: expiredSerials, error: expiredError } = await supabase
      .from("license_serials")
      .select(`*, licenses!inner(created_by, item_description, project_assign)`)
      .lt("end_date", todayStr);

    if (expiredError) throw expiredError;

    console.log(`🔍 Found ${expiredSerials?.length || 0} expired serials`);
    console.log("📋 Expired serials:", expiredSerials);

    // Find expiring soon serials
    const { data: allSerials, error: allError } = await supabase
      .from("license_serials")
      .select(`*, licenses!inner(created_by, item_description, project_assign)`);

    if (allError) throw allError;

    const expiringSoon = allSerials?.filter(serial => {
      const notifyDays = serial.notify_before_days ?? 30;
      const notifyDate = new Date(
        new Date(serial.end_date).getTime() - notifyDays * 24 * 60 * 60 * 1000,
      );
      return todayUTC >= notifyDate && todayUTC <= new Date(serial.end_date);
    }) || [];

    console.log(`🔍 Found ${expiringSoon?.length || 0} serials expiring soon`);

    // Process all notifications
    const allNotifications = [...(expiredSerials || []), ...(expiringSoon || [])];

    for (const serial of allNotifications) {
      const isExpired = new Date(serial.end_date) < todayUTC;
      const daysUntil = Math.ceil(
        (new Date(serial.end_date).getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysOverdue = Math.abs(daysUntil);

      // Get assigned users
      const { data: assignments } = await supabase
        .from("user_project_assigns")
        .select("user_id")
        .eq("project_assign", serial.licenses.project_assign);

      const userIds = (assignments || []).map(a => a.user_id);

      if (userIds.length > 0) {
        // Get user profiles
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("id, email, full_name")
          .in("id", `(${userIds.map(id => `'${id}'`).join(',')})`);

        for (const profile of profiles || []) {
          // Check if notification already sent today
          const { data: existingNotif } = await supabase
            .from("notifications")
            .select("id")
            .eq("type", "expiry")
            .eq("license_id", serial.license_id)
            .eq("serial_id", serial.id)
            .eq("user_id", profile.id)
            .gte("created_at", todayStr + "T00:00:00.000Z")
            .single();

          if (!existingNotif) {
            // Create notification
            const notificationData = {
              type: "expiry",
              title: isExpired ? "Serial License Expired" : "Serial License Expiring Soon",
              message: `${serial.serial_or_contract} for ${serial.licenses.item_description} ${isExpired ? `expired ${daysOverdue} day(s) ago` : `expires in ${daysUntil} day(s)`}`,
              license_id: serial.license_id,
              serial_id: serial.id,
              user_id: profile.id,
              is_read: false,
              priority: daysUntil <= 7 || isExpired ? "high" : "medium",
              action_required: true,
              action_url: `/licenses/${serial.license_id}?serial=${serial.id}`,
              expires_at: null,
            };

            await supabase.from("notifications").insert(notificationData);

            // Send email
            const urgencyLevel = isExpired || daysUntil <= 7 ? "URGENT" : "IMPORTANT";
            const urgencyColor = isExpired || daysUntil <= 7 ? "#dc3545" : "#fd7e14";

            // Send email using direct HTTP call
            const response = await fetch(`${supabaseUrl}/functions/v1/send-email-notification`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                to: "ayezinhtun9@gmail.com",
                subject: `${urgencyLevel}: ${serial.serial_or_contract} License ${isExpired ? 'Expired' : 'Expiring Soon'}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
                      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">License Management System</h1>
                      <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">One Cloud Technology</p>
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
                    </div>
                    <div style="background: #343a40; color: white; padding: 25px 20px; text-align: center; margin: 0 20px;">
                      <p style="margin: 0; font-size: 12px; color: #6c757d;">
                        &copy; ${new Date().getFullYear()} One Cloud Technology. All rights reserved.
                      </p>
                    </div>
                  </div>
                `
              })
            });

            if (!response.ok) {
              console.error("❌ Email function error:", await response.json());
            } else {
              console.log(`📧 Sent ${isExpired ? 'expiry' : 'expiring'} notification to: ${profile.email} for ${serial.serial_or_contract}`);
            }
          }
        }
      }
    }

    // Always send a daily status notification (independent of user interaction)
    if (allNotifications.length === 0) {
      console.log("📧 No expiring licenses found, sending daily status notification");

      // Send email using direct HTTP call
      const response = await fetch(`${supabaseUrl}/functions/v1/send-email-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: "ayezinhtun9@gmail.com",
          subject: "Daily License Status Report",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">License Management System</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">One Cloud Technology</p>
              </div>
              <div style="padding: 30px 20px; background: white; margin: 0 20px;">
                <h2 style="color: #333; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">Daily Status Report</h2>
                <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                  Daily licence check completed on ${todayStr}. No licenses are expiring today.
                </p>
                <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px; margin: 25px 0;">
                  <h4 style="margin: 0 0 10px 0; color: #721c24; font-size: 16px; font-weight: 600;">📋 System Status:</h4>
                  <ul style="margin: 0; padding-left: 20px; color: #721c24;">
                    <li>All licenses are up to date</li>
                    <li>No action required today</li>
                  </ul>
                </div>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e9ecef;">
                  <p style="margin: 0; font-size: 12px; color: #6c757d;">
                    This is an automated daily report from 1Cloud Technology License Management System.
                  </p>
                </div>
              </div>
            </div>
          `
        }
      });
    }

    console.log("✅ Daily expiry reminders completed successfully!");

    return new Response(
      JSON.stringify({
        message: "Daily reminders sent successfully",
        expiredCount: expiredSerials?.length || 0,
        expiringSoonCount: expiringSoon?.length || 0,
        totalProcessed: allNotifications.length
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );

  } catch (err) {
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

// Helper function to create Supabase client
function createClient(url: string, key: string) {
  return {
    from: (table: string) => ({
      select: (columns: string) => ({
        lt: (column: string, value: string) => query(table, columns, 'lt', column, value, url, key),
        lte: (column: string, value: string) => query(table, columns, 'lte', column, value, url, key),
        in: (column: string, values: string) => query(table, columns, 'in', column, values, url, key),
        eq: (column: string, value: string) => query(table, columns, 'eq', column, value, url, key),
        single: () => query(table, columns, 'single', '', '', url, key)
      }),
      insert: (data: any) => insertMutation(table, data, url, key)
    })
  };
}

async function query(table: string, columns: string, operator: string, column: string, value: string, url: string, key: string, single = false) {
  const response = await fetch(`${url}/rest/v1/${table}?${column}=${operator}.${value}&select=${columns}`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });

  const data = await response.json();
  return { data: single ? data[0] : data, error: response.ok ? null : data };
}

async function insertMutation(table: string, data: any, url: string, key: string) {
  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  const result = await response.json();
  return { data: result, error: response.ok ? null : result };
}
