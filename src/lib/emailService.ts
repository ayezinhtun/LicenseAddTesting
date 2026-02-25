import { supabase } from "./supabase";



interface EmailNotification {

  to: string;

  subject: string;

  html: string;

  type: "expiry" | "renewal" | "comment" | "system" | "warning" | "info";

}



export class EmailService {

  private static instance: EmailService;



  static getInstance(): EmailService {

    if (!EmailService.instance) {

      EmailService.instance = new EmailService();

    }

    return EmailService.instance;

  }



  async sendNotificationEmail(notification: EmailNotification): Promise<void> {

    try {

      const { data, error } = await supabase.functions.invoke("send-email-notification", {

        body: {

          to: notification.to,

          subject: notification.subject,

          html: notification.html,

        },

      });



      if (error) throw error;

      console.log("Email sent successfully:", data);

    } catch (error) {

      console.error("Email sending failed:", error);

    }

  }



  async sendLicenseExpiryAlert(

    license: any,

    daysUntilExpiry: number,

  ): Promise<void> {

    const urgencyLevel =

      daysUntilExpiry <= 7

        ? "URGENT"

        : daysUntilExpiry <= 30

          ? "IMPORTANT"

          : "NOTICE";

    const urgencyColor =

      daysUntilExpiry <= 7

        ? "#dc3545"

        : daysUntilExpiry <= 30

          ? "#fd7e14"

          : "#ffc107";



    const subject = `${urgencyLevel}: ${license.item} License Expires in ${daysUntilExpiry} Days`;

    const html = `

      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">

        <!-- Header -->

        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">

          <img src="https://1cloudtechnology.com/assets/onecloudlogo.png" alt="1Cloud Technology" style="height: 50px; margin-bottom: 15px;">

          <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">License Expiry Alert</h1>

          <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Immediate Action Required</p>

        </div>

        

        <!-- Urgency Banner -->

        <div style="background: ${urgencyColor}; color: white; padding: 15px 20px; text-align: center; font-weight: 600; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">

          ${urgencyLevel} - ${daysUntilExpiry} Days Remaining

        </div>

        

        <!-- Content -->

        <div style="padding: 30px 20px; background: white; margin: 0 20px;">

          <h2 style="color: #dc3545; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">

            ⚠️ License Expiring Soon

          </h2>

          <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">

            The following license requires immediate attention and renewal to avoid service interruption:

          </p>

          

          <!-- License Details Card -->

          <div style="background: #fff3cd; border: 2px solid ${urgencyColor}; padding: 25px; border-radius: 12px; margin: 25px 0;">

            <h3 style="margin: 0 0 15px 0; color: #856404; font-size: 20px; font-weight: 600;">${license.item}</h3>

            <div style="display: grid; gap: 10px;">

              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ffeaa7;">

                <strong style="color: #856404;">Vendor:</strong>

                <span style="color: #856404;">${license.vendor}</span>

              </div>

              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ffeaa7;">

                <strong style="color: #856404;">Project:</strong>

                <span style="color: #856404;">${license.project_name}</span>

              </div>

              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ffeaa7;">

                <strong style="color: #856404;">Customer:</strong>

                <span style="color: #856404;">${license.customer_name}</span>

              </div>

              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ffeaa7;">

                <strong style="color: #856404;">Expiry Date:</strong>

                <span style="color: #dc3545; font-weight: 600;">${new Date(

      license.license_end_date,

    ).toLocaleDateString("en-US", {

      weekday: "long",

      year: "numeric",

      month: "long",

      day: "numeric",

    })}</span>

              </div>

              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ffeaa7;">

                <strong style="color: #856404;">License Cost:</strong>

                <span style="color: #856404; font-weight: 600;">$${license.license_cost.toLocaleString()}</span>

              </div>

              <div style="display: flex; justify-content: space-between; padding: 8px 0;">

                <strong style="color: #856404;">Serial Number:</strong>

                <span style="color: #856404; font-family: monospace;">${license.serial_number}</span>

              </div>

            </div>

          </div>

          

          <!-- Action Required -->

          <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 8px; margin: 25px 0;">

            <h4 style="margin: 0 0 10px 0; color: #721c24; font-size: 16px; font-weight: 600;">📋 Action Required:</h4>

            <ul style="margin: 0; padding-left: 20px; color: #721c24;">

              <li>Contact the vendor for renewal options</li>

              <li>Review and approve renewal budget</li>

              <li>Update license information in the system</li>

              <li>Notify relevant team members</li>

            </ul>

          </div>

          

          <!-- Action Buttons -->

          <div style="text-align: center; margin: 30px 0;">

            <a href="${window.location.origin}/licenses/${license.id}" 

               style="background: ${urgencyColor}; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; margin: 0 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">

              View License Details

            </a>

            <a href="${window.location.origin}/licenses" 

               style="background: #6c757d; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; margin: 0 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">

              Manage All Licenses

            </a>

          </div>

        </div>

        

        <!-- Footer -->

        <div style="background: #343a40; color: white; padding: 25px 20px; text-align: center; margin: 0 20px;">

          <p style="margin: 0 0 10px 0; font-size: 14px; color: #adb5bd;">

            This is an automated license expiry alert from 1Cloud Technology License Management System.

          </p>

          <p style="margin: 0; font-size: 12px; color: #6c757d;">

            © ${new Date().getFullYear()} 1Cloud Technology. All rights reserved.

          </p>

        </div>

        

        <!-- Bottom Spacing -->

        <div style="height: 20px;"></div>

      </div>

    `;



    await this.sendNotificationEmail({

      to: license.user_name,

      subject,

      html,

      type: "expiry",

    });

  }



