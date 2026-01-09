import { Resend } from 'resend';
import { AppError } from '../middlewares/error.middleware.js';

// Create resend client only if RESEND_API_KEY exists
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

/**
 * Send password reset email
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email address
 * @param {string} params.name - Recipient name
 * @param {string} params.resetUrl - Password reset URL
 * @returns {Promise<{delivered: boolean}>} - Delivery status
 */
export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  // ALWAYS log the reset URL in Railway logs
  console.log('[RESET_URL]', resetUrl);

  // If RESEND_API_KEY missing: console.log and return
  if (!process.env.RESEND_API_KEY) {
    console.log('[EMAIL] provider not configured -> fallback only');
    return { delivered: false, provider: 'none' };
  }

  // Determine email FROM address
  const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  // Build email payload
  const emailPayload = {
    from: emailFrom,
    to: [to],
    subject: 'Link resetare cont (valabil 15 minute)',
    text: `Bună ${name},\n\nAi solicitat resetarea parolei pentru contul tău.\n\nLink-ul de resetare (valabil 15 minute):\n${resetUrl}\n\nDacă nu ai solicitat resetarea parolei, poți ignora acest email.\n\nCu respect,\nEchipa`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Resetare parolă</h2>
        <p>Bună ${name},</p>
        <p>Ai solicitat resetarea parolei pentru contul tău.</p>
        <p><a href="${resetUrl}" style="color: #007bff; text-decoration: underline;">Resetează parola</a></p>
        <p style="margin-top: 20px; padding: 10px; background-color: #f5f5f5; border-radius: 5px; word-break: break-all;">
          <strong>Link direct:</strong><br>
          <a href="${resetUrl}">${resetUrl}</a>
        </p>
        <p><small>Acest link expiră în 15 minute.</small></p>
        <p>Dacă nu ai solicitat resetarea parolei, poți ignora acest email.</p>
        <p>Cu respect,<br>Echipa</p>
      </body>
      </html>
    `,
    headers: {
      'X-Entity-Ref-ID': `reset-${Date.now()}`,
    },
  };

  // Add reply_to if configured
  if (process.env.EMAIL_REPLY_TO) {
    emailPayload.reply_to = process.env.EMAIL_REPLY_TO;
  }

  try {
    // Send email via Resend
    const data = await resend.emails.send(emailPayload);

    // On success: log and return
    console.log('[EMAIL] sent OK id:', data?.id);
    return { delivered: true, provider: 'resend', id: data?.id || null };
  } catch (error) {
    // On error: log and return error result (do NOT throw)
    console.log('[EMAIL] sent FAIL:', error?.message);
    console.log(error);
    return {
      delivered: false,
      provider: 'resend',
      error: error?.message || 'unknown',
    };
  }
}

