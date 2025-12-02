import express from 'express';
import * as whatsappController from '../controllers/whatsapp.controller';

const router = express.Router();

// WhatsApp webhook endpoint (no authentication required)
// Supports both GET (for verification) and POST (for incoming messages)
router.get('/whatsapp', whatsappController.handleWebhook);
router.post('/whatsapp', whatsappController.handleWebhook);

// Webhook diagnostics endpoint (no authentication required)
router.get('/whatsapp/diagnostics', whatsappController.webhookDiagnostics);

export default router;

