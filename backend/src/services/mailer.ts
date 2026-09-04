/**
 * Mailer service.
 *
 * Sends the email-verification messages for new accounts.
 *
 * Two modes:
 *  - SMTP mode  — when SMTP_HOST + SMTP_USER + SMTP_PASS are configured in .env.
 *                 Real emails are delivered via nodemailer.
 *  - DEV mode   — default. When SMTP is not configured, the email body is logged
 *                 to the server console and the verification code is returned to
 *                 the caller so the whole flow can be tested without credentials.
 */

import nodemailer, { Transporter } from 'nodemailer';

export interface SendResult {
  /** true when a real SMTP message was delivered; false in dev mode. */
  delivered: boolean;
  mode: 'smtp' | 'dev';
  messageId?: string;
}

let transporter: Transporter | null = null;

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter(): Transporter | null {
  if (!smtpConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST as string,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER as string,
        pass: process.env.SMTP_PASS as string,
      },
    });
  }
  return transporter;
}

const FROM = process.env.MAIL_FROM || 'Smart Geo-Planner <no-reply@smartgeoplanner.app>';

const APP_NAME = 'Smart Geo-Planner';

/**
 * Sends the verification email containing a one-click "Verify my email" link.
 * Throws if SMTP delivery fails (so the route can fail loudly in SMTP mode).
 */
export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<SendResult> {
  const subject = `${APP_NAME} — verify your email address`;
  const text = [
    `Hello,`,
    ``,
    `You recently registered a ${APP_NAME} account with this email address.`,
    `Open the link below to confirm it is really you and activate your account.`,
    ``,
    `Verify link: ${verifyUrl}`,
    ``,
    `This link expires in 24 hours.`,
    `If you did not create an account, you can safely ignore this email.`,
    ``,
    `— ${APP_NAME}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0F0E1A;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#1C1A2E;border-radius:16px;padding:32px;border:1px solid #2E2C45;">
        <tr><td style="font-size:40px;line-height:1;text-align:center;padding-bottom:16px;">🗺️</td></tr>
        <tr><td align="center" style="color:#FFFFFF;font-size:24px;font-weight:bold;padding-bottom:8px;">Verify your email</td></tr>
        <tr><td align="center" style="color:#B0AECF;font-size:14px;line-height:20px;padding-bottom:24px;">
          You just created a ${APP_NAME} account with this email.<br/>
          Tap the button below to confirm the address is really yours.
        </td></tr>
        <tr><td align="center" style="padding-bottom:24px;">
          <a href="${verifyUrl}" style="display:inline-block;background:#6C63FF;color:#FFFFFF;text-decoration:none;font-size:16px;font-weight:bold;padding:14px 32px;border-radius:10px;">Verify my email</a>
        </td></tr>
        <tr><td align="center" style="color:#6B6987;font-size:12px;line-height:18px;padding-bottom:8px;word-break:break-all;">
          Or paste this link into your browser:<br/>
          <a href="${verifyUrl}" style="color:#A89CFF;">${verifyUrl}</a>
        </td></tr>
        <tr><td style="color:#6B6987;font-size:12px;line-height:18px;text-align:center;">
          This link expires in 24 hours. If you did not create an account, ignore this email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const activeTransporter = getTransporter();
  if (activeTransporter) {
    try {
      const info = await activeTransporter.sendMail({ from: FROM, to, subject, text, html });
      console.log(`[mailer] Verification email sent to ${to} (${info.messageId})`);
      return { delivered: true, mode: 'smtp', messageId: info.messageId };
    } catch (error) {
      console.error('[mailer] SMTP send failed:', error);
      throw new Error('Failed to send the verification email. Please check the SMTP configuration.');
    }
  }

  // Dev mode: never hit the network; log the link so it can be opened manually.
  console.log('\n======================================================');
  console.log(`[mailer:dev] Verification link email (NOT actually sent)`);
  console.log(`  To:   ${to}`);
  console.log(`  Link: ${verifyUrl}`);
  console.log('======================================================\n');
  return { delivered: false, mode: 'dev' };
}