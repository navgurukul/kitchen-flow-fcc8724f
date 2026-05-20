
/// <reference path="../global.d.ts" />
// @ts-ignore: ESM import from URL
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Helper function to send email via SMTP
async function sendEmailViaSMTP(
  toEmail: string,
  studentName: string,
  assignmentDate: string,
  teamType: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const smtpHost = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    const fromEmail = Deno.env.get("SMTP_FROM_EMAIL");
    const fromName = Deno.env.get("SMTP_FROM_NAME") || "Kitchen Management";

    if (!smtpUser || !smtpPassword) {
      throw new Error("SMTP credentials not configured in environment variables");
    }

    // Import SMTP library for Deno
    // Using oak-smtp for email sending
    // @ts-ignore: ESM import from URL
    const { SMTPClient } = await import(
      // @ts-ignore: ESM import from URL
      "https://deno.land/x/smtp@v0.7.0/mod.ts"
    );

    const client = new SMTPClient({
      hostname: smtpHost,
      port: smtpPort,
      username: smtpUser,
      password: smtpPassword,
      tls: true,
    });

    // Format the date nicely
    const dateObj = new Date(assignmentDate);
    const formattedDate = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Create HTML email content
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 20px;
        }
        .container {
          background-color: white;
          border-radius: 12px;
          padding: 40px;
          max-width: 600px;
          margin: 0 auto;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #e91e63 0%, #ff5983 100%);
          color: white;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          margin-bottom: 30px;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          margin: 20px 0;
          line-height: 1.6;
          color: #333;
        }
        .highlight-box {
          background-color: #fff3cd;
          border-left: 4px solid #e91e63;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .info-grid {
          display: block;
          margin: 20px 0;
        }
        .info-item {
          margin: 15px 0;
          padding: 10px;
          background-color: #f9f9f9;
          border-radius: 4px;
        }
        .info-label {
          color: #666;
          font-size: 12px;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .info-value {
          color: #e91e63;
          font-size: 18px;
          font-weight: 600;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          color: #999;
          font-size: 12px;
        }
        .team-badge {
          display: inline-block;
          padding: 8px 16px;
          background-color: ${teamType === "tomorrow" ? "#e3f2fd" : "#f3e5f5"};
          color: ${teamType === "tomorrow" ? "#1976d2" : "#7b1fa2"};
          border-radius: 20px;
          font-weight: 600;
          margin: 10px 0;
        }
        .tomorrow-alert {
          background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
          color: white;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          margin: 20px 0;
          font-size: 24px;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🍳 ${teamType === "tomorrow" ? "TOMORROW YOU HAVE KITCHEN TURN!" : "Kitchen Duty Assignment"}</h1>
        </div>
        
        ${teamType === "tomorrow" ? `<div class="tomorrow-alert">📅 TOMORROW - ${formattedDate}</div>` : ""}
        
        <div class="content">
          <p>Hello <strong>${studentName}</strong>,</p>
          
          <p>${teamType === "tomorrow" ? "🚨 <strong>Important!</strong> You have been assigned for <strong>tomorrow's kitchen duty!</strong>" : "Great news! You have been assigned a <strong>kitchen duty</strong>."} Here are the details:</p>
          
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Team Assignment</div>
              <div class="team-badge">${teamType === "tomorrow" ? "TOMORROW'S TEAM" : "TODAY'S TEAM"}</div>
            </div>
            
            <div class="info-item">
              <div class="info-label">Date</div>
              <div class="info-value">${formattedDate}</div>
            </div>
          </div>
          
          <div class="highlight-box">
            <strong>⏰ Reminder:</strong> Please ensure you are available for your kitchen duty on the assigned date. If you cannot make it, please submit a skip request through the Kitchen Flow app.
          </div>
          
          <p><strong>What you need to do:</strong></p>
          <ul>
            <li>Check the Kitchen Flow dashboard for more details</li>
            <li>Confirm your availability</li>
            <li>If you cannot attend, submit a skip request ASAP</li>
            <li>Coordinate with your team members</li>
          </ul>
          
          <p><strong>Questions?</strong> Contact your coordinator or check the Kitchen Flow app for more information.</p>
          
          <p>Best regards,<br><strong>Kitchen Management System</strong></p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from Kitchen Flow. Please do not reply to this email.</p>
          <p>© 2026 NavGurukul Kitchen Management. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    `;

    // Create plain text version
    const textContent = `
${teamType === "tomorrow" ? "🚨 TOMORROW YOU HAVE KITCHEN TURN! 🚨" : "Kitchen Duty Assignment"}

Hello ${studentName},

${teamType === "tomorrow" ? "IMPORTANT! You have been assigned for TOMORROW's kitchen duty!" : "Great news! You have been assigned a kitchen duty."} Here are the details:

Team Assignment: ${teamType === "tomorrow" ? "TOMORROW'S TEAM" : "TODAY'S TEAM"}
Date: ${formattedDate}

${teamType === "tomorrow" ? "⏰ ACTION REQUIRED: You have kitchen duty TOMORROW! Please be available." : "REMINDER: Please ensure you are available for your kitchen duty on the assigned date."} If you cannot make it, please submit a skip request through the Kitchen Flow app.

What you need to do:
- Check the Kitchen Flow dashboard for more details
- Confirm your availability
- If you cannot attend, submit a skip request ASAP
- Coordinate with your team members

Questions? Contact your coordinator or check the Kitchen Flow app for more information.

Best regards,
Kitchen Management System

---
This is an automated notification from Kitchen Flow. Please do not reply to this email.
© 2026 NavGurukul Kitchen Management. All rights reserved.
    `;

    // Send email
    await client.send({
      from: `${fromName} <${fromEmail}>`,
      to: toEmail,
      subject: `${teamType === "tomorrow" ? "🚨 IMPORTANT: Tomorrow You Have Kitchen Turn!" : "🍳 Kitchen Duty Assignment"} - ${formattedDate}`,
      content: textContent,
      html: htmlContent,
    });

    await client.close();

    console.log(`✅ Email sent successfully to ${toEmail}`);
    return { success: true };
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      profile_ids,
      assignment_date,
      team_type,
    }: {
      profile_ids: string[];
      assignment_date: string;
      team_type: "today" | "tomorrow";
    } = await req.json();

    console.log(
      `📧 Starting email notifications for ${profile_ids.length} students`
    );
    console.log(`Date: ${assignment_date}, Team: ${team_type}`);

    const results = [];

    // Fetch student details
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", profile_ids);

    if (profileError) {
      throw new Error(`Failed to fetch profiles: ${profileError.message}`);
    }

    if (!profiles || profiles.length === 0) {
      throw new Error("No profiles found for the given IDs");
    }

    // Send email to each student
    for (const profile of profiles) {
      try {
        console.log(`📧 Sending email to ${profile.full_name} (${profile.email})`);

        // Send the email
        const emailResult = await sendEmailViaSMTP(
          profile.email,
          profile.full_name,
          assignment_date,
          team_type
        );

        // Log in database
        const { error: logError } = await supabase
          .from("email_notifications")
          .insert({
            profile_id: profile.id,
            student_name: profile.full_name,
            student_email: profile.email,
            assignment_date,
            team_type,
            status: emailResult.success ? "sent" : "failed",
            error_message: emailResult.error || null,
            sent_at: emailResult.success ? new Date().toISOString() : null,
          });

        if (logError) {
          console.error(`Failed to log email notification: ${logError.message}`);
        }

        results.push({
          email: profile.email,
          name: profile.full_name,
          success: emailResult.success,
          error: emailResult.error,
        });
      } catch (error) {
        console.error(`❌ Error processing ${profile.email}:`, error);
        results.push({
          email: profile.email,
          name: profile.full_name,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // Summary
    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.log(
      `📊 Email Notification Summary: ${successCount} sent, ${failureCount} failed`
    );

    return new Response(
      JSON.stringify({
        success: failureCount === 0,
        message: `Notifications sent to ${successCount}/${results.length} students`,
        results,
        summary: {
          total: results.length,
          sent: successCount,
          failed: failureCount,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ Function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
