import express from 'express';
import { sendForgotPasswordToMake } from '../services/makeWebhook.service.js';
import Chat from '../models/Chat.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * @route   POST /api/debug/make-webhook
 * @desc    Test Make webhook (development only)
 * @access  Public (development only)
 * @body    { to, name, resetUrl }
 */
router.post('/make-webhook', async (req, res) => {
  try {
    const { to, name, resetUrl } = req.body;

    // Validate required fields
    if (!to || !resetUrl) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: to and resetUrl are required',
      });
    }

    // Send to Make webhook
    const result = await sendForgotPasswordToMake({
      to,
      name: name || '',
      resetUrl,
    });

    // Return result
    res.status(200).json({
      success: true,
      status: result.status,
      bodyPreview: result.bodyPreview,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

/**
 * @route   DELETE /api/debug/chats/cleanup-null-ads
 * @desc    One-time cleanup: Delete chats with ad:null (development only)
 * @access  Protected (requires JWT authentication)
 * @note    This endpoint is only available in development mode
 */
router.delete('/chats/cleanup-null-ads', protect, async (req, res) => {
  try {
    // Count chats with ad: null
    const count = await Chat.countDocuments({ ad: null });
    
    if (count === 0) {
      return res.status(200).json({
        success: true,
        message: 'No chats with ad:null found',
        deletedCount: 0,
      });
    }

    // Delete all chats with ad: null
    const result = await Chat.deleteMany({ ad: null });

    console.log(`[CLEANUP] Deleted ${result.deletedCount} chat(s) with ad:null`);

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} chat(s) with ad:null`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('[CLEANUP_ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  }
});

export default router;
