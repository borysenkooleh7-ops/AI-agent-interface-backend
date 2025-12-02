import { Request, Response } from 'express';
import whatsappService, { WhatsAppWebhookData } from '../services/whatsapp.service';
import logger from '../utils/logger';

/**
 * Send text message via WhatsApp
 */
export async function sendTextMessage(req: Request, res: Response): Promise<void> {
  try {
    const { to, message, gymId } = req.body;

    if (!to || !message || !gymId) {
      res.status(400).json({
        success: false,
        message: 'Phone number, message, and gymId are required'
      });
      return;
    }

    const result = await whatsappService.sendTextMessage(to, message, gymId);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Message sent successfully'
    });
  } catch (error: any) {
    logger.error('Error in sendTextMessage controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send message'
    });
  }
}

/**
 * Send media message via WhatsApp
 */
export async function sendMediaMessage(req: Request, res: Response): Promise<void> {
  try {
    const { to, type, mediaId, caption, filename, gymId } = req.body;

    if (!to || !type || !mediaId) {
      res.status(400).json({
        success: false,
        message: 'Phone number, media type, and media ID are required'
      });
      return;
    }

    if (!['image', 'document', 'audio', 'video'].includes(type)) {
      res.status(400).json({
        success: false,
        message: 'Invalid media type. Must be image, document, audio, or video'
      });
      return;
    }

    const result = await whatsappService.sendMediaMessage(
      to, 
      type as 'image' | 'document' | 'audio' | 'video', 
      mediaId, 
      caption, 
      filename, 
      gymId
    );

    res.status(200).json({
      success: true,
      data: result,
      message: 'Media message sent successfully'
    });
  } catch (error: any) {
    logger.error('Error in sendMediaMessage controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send media message'
    });
  }
}

/**
 * Upload media to WhatsApp
 */
export async function uploadMedia(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
      return;
    }

    const { gymId } = req.body;
    if (!gymId) {
      res.status(400).json({
        success: false,
        message: 'Gym ID is required'
      });
      return;
    }

    const mediaId = await whatsappService.uploadMedia(req.file.buffer, req.file.mimetype, gymId);

    res.status(200).json({
      success: true,
      data: { mediaId },
      message: 'Media uploaded successfully'
    });
  } catch (error: any) {
    logger.error('Error in uploadMedia controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload media'
    });
  }
}

/**
 * Download media from WhatsApp
 */
