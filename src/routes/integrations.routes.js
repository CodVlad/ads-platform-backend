import express from 'express';
import { sendToMakeWebhook } from '../services/makeWebhook.service.js';

const router = express.Router();

/**
 * @route   POST /api/integrations/make/test
 * @desc    Test Make webhook integration
 * @access  Public
 * @body    { email: string, resetUrl: string }
 */
router.post('/make/test', async (req, res) => {
  try {
    console.log('[MAKE_TEST] received request');
    console.log('[MAKE_TEST] req.body:', JSON.stringify(req.body, null, 2));
    
    const { email, resetUrl } = req.body;

    // Validate required fields
    if (!email || typeof email !== 'string' || email.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'email is required and must be a non-empty string',
      });
    }

    if (!resetUrl || typeof resetUrl !== 'string' || resetUrl.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'resetUrl is required and must be a non-empty string',
      });
    }

    // Build payload
    const payload = {
      event: 'make_test',
      email: email.trim(),
      resetUrl: resetUrl.trim(),
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
    };

    // Send to Make webhook
    const result = await sendToMakeWebhook(payload);

    // Return result with webhookUrlUsed
    res.status(200).json({
      success: result.ok,
      status: result.status,
      responsePreview: result.responsePreview,
      webhookUrlUsed: result.webhookUrlUsed || null,
      ...(result.error ? { error: result.error } : {}),
    });
  } catch (error) {
    console.error('[INTEGRATIONS] Test endpoint error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

export default router;
