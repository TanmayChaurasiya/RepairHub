import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env.js';

interface SendPasswordResetParams {
  toEmail: string;
  name: string;
  resetToken: string;
}

export class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  /**
   * Checks whether Brevo API is configured and active
   */
  public isBrevoActive(): boolean {
    return Boolean(
      env.BREVO_API_KEY &&
      env.BREVO_API_KEY.trim() !== '' &&
      env.BREVO_API_KEY !== 'paste_your_copied_key'
    );
  }

  private initTransporter() {
    // If Brevo is active, Nodemailer SMTP is secondary
    if (this.isBrevoActive()) {
      return;
    }

    if (env.SMTP_USER && env.SMTP_PASS) {
      const cleanUser = env.SMTP_USER.trim();
      const cleanPass = env.SMTP_PASS.replace(/\s+/g, '');

      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST || 'smtp.gmail.com',
        port: env.SMTP_PORT || 587,
        secure: env.SMTP_PORT === 465, // false for 587 (enables STARTTLS)
        requireTLS: true,
        auth: {
          user: cleanUser,
          pass: cleanPass,
        },
        tls: {
          rejectUnauthorized: true,
        },
      });
    } else {
      this.transporter = null;
    }
  }

  /**
   * Verifies the active email provider connection (Brevo REST API or Gmail SMTP)
   */
  async verifyConnection(): Promise<{ success: boolean; error?: string }> {
    if (this.isBrevoActive()) {
      try {
        const res = await fetch('https://api.brevo.com/v3/smtp/templates', {
          method: 'GET',
          headers: {
            'api-key': env.BREVO_API_KEY!,
            'Accept': 'application/json',
          },
        });

        if (res.ok) {
          console.log(
            `✅ [EMAIL SERVICE: BREVO] API connection verified successfully (Sender: ${env.BREVO_SENDER_EMAIL || env.SMTP_USER})`
          );
          return { success: true };
        } else {
          const errData = (await res.json().catch(() => ({}))) as any;
          const msg = errData.message || `Brevo returned HTTP ${res.status}`;
          console.error(`❌ [EMAIL SERVICE: BREVO] API verification failed: ${msg}`);
          return { success: false, error: msg };
        }
      } catch (err: any) {
        console.error(`❌ [EMAIL SERVICE: BREVO] Connection error:`, err?.message);
        return { success: false, error: err?.message };
      }
    }

    if (!this.transporter) {
      const msg = 'No Email provider initialized (neither Brevo API key nor SMTP credentials configured).';
      if (env.NODE_ENV === 'production') {
        throw new Error(msg);
      }
      console.log('ℹ️  [EMAIL SERVICE] Running in development mode without email credentials. Emails will log to console.');
      return { success: false, error: msg };
    }

    try {
      await this.transporter.verify();
      console.log(
        `✅ [EMAIL SERVICE: GMAIL SMTP] Connection verified successfully (${env.SMTP_HOST || 'smtp.gmail.com'}:${env.SMTP_PORT || 587} with STARTTLS)`
      );
      return { success: true };
    } catch (err: any) {
      const sanitizedError = err?.message || 'SMTP connection verification failed';
      console.error(`❌ [EMAIL SERVICE: GMAIL SMTP] Verification failed: ${sanitizedError}`);
      return { success: false, error: sanitizedError };
    }
  }

  /**
   * Dispatches email via Brevo REST API (https://api.brevo.com/v3/smtp/email)
   */
  private async sendViaBrevo({
    toEmail,
    toName,
    subject,
    htmlContent,
    textContent,
  }: {
    toEmail: string;
    toName?: string;
    subject: string;
    htmlContent: string;
    textContent: string;
  }): Promise<void> {
    const senderEmail = env.BREVO_SENDER_EMAIL || env.SMTP_USER || 'no-reply@repairhub.in';
    const senderName = env.BREVO_SENDER_NAME || 'RepairHub';

    // Brevo requires valid, non-empty textContent or omits it if absent
    let cleanText = (textContent || '').trim();
    if (!cleanText && htmlContent) {
      cleanText = htmlContent.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    }
    if (!cleanText) {
      cleanText = subject;
    }

    const payload: Record<string, any> = {
      sender: {
        name: senderName,
        email: senderEmail,
      },
      to: [
        {
          email: toEmail,
          name: toName || 'User',
        },
      ],
      subject,
      htmlContent,
      textContent: cleanText,
    };

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = (await res.json().catch(() => ({}))) as any;
      const errorMsg = errJson.message || `Brevo returned HTTP ${res.status}`;
      console.error(`❌ [EMAIL SERVICE: BREVO] Failed sending to ${toEmail}: ${errorMsg}`);
      throw new Error(`Brevo delivery failed: ${errorMsg}`);
    }

    const data = (await res.json()) as any;
    console.log(`✅ [EMAIL SERVICE: BREVO] Email delivered to ${toEmail}. MessageId: ${data.messageId}`);
  }

  /**
   * Sends the password reset link to the recipient
   */
  async sendPasswordResetEmail({ toEmail, name, resetToken }: SendPasswordResetParams): Promise<void> {
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your RepairHub Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070e1b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #070e1b; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #0b1729; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);" cellspacing="0" cellpadding="0">
          <!-- Header -->
          <tr>
            <td style="padding: 36px 40px 24px 40px; text-align: center; border-bottom: 1px solid #1e293b; background: linear-gradient(180deg, #0f213e 0%, #0b1729 100%);">
              <div style="display: inline-block; width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #ff8a3d 0%, #f59e0b 100%); text-align: center; line-height: 48px; font-size: 24px; color: #ffffff; margin-bottom: 12px; box-shadow: 0 8px 16px rgba(255,138,61,0.3);">
                🛠️
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                Repair<span style="color: #ff8a3d;">Hub</span>
              </h1>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8; font-weight: 500;">
                Automotive Service Management Platform
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 40px;">
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #ffffff;">
                Reset Your Password
              </h2>
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 22px; color: #cbd5e1;">
                Hello <strong>${name || 'Valued User'}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #94a3b8;">
                We received a request to reset the password for your RepairHub account. Click the secure button below to choose a new password:
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #ff8a3d 0%, #e06d20 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 36px; border-radius: 12px; box-shadow: 0 8px 20px rgba(255,138,61,0.35); text-transform: uppercase; letter-spacing: 0.5px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry Note -->
              <div style="background-color: #0f213e; border: 1px solid #1e3a63; border-radius: 12px; padding: 14px 18px; margin: 24px 0;">
                <p style="margin: 0; font-size: 12px; line-height: 18px; color: #38bdf8;">
                  ⏱️ <strong>Note:</strong> This link is valid for <strong>30 minutes</strong> and can only be used once.
                </p>
              </div>

              <!-- Fallback Link -->
              <p style="margin: 20px 0 8px 0; font-size: 12px; color: #64748b; line-height: 18px;">
                If the button above doesn't work, copy and paste this link into your web browser:
              </p>
              <p style="margin: 0; font-size: 11px; word-break: break-all; color: #22c7db;">
                <a href="${resetUrl}" style="color: #22c7db; text-decoration: underline;">${resetUrl}</a>
              </p>

              <hr style="border: none; border-top: 1px solid #1e293b; margin: 30px 0 20px 0;">

              <!-- Security Warning -->
              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #64748b;">
                🛡️ <strong>Didn't request this?</strong> If you did not make this request, you can safely ignore this email. Your password will remain unchanged and your account stays secure.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #070e1b; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #475569;">
                &copy; ${new Date().getFullYear()} RepairHub. All rights reserved. Kanpur Garage Network.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const textContent = `Hello ${name || 'User'},

We received a request to reset your RepairHub password.
Use the following link to reset your password (valid for 30 minutes):

${resetUrl}

If you did not request a password reset, you can safely ignore this email.

— RepairHub Team`;

    // 1. Try Brevo REST API if configured
    if (this.isBrevoActive()) {
      await this.sendViaBrevo({
        toEmail,
        toName: name,
        subject: 'Reset Your RepairHub Password',
        htmlContent,
        textContent,
      });
      return;
    }

    // 2. Fall back to Nodemailer SMTP
    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: env.EMAIL_FROM || env.SMTP_USER,
          to: toEmail,
          subject: 'Reset Your RepairHub Password',
          text: textContent,
          html: htmlContent,
        });
        console.log(`✅ [EMAIL SERVICE: GMAIL SMTP] Password reset email delivered to ${toEmail}. MessageId: ${info.messageId}`);
      } catch (err: any) {
        const sanitizedError = err?.message || 'Unknown delivery failure';
        console.error(`❌ [EMAIL SERVICE: GMAIL SMTP] Failed to send email to ${toEmail}: ${sanitizedError}`);
        throw new Error(`Failed to deliver password reset email: ${sanitizedError}`);
      }
      return;
    }

    // 3. Dev/Test mode fallback
    if (env.NODE_ENV === 'production') {
      throw new Error('No email provider is configured. Cannot deliver reset email in production.');
    }

    console.log('--------------------------------------------------');
    console.log('📧 [EMAIL DISPATCH - DEV/TEST MODE (No Email Credentials)]');
    console.log(`To: ${toEmail}`);
    console.log(`Subject: Reset Your RepairHub Password`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log('--------------------------------------------------');
  }

  /**
   * Generic email sender for invitations, approvals, and alerts
   */
  async sendGenericEmail({
    to,
    subject,
    text,
    html,
  }: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<void> {
    const htmlContent = html || text || '';
    const textContent = text || '';

    // 1. Try Brevo REST API if configured
    if (this.isBrevoActive()) {
      try {
        await this.sendViaBrevo({
          toEmail: to,
          subject,
          htmlContent,
          textContent,
        });
      } catch (err: any) {
        console.error(`❌ [EMAIL SERVICE: BREVO] Failed generic email to ${to}:`, err?.message);
      }
      return;
    }

    // 2. Fall back to Nodemailer SMTP
    if (this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: env.EMAIL_FROM || env.SMTP_USER,
          to,
          subject,
          text: textContent,
          html: htmlContent,
        });
        console.log(`✅ [EMAIL SERVICE: GMAIL SMTP] Email delivered to ${to} (${subject}). MessageId: ${info.messageId}`);
      } catch (err: any) {
        console.error(`❌ [EMAIL SERVICE: GMAIL SMTP] Failed to deliver email to ${to}:`, err?.message);
      }
      return;
    }

    // 3. Dev fallback
    console.log('--------------------------------------------------');
    console.log(`📧 [EMAIL DISPATCH - DEV/TEST MODE]`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log('--------------------------------------------------');
  }
}

export const emailService = new EmailService();
