import express from 'express';
import multer from 'multer';
import * as whatsappController from '../controllers/whatsapp.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 16 * 1024 * 1024, // 16MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Allow images, documents, audio, and video
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'video/mp4',
      'video/avi',
      'video/quicktime'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, documents, audio, and video files are allowed.'));
    }
  }
});

// Webhook endpoint (no authentication required)
// Supports both GET (for verification) and POST (for incoming messages)
router.get('/webhook', whatsappController.handleWebhook);
router.post('/webhook', whatsappController.handleWebhook);

// Test connection (no authentication required for testing)
router.get('/test', whatsappController.testConnection);

// All other routes require authentication
router.use(authenticate);

// Message sending endpoints
router.post('/send/text', whatsappController.sendTextMessage);
router.post('/send/media', whatsappController.sendMediaMessage);

// Media management endpoints
router.post('/media/upload', upload.single('file'), whatsappController.uploadMedia);
router.get('/media/:mediaId/download', whatsappController.downloadMedia);

// Business profile endpoints
router.get('/profile', whatsappController.getBusinessProfile);
router.put('/profile', whatsappController.updateBusinessProfile);

export default router;
