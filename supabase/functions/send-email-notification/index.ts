import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

// CORS headers for browser requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }), 
        { 
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");

    if (!BREVO_API_KEY) {
      return new Response(
        JSON.stringify({ error: "BREVO_API_KEY not configured" }), 
        { 
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    console.log(`📧 Sending email to: ${to} with subject: ${subject}`);

    // Call Brevo SMTP API
    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          name: "One Cloud Technology",
          email: "tech@onecloud.com.mm",
        },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html,
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error("❌ Brevo API error:", data);
      return new Response(
        JSON.stringify({ 
          error: "Failed to send email via Brevo",
          details: data 
        }), 
        { 
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    console.log("✅ Email sent successfully via Brevo:", data);

    return new Response(
      JSON.stringify({ 
        message: "Email sent successfully", 
        data,
        to,
        subject
      }), 
      {
        status: 200,
        headers: corsHeaders,
      }
    );

  } catch (err) {
    console.error("❌ Error in email function:", err);
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