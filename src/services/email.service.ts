/**
 * Email Service
 * Handles sending emails using Nodemailer
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Email configuration from environment variables
const EMAIL_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT = parseInt(process.env.EMAIL_PORT || '587');
const EMAIL_SECURE = process.env.EMAIL_SECURE === 'true';
const EMAIL_USER = process.env.EMAIL_USER || '';
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'DuxFit CRM <noreply@duxfit.com>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8080';

// Create reusable transporter
let transporter: Transporter | null = null;

/**
 * Initialize email transporter
 */
function getTransporter(): Transporter {
  if (!transporter) {
    // For development: Use ethereal.email for testing (if no credentials provided)
    if (!EMAIL_USER || !EMAIL_PASSWORD) {
      console.warn('⚠️  No email credentials configured. Email sending is disabled.');
      console.warn('   Set EMAIL_USER and EMAIL_PASSWORD in .env to enable email.');
    }

    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_SECURE,
      auth: EMAIL_USER && EMAIL_PASSWORD ? {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD
      } : undefined,
    });
  }
  return transporter;
}

/**
 * Send password reset email
 * 
 * @param to - Recipient email address
 * @param name - Recipient name
 * @param resetToken - Password reset token
 */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetToken: string
): Promise<boolean> {
  try {
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const htmlContent = getPasswordResetEmailTemplate(name, resetUrl);
    const textContent = getPasswordResetEmailText(name, resetUrl);

    // If no email credentials, log the reset link for development
    if (!EMAIL_USER || !EMAIL_PASSWORD) {
      console.log('\n📧 ===== PASSWORD RESET EMAIL (Development Mode) =====');
      console.log(`To: ${to}`);
      console.log(`Subject: Reset Your DuxFit Password`);
      console.log(`Reset URL: ${resetUrl}`);
      console.log('========================================\n');
      return true; // Return success in development mode
    }

    const mailOptions = {
      from: EMAIL_FROM,
      to: to,
      subject: 'Reset Your DuxFit Password',
      text: textContent,
      html: htmlContent
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${to}: ${info.messageId}`);
    return true;

  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    return false;
  }
}

/**
 * Send password reset confirmation email
 * 
 * @param to - Recipient email address
 * @param name - Recipient name
 */
export async function sendPasswordResetConfirmationEmail(
  to: string,
  name: string
): Promise<boolean> {
  try {
    const htmlContent = getPasswordResetConfirmationTemplate(name);
    const textContent = getPasswordResetConfirmationText(name);

    // If no email credentials, log for development
    if (!EMAIL_USER || !EMAIL_PASSWORD) {
      console.log('\n📧 ===== PASSWORD RESET CONFIRMATION (Development Mode) =====');
      console.log(`To: ${to}`);
      console.log(`Subject: Your DuxFit Password Has Been Reset`);
      console.log('========================================\n');
      return true;
    }

    const mailOptions = {
      from: EMAIL_FROM,
      to: to,
      subject: 'Your DuxFit Password Has Been Reset',
      text: textContent,
      html: htmlContent
    };

    const info = await getTransporter().sendMail(mailOptions);
    console.log(`✅ Password reset confirmation sent to ${to}: ${info.messageId}`);
    return true;

  } catch (error) {
    console.error('❌ Error sending confirmation email:', error);
    return false;
  }
}

/**
 * HTML template for password reset email
 */
function getPasswordResetEmailTemplate(name: string, resetUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f4f4f7;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .content h2 {
      color: #1a1a1a;
      font-size: 20px;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .content p {
      color: #555555;
      margin: 16px 0;
      font-size: 16px;
    }
    .button-container {
      text-align: center;
      margin: 32px 0;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%);
      color: #ffffff !important;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      transition: transform 0.2s;
    }
    .button:hover {
      transform: translateY(-2px);
    }
    .info-box {
      background: #f8f9fa;
      border-left: 4px solid #8B5CF6;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .info-box p {
      margin: 8px 0;
      font-size: 14px;
      color: #666666;
    }
    .footer {
      background: #f8f9fa;
      padding: 24px 30px;
      text-align: center;
      color: #666666;
      font-size: 14px;
    }
    .footer a {
      color: #8B5CF6;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 DuxFit CRM</h1>
    </div>
    
    <div class="content">
      <h2>Hi ${name},</h2>
      
      <p>You recently requested to reset your password for your DuxFit CRM account.</p>
      
      <p>Click the button below to create a new password:</p>
      
      <div class="button-container">
        <a href="${resetUrl}" class="button">Reset Password</a>
      </div>
      
      <div class="info-box">
        <p><strong>⏱️ This link expires in 1 hour</strong></p>
        <p>For security reasons, this password reset link will only work once.</p>
      </div>
      
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #8B5CF6; font-size: 14px;">${resetUrl}</p>
      
      <p style="margin-top: 32px; color: #999999; font-size: 14px;">
        If you didn't request a password reset, please ignore this email or contact support if you have concerns.
      </p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} DuxFit CRM. All rights reserved.</p>
      <p>
        <a href="${FRONTEND_URL}">Go to Dashboard</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Plain text version for password reset email
 */
function getPasswordResetEmailText(name: string, resetUrl: string): string {
  return `
Hi ${name},

You recently requested to reset your password for your DuxFit CRM account.

Click the link below to create a new password:
${resetUrl}

⏱️ This link expires in 1 hour

For security reasons, this password reset link will only work once.

If you didn't request a password reset, please ignore this email or contact support if you have concerns.

© ${new Date().getFullYear()} DuxFit CRM. All rights reserved.
  `.trim();
}

/**
 * HTML template for password reset confirmation
 */
function getPasswordResetConfirmationTemplate(name: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Successful</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333333;
      background-color: #f4f4f7;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #10B981 0%, #059669 100%);
      padding: 40px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .success-icon {
      text-align: center;
      font-size: 48px;
      margin-bottom: 24px;
    }
    .content h2 {
      color: #1a1a1a;
      font-size: 20px;
      margin-top: 0;
      margin-bottom: 16px;
      text-align: center;
    }
    .content p {
      color: #555555;
      margin: 16px 0;
      font-size: 16px;
    }
    .button-container {
      text-align: center;
      margin: 32px 0;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%);
      color: #ffffff !important;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
    }
    .info-box {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 16px;
      margin: 24px 0;
      border-radius: 4px;
    }
    .info-box p {
      margin: 8px 0;
      font-size: 14px;
      color: #92400e;
    }
    .footer {
      background: #f8f9fa;
      padding: 24px 30px;
      text-align: center;
      color: #666666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Password Reset Successful</h1>
    </div>
    
    <div class="content">
      <div class="success-icon">✅</div>
      
      <h2>Hi ${name},</h2>
      
      <p>Your password has been successfully reset.</p>
      
      <p>You can now log in to your DuxFit CRM account with your new password.</p>
      
      <div class="button-container">
        <a href="${FRONTEND_URL}/login" class="button">Go to Login</a>
      </div>
      
      <div class="info-box">
        <p><strong>⚠️ Didn't make this change?</strong></p>
        <p>If you didn't reset your password, please contact support immediately.</p>
      </div>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} DuxFit CRM. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Plain text version for password reset confirmation
 */
function getPasswordResetConfirmationText(name: string): string {
  return `
Hi ${name},

Your password has been successfully reset.

You can now log in to your DuxFit CRM account with your new password.

⚠️ Didn't make this change?
If you didn't reset your password, please contact support immediately.

© ${new Date().getFullYear()} DuxFit CRM. All rights reserved.
  `.trim();
}

/**
 * Test email configuration
 */
export async function testEmailConfiguration(): Promise<boolean> {
  try {
    if (!EMAIL_USER || !EMAIL_PASSWORD) {
      console.log('✅ Email service configured in development mode (console logging)');
      return true;
    }

    await getTransporter().verify();
    console.log('✅ Email service is properly configured');
    return true;
  } catch (error) {
    console.error('❌ Email service configuration error:', error);
    return false;
  }
}