  async sendRenewalConfirmation(

    license: any,

    renewalDetails: any,

  ): Promise<void> {

    const subject = `✅ License Renewed Successfully: ${license.item}`;

    const html = `

      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">

        <!-- Header -->

        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px 20px; text-align: center;">

          <img src="https://1cloudtechnology.com/assets/onecloudlogo.png" alt="1Cloud Technology" style="height: 50px; margin-bottom: 15px;">

          <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">License Renewal Confirmation</h1>

          <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Successfully Renewed</p>

        </div>

        

        <!-- Success Banner -->

        <div style="background: #d4edda; color: #155724; padding: 15px 20px; text-align: center; font-weight: 600; font-size: 16px; border: 1px solid #c3e6cb;">

          ✅ RENEWAL COMPLETED SUCCESSFULLY

        </div>

        

        <!-- Content -->

        <div style="padding: 30px 20px; background: white; margin: 0 20px;">

          <h2 style="color: #28a745; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">

            🎉 License Renewed Successfully

          </h2>

          <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">

            Your license has been successfully renewed with the following details:

          </p>

          

          <!-- License Details Card -->

          <div style="background: #d4edda; border: 2px solid #28a745; padding: 25px; border-radius: 12px; margin: 25px 0;">

            <h3 style="margin: 0 0 15px 0; color: #155724; font-size: 20px; font-weight: 600;">${license.item}</h3>

            <div style="display: grid; gap: 10px;">

              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #c3e6cb;">

                <strong style="color: #155724;">Previous Expiry:</strong>

                <span style="color: #155724;">${new Date(renewalDetails.previous_end_date).toLocaleDateString()}</span>

              </div>

              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #c3e6cb;">

                <strong style="color: #155724;">New Expiry:</strong>

                <span style="color: #155724; font-weight: 600;">${new Date(renewalDetails.new_end_date).toLocaleDateString()}</span>

              </div>

              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #c3e6cb;">

                <strong style="color: #155724;">Renewal Cost:</strong>

                <span style="color: #155724; font-weight: 600;">$${renewalDetails.cost.toLocaleString()}</span>

              </div>

              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #c3e6cb;">

                <strong style="color: #155724;">Renewed By:</strong>

                <span style="color: #155724;">${renewalDetails.renewed_by}</span>

              </div>

              <div style="display: flex; justify-content: space-between; padding: 8px 0;">

                <strong style="color: #155724;">Renewal Date:</strong>

                <span style="color: #155724;">${new Date(renewalDetails.renewal_date).toLocaleDateString()}</span>

              </div>

            </div>

            

            ${renewalDetails.notes

        ? `

              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #c3e6cb;">

                <strong style="color: #155724;">Notes:</strong>

                <p style="margin: 5px 0 0 0; color: #155724;">${renewalDetails.notes}</p>

              </div>

            `

        : ""

      }

          </div>

          

          <!-- Next Steps -->

          <div style="background: #cce7ff; border: 1px solid #99d6ff; padding: 20px; border-radius: 8px; margin: 25px 0;">

            <h4 style="margin: 0 0 10px 0; color: #004085; font-size: 16px; font-weight: 600;">📅 What's Next:</h4>

            <ul style="margin: 0; padding-left: 20px; color: #004085;">

              <li>License is now active until ${new Date(renewalDetails.new_end_date).toLocaleDateString()}</li>

              <li>Updated license information is available in the system</li>

              <li>Renewal history has been recorded for audit purposes</li>

              <li>Calendar reminders will be set for the next renewal period</li>

            </ul>

          </div>

          

          <!-- Action Button -->

          <div style="text-align: center; margin: 30px 0;">

            <a href="${window.location.origin}/licenses/${license.id}" 

               style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">

              View Updated License

            </a>

          </div>

        </div>

        

        <!-- Footer -->

        <div style="background: #343a40; color: white; padding: 25px 20px; text-align: center; margin: 0 20px;">

          <p style="margin: 0 0 10px 0; font-size: 14px; color: #adb5bd;">

            This is an automated renewal confirmation from 1Cloud Technology License Management System.

          </p>

          <p style="margin: 0; font-size: 12px; color: #6c757d;">

            © ${new Date().getFullYear()} 1Cloud Technology. All rights reserved.

          </p>

        </div>

        

        <!-- Bottom Spacing -->

        <div style="height: 20px;"></div>

      </div>

    `;



    await this.sendNotificationEmail({

      to: license.user_name,

      subject,

      html,

      type: "renewal",

    });

  }



