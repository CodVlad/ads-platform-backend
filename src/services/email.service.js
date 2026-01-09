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
  console.log('[EMAIL] hasKey:', !!process.env.RESEND_API_KEY);
  console.log('[EMAIL] from:', process.env.EMAIL_FROM);
  console.log('[EMAIL] to:', to);

  // If RESEND_API_KEY missing: console.log the resetUrl and return { delivered:false }
  if (!process.env.RESEND_API_KEY) {
    console.log('Password reset link (RESEND_API_KEY not configured):', resetUrl);
    return { delivered: false, provider: 'none' };
  }

  // Determine email FROM address
  const isProduction = process.env.NODE_ENV === 'production';
  let emailFrom = process.env.EMAIL_FROM;

  if (!emailFrom) {
    if (isProduction) {
      // In production, EMAIL_FROM is required
      throw new AppError(
        'EMAIL_FROM environment variable is required in production',
        500,
        {
          provider: 'resend',
          missingConfig: 'EMAIL_FROM',
        }
      );
    } else {
      // In development, fallback to Resend's default
      emailFrom = 'onboarding@resend.dev';
      console.warn(
        'EMAIL_FROM not configured, using fallback for development:',
        emailFrom
      );
    }
  }

  try {
    // Send email via Resend
    const data = await resend.emails.send({
      from: emailFrom,
      to: [to],
      subject: 'Resetare parolă',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #007bff;
              color: #ffffff;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
            }
            .button:hover {
              background-color: #0056b3;
            }
            .fallback {
              margin-top: 20px;
              padding: 10px;
              background-color: #f5f5f5;
              border-radius: 5px;
              word-break: break-all;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Resetare parolă</h2>
            <p>Bună ${name},</p>
            <p>Ai solicitat resetarea parolei pentru contul tău. Apasă butonul de mai jos pentru a reseta parola:</p>
            <a href="${resetUrl}" class="button">Resetează parola</a>
            <p>Dacă butonul nu funcționează, copiază și deschide link-ul de mai jos în browser:</p>
            <div class="fallback">
              <a href="${resetUrl}">${resetUrl}</a>
            </div>
            <p>Acest link expiră în 15 minute.</p>
            <p>Dacă nu ai solicitat resetarea parolei, poți ignora acest email.</p>
            <p>Cu respect,<br>Echipa</p>
          </div>
        </body>
        </html>
      `,
    });

    // On success: log and return
    console.log('[EMAIL] sent OK:', data?.id || data);
    return { delivered: true, provider: 'resend', id: data?.id || null };
  } catch (error) {
    // On error: log and return error result
    console.log('[EMAIL] sent FAIL:', error?.message || error);
    console.log('[EMAIL] sent FAIL full:', error);
    return {
      delivered: false,
      provider: 'resend',
      error: error?.message || 'unknown',
    };
  }
}

