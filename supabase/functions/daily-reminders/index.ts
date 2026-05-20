import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date();
    const todayUTC = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
    );

    const todayStr = todayUTC.toISOString().slice(0, 10);

    // =====================
    // GET SERIALS
    // =====================
    const { data: allSerials, error } = await supabase
      .from("license_serials")
      .select(`*, licenses!inner(id, item_description, project_assign)`);

    if (error) throw error;

    const expired =
      allSerials?.filter((s) => new Date(s.end_date) < todayUTC) || [];

    const expiring =
      allSerials?.filter((s) => {
        const notifyDays = s.notify_before_days ?? 30;
        const end = new Date(s.end_date);
        const notifyDate = new Date(end.getTime() - notifyDays * 86400000);

        return todayUTC >= notifyDate && todayUTC <= end;
      }) || [];

    const targets = [...expired, ...expiring];

    let notificationsCreated = 0;

    // =====================
    // PROCESS SERIALS
    // =====================
    for (const serial of targets) {
      const project = serial.licenses.project_assign;

      // =====================
      // PROJECT USERS
      // =====================
      const { data: assigns } = await supabase
        .from("user_project_assigns")
        .select("user_id")
        .eq("project_assign", project);

      const userIds = assigns?.map((u) => u.user_id) || [];

      const { data: users } = await supabase
        .from("user_profiles")
        .select("id, user_id, email, role")
        .in("user_id", userIds);

      // =====================
      // ADMIN USERS (ALL ACCESS)
      // =====================
      const { data: admins } = await supabase
        .from("user_profiles")
        .select("id, user_id, email, role")
        .eq("role", "admin");

      const finalUsers = new Map();

      // admin gets ALL
      admins?.forEach((a) => finalUsers.set(a.user_id, a));

      // project users (non-admin duplicates avoided)
      users?.forEach((u) => {
        if (u.role !== "admin") {
          finalUsers.set(u.user_id, u);
        }
      });

      const recipients = Array.from(finalUsers.values());

      if (recipients.length === 0) continue;

      // =====================
      // CHECK DUPLICATE
      // =====================
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("type", "expiry")
        .eq("license_id", serial.license_id)
        .eq("serial_id", serial.id)
        .gte("created_at", todayStr + "T00:00:00.000Z")
        .maybeSingle();

      if (existing) continue;

      const isExpired = new Date(serial.end_date) < todayUTC;

      const daysUntil = Math.ceil(
        (new Date(serial.end_date).getTime() - todayUTC.getTime()) / 86400000,
      );

      // =====================
      // CREATE NOTIFICATION PER USER (🔥 FIX)
      // =====================
      for (const user of recipients) {
        const { error: insertError } = await supabase
          .from("notifications")
          .insert({
            type: "expiry",
            title: isExpired ? "License Expired" : "License Expiring Soon",
            message: `${serial.serial_or_contract} - ${
              serial.licenses.item_description
            } ${isExpired ? "expired" : `expires in ${daysUntil} days`}`,
            license_id: serial.license_id,
            serial_id: serial.id,
            user_id: user.user_id, // ✅ FIXED (REAL USER ID)
            is_read: false,
            priority: isExpired || daysUntil <= 7 ? "high" : "medium",
            created_at: todayStr + "T00:00:00.000Z",
          });

        if (!insertError) {
          notificationsCreated++;
        }

        // =====================
        // EMAIL PER USER
        // =====================
        const emailResponse = await fetch(
          `${supabaseUrl}/functions/v1/send-email-notification`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              apikey: supabaseKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: user.email,
              subject: `${
                isExpired ? "URGENT" : "IMPORTANT"
              }: Subscription Expiry Notification`,

html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">

  <!-- HEADER -->
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">
      Subscription Management System
    </h1>
    <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">
      1Cloud Technology
    </p>
  </div>

  <!-- STATUS BAR -->
  <div style="background: ${isExpired ? '#dc3545' : daysUntil <= 7 ? '#fd7e14' : '#ffc107'}; color: white; padding: 15px 20px; text-align: center; font-weight: 600; font-size: 16px;">
    ${isExpired ? 'EXPIRED - ACTION REQUIRED' : 'EXPIRING SOON - ACTION REQUIRED'}
  </div>

  <!-- BODY -->
  <div style="padding: 30px 20px; background: white; margin: 0 20px;">

    <h2 style="color: #dc3545; margin: 0 0 20px 0; font-size: 22px;">
      ⚠️ License ${isExpired ? 'Expired' : 'Expiring Soon'}
    </h2>

    <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
      <strong>${serial.serial_or_contract}</strong> for
      <strong>${serial.licenses.item_description}</strong>
      ${
        isExpired
          ? `expired ${Math.abs(daysUntil)} day(s) ago`
          : `expires in ${daysUntil} day(s)`
      }.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href=""
         style="background: ${isExpired ? '#dc3545' : '#667eea'}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">
        View License Details
      </a>
    </div>

  </div>

  <!-- FOOTER -->
  <div style="background: #343a40; color: white; padding: 25px 20px; text-align: center; margin: 0 20px;">

    <p style="margin: 0 0 10px 0; font-size: 14px; color: #adb5bd;">
      1Cloud Technology Subscription Management System
    </p>

    <p style="margin: 0; font-size: 12px; color: #6c757d;">
      © ${new Date().getFullYear()} 1Cloud Technology. All rights reserved.
    </p>

  </div>

</div>
`,
            }),
          },
        );

        const emailText = await emailResponse.text();

        console.log("EMAIL STATUS:", emailResponse.status);
        console.log("EMAIL RESPONSE:", emailText);
        console.log("EMAIL TO:", user.email);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Daily reminders sent successfully",
        expiredCount: expired.length,
        expiringSoonCount: expiring.length,
        totalProcessed: targets.length,
        notificationsCreated,
        todayUTC: todayStr,
      }),
      { status: 200, headers: corsHeaders },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