  async sendCommentNotification(

    license: any,

    comment: any,

    mentionedUsers: string[] = [],

  ): Promise<void> {

    const subject = `💬 New Comment on ${license.item} License`;

    const html = `

      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa;">

        <!-- Header -->

        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">

          <img src="https://1cloudtechnology.com/assets/onecloudlogo.png" alt="1Cloud Technology" style="height: 50px; margin-bottom: 15px;">

          <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">New Comment Notification</h1>

          <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">License Discussion Update</p>

        </div>

        

        <!-- Content -->

        <div style="padding: 30px 20px; background: white; margin: 0 20px;">

          <h2 style="color: #6f42c1; margin: 0 0 20px 0; font-size: 22px; font-weight: 600;">

            💬 New Comment Added

          </h2>

          <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">

            ${comment.author_name} has added a new comment to the ${license.item} license:

          </p>

          

          <!-- Comment Card -->

          <div style="background: #f8f9fa; border-left: 4px solid #6f42c1; padding: 20px; border-radius: 8px; margin: 25px 0;">

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">

              <strong style="color: #6f42c1; font-size: 16px;">${comment.author_name}</strong>

              <span style="color: #6c757d; font-size: 12px;">${new Date(comment.created_at).toLocaleString()}</span>

            </div>

            <p style="color: #333; margin: 0; font-size: 15px; line-height: 1.6;">

              ${comment.content}

            </p>

          </div>

          

          <!-- License Info -->

          <div style="background: #e9ecef; padding: 15px; border-radius: 8px; margin: 25px 0;">

            <h4 style="margin: 0 0 10px 0; color: #495057; font-size: 14px; font-weight: 600;">License Details:</h4>

            <p style="margin: 0; color: #495057; font-size: 14px;">

              <strong>${license.item}</strong> by ${license.vendor} • Project: ${license.project_name}

            </p>

          </div>

          

          <!-- Action Button -->

          <div style="text-align: center; margin: 30px 0;">

            <a href="${window.location.origin}/licenses/${license.id}" 

               style="background: #6f42c1; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">

              View License & Reply

            </a>

          </div>

        </div>

        

        <!-- Footer -->

        <div style="background: #343a40; color: white; padding: 25px 20px; text-align: center; margin: 0 20px;">

          <p style="margin: 0 0 10px 0; font-size: 14px; color: #adb5bd;">

            This is an automated comment notification from 1Cloud Technology License Management System.

          </p>

          <p style="margin: 0; font-size: 12px; color: #6c757d;">

            © ${new Date().getFullYear()} 1Cloud Technology. All rights reserved.

          </p>

        </div>

        

        <!-- Bottom Spacing -->

        <div style="height: 20px;"></div>

      </div>

    `;



    // Send to license owner

    await this.sendNotificationEmail({

      to: license.user_name,

      subject,

      html,

      type: "comment",

    });



    // Send to mentioned users

    for (const userEmail of mentionedUsers) {

      if (userEmail !== license.user_name) {

        await this.sendNotificationEmail({

          to: userEmail,

          subject: `💬 You were mentioned in a comment on ${license.item} License`,

          html,

          type: "comment",

        });

      }

    }

  }

}

