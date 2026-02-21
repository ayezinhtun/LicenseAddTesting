Deno.serve(async (req) => {
  // Handle CORS preflight requests
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
    "Access-Control-Max-Age": "86400",
  };

  // Handle OPTIONS requests
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  try {
    const { to, subject, html } = await req.json();
    console.log("📧 Sending email to:", to);

    // Get SMTP settings from environment
    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPass = Deno.env.get("SMTP_PASS");

    if (!smtpUser || !smtpPass) {
      throw new Error("SMTP credentials not configured");
    }

    // Create SMTP connection using Deno's native TCP
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const conn = await Deno.connect({
      hostname: smtpHost,
      port: smtpPort,
    });

    // Read initial server response
    const welcomeData = await conn.read(new Uint8Array(1024));
    if (welcomeData) {
      const welcome = decoder.decode(welcomeData);
      console.log("SMTP Welcome:", welcome);
    }

    // Send EHLO
    await conn.write(encoder.encode(`EHLO ${smtpHost}\r\n`));
    const ehloData = await conn.read(new Uint8Array(1024));
    if (ehloData) {
      let response = decoder.decode(ehloData);
      console.log("EHLO Response:", response);
    }

    // Start TLS
    await conn.write(encoder.encode("STARTTLS\r\n"));
    const tlsData = await conn.read(new Uint8Array(1024));
    if (tlsData) {
      const response = decoder.decode(tlsData);
      console.log("STARTTLS Response:", response);
    }

    // Upgrade to TLS connection
    const tlsConn = await Deno.startTls(conn, { hostname: smtpHost });

    // Send EHLO again over TLS
    await tlsConn.write(encoder.encode(`EHLO ${smtpHost}\r\n`));
    const tlsEhloData = await tlsConn.read(new Uint8Array(1024));
    if (tlsEhloData) {
      const response = decoder.decode(tlsEhloData);
      console.log("TLS EHLO Response:", response);
    }

    // Authenticate
    const authString = btoa(`\0${smtpUser}\0${smtpPass}`);
    await tlsConn.write(encoder.encode(`AUTH PLAIN ${authString}\r\n`));
    const authData = await tlsConn.read(new Uint8Array(1024));
    if (authData) {
      const response = decoder.decode(authData);
      console.log("Auth Response:", response);
    }

    // Send email
    await tlsConn.write(encoder.encode(`MAIL FROM:<${smtpUser}>\r\n`));
    await tlsConn.read(new Uint8Array(1024));
    
    await tlsConn.write(encoder.encode(`RCPT TO:<${to}>\r\n`));
    await tlsConn.read(new Uint8Array(1024));
    
    await tlsConn.write(encoder.encode("DATA\r\n"));
    await tlsConn.read(new Uint8Array(1024));

    // Email headers and body
    const emailData = [
      `From: ${smtpUser}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: text/html; charset=UTF-8`,
      "",
      html,
      ".\r\n",
    ].join("\r\n");

    await tlsConn.write(encoder.encode(emailData));
    const emailResponseData = await tlsConn.read(new Uint8Array(1024));
    if (emailResponseData) {
      const response = decoder.decode(emailResponseData);
      console.log("Email Response:", response);
    }

    // Close connection
    await tlsConn.write(encoder.encode("QUIT\r\n"));
    tlsConn.close();

    console.log("✅ Email sent successfully to:", to);
    return new Response(JSON.stringify({ message: "Email sent successfully" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});