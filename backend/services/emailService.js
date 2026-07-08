// backend/services/emailService.js
const nodemailer = require('nodemailer');

// Configure transporter using env variables
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT, 10) || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send verification email containing a token link.
 * @param {string} to Email address of the recipient
 * @param {string} token Verification token generated during signup
 */
exports.sendVerificationEmail = async (to, token) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const verificationUrl = `${clientUrl}/verify-email?token=${token}`;
  
  const mailOptions = {
    from: `"${process.env.WEBSITE_NAME || 'ApexResolve'}" <${process.env.EMAIL_USER || 'noreply@apexresolve.com'}>`,
    to,
    subject: 'Verify your ApexResolve account',
    html: `
      <p>Hello,</p>
      <p>Thank you for registering. Please confirm your email by clicking the link below:</p>
      <a href="${verificationUrl}" style="display:inline-block;padding:10px 20px;margin:10px 0;background:${process.env.ACCENT_COLOR || '#6366f1'};color:#fff;border-radius:4px;text-decoration:none;">Verify Email</a>
      <p>If you did not sign up, you can safely ignore this email.</p>
    `,
  };

  try {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
      console.warn('WARNING: SMTP email configurations not set in .env. Verification email not sent.');
      console.log(`\n------------------------------------------------------------`);
      console.log(`[DEVELOPMENT] Click the link below to verify email for ${to}:`);
      console.log(`${verificationUrl}`);
      console.log(`------------------------------------------------------------\n`);
      return;
    }
    await transporter.sendMail(mailOptions);
    console.log(`Verification email successfully sent to ${to}`);
  } catch (error) {
    console.error('Failed to send verification email via SMTP:', error.message);
    console.log(`\n------------------------------------------------------------`);
    console.log(`[DEVELOPMENT] Fallback: Click the link below to verify email for ${to}:`);
    console.log(`${verificationUrl}`);
    console.log(`------------------------------------------------------------\n`);
  }
};

/**
 * Send general email.
 * @param {object} options Email options containing email, subject, message
 */
exports.sendEmail = async (options) => {
  const mailOptions = {
    from: `"${process.env.WEBSITE_NAME || 'ApexResolve'}" <${process.env.EMAIL_USER || 'noreply@apexresolve.com'}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: `<p>${options.message}</p>`
  };

  try {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
      console.warn('WARNING: SMTP email configurations not set in .env. Email not sent.');
      console.log(`\n------------------------------------------------------------`);
      console.log(`[DEVELOPMENT] Email to ${options.email} (Subject: ${options.subject}):`);
      console.log(options.message);
      console.log(`------------------------------------------------------------\n`);
      return;
    }
    await transporter.sendMail(mailOptions);
    console.log(`Email successfully sent to ${options.email}`);
  } catch (error) {
    console.error('Failed to send email via SMTP:', error.message);
    console.log(`\n------------------------------------------------------------`);
    console.log(`[DEVELOPMENT] Fallback Email to ${options.email} (Subject: ${options.subject}):`);
    console.log(options.message);
    console.log(`------------------------------------------------------------\n`);
  }
};