export async function downloadMedia(req: Request, res: Response): Promise<void> {
  try {
    const { mediaId } = req.params;
    const { gymId } = req.query;

    if (!mediaId) {
      res.status(400).json({
        success: false,
        message: 'Media ID is required'
      });
      return;
    }

    if (!gymId) {
      res.status(400).json({
        success: false,
        message: 'Gym ID is required'
      });
      return;
    }

    const mediaBuffer = await whatsappService.downloadMedia(mediaId, gymId as string);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="media-${mediaId}"`);
    res.send(mediaBuffer);
  } catch (error: any) {
    logger.error('Error in downloadMedia controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to download media'
    });
  }
}

/**
 * Handle WhatsApp webhook
 */
export async function handleWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { body, query } = req;

    logger.info(`WhatsApp webhook request: ${req.method} ${req.path}`, {
      query: query,
      queryKeys: Object.keys(query),
      rawQuery: req.url,
      hasBody: !!body,
      bodyType: body?.object,
      headers: {
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type']
      }
    });

    // Handle webhook verification (GET request from Meta)
    if (req.method === 'GET') {
      // Meta sends GET request with query parameters for verification
      const hubMode = query['hub.mode'] as string;
      const verifyToken = query['hub.verify_token'] as string;
      const challenge = query['hub.challenge'] as string;

      logger.info('Webhook verification attempt', {
        hubMode,
        hasVerifyToken: !!verifyToken,
        hasChallenge: !!challenge,
        allQueryParams: query
      });

      if (hubMode === 'subscribe' && verifyToken) {
        logger.info('Attempting webhook verification', {
          verifyToken: verifyToken.substring(0, 4) + '...', // Log only first 4 chars for security
          challenge: challenge
        });

        if (await whatsappService.verifyWebhookSignature('', verifyToken)) {
          logger.info('WhatsApp webhook verified successfully');
          res.status(200).send(challenge);
          return;
        } else {
          logger.warn('WhatsApp webhook verification failed - token mismatch');
          res.status(403).json({
            success: false,
            message: 'Webhook verification failed - invalid verify token'
          });
          return;
        }
      } else {
        // GET request without verification parameters
        logger.warn('GET request missing verification parameters', {
          hubMode,
          hasVerifyToken: !!verifyToken,
          hasChallenge: !!challenge,
          receivedQuery: query
        });
        res.status(400).json({
          success: false,
          message: 'Invalid webhook verification request. Expected query parameters: hub.mode=subscribe, hub.verify_token, hub.challenge',
          received: {
            hubMode: hubMode || 'missing',
            hasVerifyToken: !!verifyToken,
            hasChallenge: !!challenge
          }
        });
        return;
      }
    }

    // Handle incoming messages (POST request from Meta)
    if (req.method === 'POST') {
      logger.info('Received POST webhook request', {
        bodyObject: body?.object,
        hasBody: !!body,
        bodyKeys: body ? Object.keys(body) : [],
        fullBody: JSON.stringify(body, null, 2) // Log full payload for debugging
      });

      if (body && body.object === 'whatsapp_business_account') {
        const webhookData: WhatsAppWebhookData = body;
        const gymId = req.headers['x-gym-id'] as string; // Custom header to identify gym

        logger.info('Processing webhook message', {
          hasGymIdHeader: !!gymId,
          entryCount: webhookData.entry?.length || 0,
          entryDetails: webhookData.entry?.map(entry => ({
            id: entry.id,
            changes: entry.changes.map(change => ({
              field: change.field,
              hasMessages: !!change.value?.messages,
              messageCount: change.value?.messages?.length || 0,
              phoneNumberId: change.value?.metadata?.phone_number_id,
              displayPhoneNumber: change.value?.metadata?.display_phone_number
            }))
          }))
        });

        try {
          await whatsappService.processWebhookMessage(webhookData, gymId);

          res.status(200).json({
            success: true,
            message: 'Webhook processed successfully'
          });
          return;
        } catch (error: any) {
          logger.error('Error processing webhook message', {
            error: error.message,
            stack: error.stack
          });
          // Still return 200 to Meta to prevent retries, but log the error
          res.status(200).json({
            success: false,
            message: 'Webhook received but processing failed',
            error: error.message
          });
          return;
        }
      } else {
        logger.warn('Invalid webhook data received', {
          bodyObject: body?.object,
          bodyType: typeof body
        });
        res.status(400).json({
          success: false,
          message: 'Invalid webhook data. Expected object: whatsapp_business_account'
        });
        return;
      }
    }

    // Method not allowed
    res.status(405).json({
      success: false,
      message: 'Method not allowed. Use GET for verification or POST for webhook events.'
    });
  } catch (error: any) {
    logger.error('Error in handleWebhook controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process webhook'
    });
  }
}

/**
 * Diagnostic endpoint to check webhook configuration
 */
export async function webhookDiagnostics(req: Request, res: Response): Promise<void> {
  try {
    const prisma = (await import('../config/database')).default;
    
    // Get all WhatsApp accounts to check phone_number_id
    const whatsappAccounts = await prisma.whatsAppAccount.findMany({
      where: { status: { in: ['ACTIVE', 'PENDING'] } },
      select: {
        id: true,
        phoneNumber: true,
        phoneNumberId: true,
        gymId: true,
        status: true
      }
    });

    const diagnostics = {
      webhookUrl: `${req.protocol}://${req.get('host')}/api/webhooks/whatsapp`,
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasVerifyToken: !!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
      },
      whatsappAccounts: whatsappAccounts.map(acc => ({
        id: acc.id,
        phoneNumber: acc.phoneNumber,
        phoneNumberId: acc.phoneNumberId,
        gymId: acc.gymId,
        status: acc.status
      })),
      commonIssues: {
        '24-hour-window': 'Meta only sends webhooks for messages within 24 hours of your last message to the user, OR for template messages. If you just activated, send a template message first.',
        'webhook-subscription': 'Ensure "messages" field is subscribed in Meta Business Manager → WhatsApp → Configuration → Webhooks → Webhook fields',
        'webhook-verification': 'Webhook must be verified in Meta Business Manager (green checkmark)',
        'phone-number-config': 'Phone number must be properly configured and active in Meta',
        'phone-number-id-mismatch': 'The phone_number_id in your database must match what Meta sends in webhook metadata'
      },
      troubleshooting: [
        '1. Go to Meta Business Manager → WhatsApp → Configuration → Webhooks',
        '2. Verify webhook URL is: ' + `${req.protocol}://${req.get('host')}/api/webhooks/whatsapp`,
        '3. Ensure "messages" field is checked/subscribed in Webhook fields',
        '4. Verify the webhook shows as "Verified" (green checkmark)',
        '5. Send a template message to your number first, then reply to it',
        '6. Check server logs for "Received POST webhook request" when you send a message',
        '7. Verify phone_number_id in database matches what Meta sends (check logs)',
        '8. Ensure your server is publicly accessible (not behind firewall)'
      ],
      nextSteps: [
        'Send a test message to your business number',
        'Check server logs immediately after sending',
        'Look for "Processing WhatsApp webhook" in logs',
        'If no POST request appears, webhook is not configured correctly in Meta',
        'If POST request appears but fails, check the error message in logs'
      ]
    };

    res.status(200).json({
      success: true,
      data: diagnostics
    });
  } catch (error: any) {
    logger.error('Error in webhookDiagnostics:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get webhook diagnostics'
    });
  }
}

