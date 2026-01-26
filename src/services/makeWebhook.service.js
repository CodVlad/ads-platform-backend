/**
 * Make webhook service
 * Sends data to Make.com webhooks for automation
 */

/**
 * Get webhook URL from environment or use default
 * @returns {string} Webhook URL
 */
const getWebhookUrl = () => {
  const url = process.env.MAKE_WEBHOOK_URL || 'https://hook.eu1.make.com/5d56jckhranc215bkijzykz1t838d2v6';
  
  if (!process.env.MAKE_WEBHOOK_URL) {
    console.warn('[MAKE] MAKE_WEBHOOK_URL not set, using default webhook URL');
  }
  
  return url;
};

/**
 * Send payload to Make webhook with retry logic
 * @param {Object} payload - Payload to send to webhook
 * @returns {Promise<{ok: boolean, status: number|null, responsePreview: string, error: string|null, webhookUrlUsed?: string}>} - Webhook response details
 */
export async function sendToMakeWebhook(payload) {
  const webhookUrl = getWebhookUrl();
  
  // Build headers
  const headers = {
    'Content-Type': 'application/json',
  };
  
  // Add API key header if provided
  if (process.env.MAKE_API_KEY) {
    headers['x-make-apikey'] = process.env.MAKE_API_KEY;
    console.log('[MAKE] API key provided (not logged for security)');
  }
  
  // Log exact webhook URL used (but not API key)
  console.log('[MAKE] webhook URL used:', webhookUrl);
  console.log('[MAKE] payload:', JSON.stringify(payload, null, 2));
  
  // Attempt to send (with retry)
  let lastError = null;
  
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      console.log(`[MAKE] retry attempt ${attempt + 1}/2`);
    }
    
    // Create AbortController for timeout (8 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    try {
      // Send POST request to webhook
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Read response text safely (first 200 chars)
      let responsePreview = '';
      try {
        const responseText = await response.text();
        responsePreview = responseText.substring(0, 200);
      } catch (textError) {
        responsePreview = '[Unable to read response body]';
      }
      
      // Log response status and body preview
      console.log('[MAKE] response status:', response.status);
      console.log('[MAKE] response body preview:', responsePreview);
      
      // Return success result with webhookUrlUsed
      return {
        ok: response.ok,
        status: response.status,
        responsePreview,
        error: null,
        webhookUrlUsed: webhookUrl,
      };
    } catch (error) {
      // Clear timeout if still pending
      clearTimeout(timeoutId);
      
      lastError = error;
      
      // Check if this is a retryable error
      const isRetryable = 
        error.name === 'AbortError' || // Timeout
        error.message?.includes('fetch failed') || // Network error
        error.message?.includes('network') ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ETIMEDOUT';
      
      // Log error with details
      if (error.name === 'AbortError') {
        console.error('[MAKE] error: Request timeout after 8 seconds');
      } else {
        console.error('[MAKE] error:', error.message || 'Unknown error');
      }
      
      // Log retry decision
      if (attempt === 0 && isRetryable) {
        console.log('[MAKE] will retry: YES (retryable error detected)');
      } else if (attempt === 0 && !isRetryable) {
        console.log('[MAKE] will retry: NO (non-retryable error)');
      }
      
      // If not retryable or last attempt, return error
      if (!isRetryable || attempt === 1) {
        return {
          ok: false,
          status: null,
          responsePreview: '',
          error: error.message || 'Unknown error',
          webhookUrlUsed: webhookUrl,
        };
      }
      
      // Wait a bit before retry (500ms)
      console.log('[MAKE] waiting 500ms before retry...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Should not reach here, but return error result
  return {
    ok: false,
    status: null,
    responsePreview: '',
    error: lastError?.message || 'Request failed after retries',
    webhookUrlUsed: webhookUrl,
  };
}

/**
 * Send forgot password data to Make webhook (legacy function for backward compatibility)
 * @param {Object} params - Webhook parameters
 * @param {string} params.to - User email address
 * @param {string} params.name - User name (can be empty string)
 * @param {string} params.resetUrl - Password reset URL
 * @returns {Promise<{ok: boolean, status?: number, bodyPreview?: string}>} - Webhook response details
 * @deprecated Use sendToMakeWebhook with proper payload structure
 */
export async function sendForgotPasswordToMake({ to, name, resetUrl }) {
  const payload = {
    event: 'forgot_password',
    email: to,
    resetUrl: resetUrl ? resetUrl.trim() : '',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  };
  
  const result = await sendToMakeWebhook(payload);
  
  // Map to legacy format
  return {
    ok: result.ok,
    status: result.status,
    bodyPreview: result.responsePreview,
  };
}

/**
 * HOW TO TEST:
 * 
 * 1. Test endpoint (recommended first):
 *    POST http://localhost:5001/api/integrations/make/test
 *    Body (JSON):
 *    {
 *      "email": "test@gmail.com",
 *      "resetUrl": "https://example.com/#/reset-password/TEST"
 *    }
 *    Expected: Check logs for [MAKE] entries and Make scenario should receive bundle
 * 
 * 2. Forgot password endpoint (with existing user):
 *    POST http://localhost:5001/api/auth/forgot-password
 *    Body (JSON):
 *    {
 *      "email": "existing-user@example.com"
 *    }
 *    Expected: Check logs for [FORGOT] and [MAKE] entries, Make should receive forgot_password event
 * 
 * 3. Debug mode (dev only, if MAKE_DEBUG_ALWAYS=true):
 *    POST http://localhost:5001/api/auth/forgot-password
 *    Body (JSON):
 *    {
 *      "email": "non-existent@example.com"
 *    }
 *    Expected: Make should receive forgot_password_debug_no_user event even if user doesn't exist
 * 
 * All logs are prefixed with [MAKE] for easy filtering.
 */
