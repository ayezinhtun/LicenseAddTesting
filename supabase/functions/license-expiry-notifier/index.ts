import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  // Use environment variables for Supabase credentials
  const supabase = createClient(
    Deno.env.get("PROJECT_URL")!, // Set later as secret
    Deno.env.get("SERVICE_ROLE_KEY")! // Set later as secret
  );

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const { data: serials, error } = await supabase
    .from("license_serials")
    .select("*")
    .eq("renewal", false);

  if (error) return new Response(JSON.stringify(error), { status: 500 });

  for (const s of serials) {
    const endDate = new Date(s.end_date);
    const notifyBefore = s.notify_before_days ?? 0;

    const notifyStart = new Date(endDate);
    notifyStart.setDate(endDate.getDate() - notifyBefore);

    const stopNotify = new Date(endDate);
    stopNotify.setDate(endDate.getDate() + 30);

    if (today < notifyStart || today > stopNotify) continue;
    if (s.last_notified_on === todayStr) continue;

    // Insert notification
    await supabase.from("notifications").insert({
      title: "License Expiry Reminder",
      message: `License ${s.serial_or_contract} expires on ${s.end_date}`,
      license_serial_id: s.id
    });

    // Update last notified date
    await supabase
      .from("license_serials")
      .update({ last_notified_on: todayStr })
      .eq("id", s.id);
  }

  return new Response(
    JSON.stringify({ status: "Daily license check done" }),
    { headers: { "Content-Type": "application/json" } }
  );
});