/**
 * Get WhatsApp business profile
 */
export async function getBusinessProfile(req: Request, res: Response): Promise<void> {
  try {
    const { gymId } = req.query;
    
    if (!gymId) {
      res.status(400).json({
        success: false,
        message: 'Gym ID is required'
      });
      return;
    }

    const profile = await whatsappService.getBusinessProfile(gymId as string);

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error: any) {
    logger.error('Error in getBusinessProfile controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get business profile'
    });
  }
}

/**
 * Update WhatsApp business profile
 */
export async function updateBusinessProfile(req: Request, res: Response): Promise<void> {
  try {
    const { profileData, gymId } = req.body;

    if (!profileData) {
      res.status(400).json({
        success: false,
        message: 'Profile data is required'
      });
      return;
    }

    if (!gymId) {
      res.status(400).json({
        success: false,
        message: 'Gym ID is required'
      });
      return;
    }

    const result = await whatsappService.updateBusinessProfile(profileData, gymId);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Business profile updated successfully'
    });
  } catch (error: any) {
    logger.error('Error in updateBusinessProfile controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update business profile'
    });
  }
}

/**
 * Test WhatsApp connection
 */
export async function testConnection(req: Request, res: Response): Promise<void> {
  try {
    const { gymId } = req.query;
    
    if (!gymId) {
      res.status(400).json({
        success: false,
        message: 'Gym ID is required'
      });
      return;
    }

    // Try to get business profile to test connection
    await whatsappService.getBusinessProfile(gymId as string);

    res.status(200).json({
      success: true,
      message: 'WhatsApp connection is working',
      data: {
        configured: true,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error in testConnection controller:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'WhatsApp connection failed',
      data: {
        configured: false,
        error: error.message
      }
    });
  }
}
