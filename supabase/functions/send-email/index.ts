// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, html, from } = await req.json();
    
    console.log("Email request received:", { to, subject, from });

    // Resend API configuration
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    console.log("API Key exists:", !!RESEND_API_KEY);

    if (!RESEND_API_KEY) {
      throw new Error("Resend API key not configured");
    }

    // Send email via Resend API
    const emailBody = {
      from: from || "onboarding@resend.dev",
      to: [to],
      subject: subject,
      html: html,
    };
    
    console.log("Sending email:", emailBody);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailBody),
    });

    console.log("Response status:", response.status);
    console.log("Response ok:", response.ok);

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend error:", error);
      throw new Error(`Resend error: ${error}`);
    }

    const data = await response.json();
    console.log("Email sent successfully:", data);
    
    return new Response(
      JSON.stringify({ success: true, data }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});