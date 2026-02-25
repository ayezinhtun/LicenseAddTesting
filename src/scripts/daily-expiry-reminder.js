import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function utcTodayStartISO() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

async function notificationExistsToday({ user_id, license_id, serial_id }) {
  const todayStart = utcTodayStartISO();
  const userIdText = String(user_id);
  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("type", "expiry")
    .eq("user_id", userIdText)
    .eq("license_id", license_id)
    .eq("serial_id", serial_id)
    .gte("created_at", todayStart)
    .limit(1);

  if (error) throw error;
  return (data || []).length > 0;
}

async function run() {
  const todayStart = utcTodayStartISO();
  const todayStr = todayStart.slice(0, 10);
  const todayUTC = new Date(todayStart);

  // Load serials with license info INCLUDING project_assign
  const { data: serials, error } = await supabase
    .from("license_serials")
    .select("id, license_id, serial_or_contract, end_date, notify_before_days, licenses!inner(item_description, project_assign)")
    .not("end_date", "is", null);

  if (error) throw error;

  for (const serial of serials || []) {
    const projectAssign = serial.licenses.project_assign;
    if (!projectAssign) continue;

    const endDate = new Date(serial.end_date);
    const isExpired = endDate < todayUTC;

    const notifyDays = serial.notify_before_days ?? 30;
    const notifyDate = new Date(endDate.getTime() - notifyDays * 24 * 60 * 60 * 1000);
    const isExpiringSoon = todayUTC >= notifyDate && todayUTC <= endDate;

    if (!isExpired && !isExpiringSoon) continue;

    // Find users assigned to this project
    const { data: assigns, error: assignsError } = await supabase
      .from("user_project_assigns")
      .select("user_id")
      .eq("project_assign", projectAssign);

    if (assignsError) throw assignsError;

    const targetUserIds = (assigns || []).map(a => a.user_id);
    if (targetUserIds.length === 0) continue;

    const daysDiff = Math.ceil((endDate.getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24));
    const title = isExpired ? "Serial License Expired" : "Serial License Expiring Soon";
    const message = isExpired
      ? `${serial.serial_or_contract} for ${serial.licenses.item_description} expired ${Math.abs(daysDiff)} day(s) ago`
      : `${serial.serial_or_contract} for ${serial.licenses.item_description} expires in ${daysDiff} day(s)`;

    for (const userId of targetUserIds) {
      const userIdText = String(userId);
      const exists = await notificationExistsToday({
        user_id: userIdText,
        license_id: serial.license_id,
        serial_id: serial.id,
      });

      if (exists) continue;

      const { error: insertError } = await supabase.from("notifications").insert({
        type: "expiry",
        title,
        message,
        license_id: serial.license_id,
        serial_id: serial.id,
        user_id: userIdText,
        is_read: false,
        priority: isExpired || daysDiff <= 7 ? "high" : "medium",
        action_required: true,
        action_url: `/licenses/${serial.license_id}?serial=${serial.id}`,
        expires_at: null,
      });

      if (insertError) throw insertError;
    }
  }

  console.log(`Daily expiry notifications completed: ${todayStr}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});