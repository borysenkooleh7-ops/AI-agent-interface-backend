import express from 'express';
import * as conversationController from '../controllers/conversation.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/conversations
 * Get all conversations
 * Query params: userId, leadId, gymId, status, channel, limit, offset
 */
router.get(
  '/',
  conversationController.getAllConversations
);

/**
 * GET /api/conversations/statistics
 * Get conversation statistics
 */
router.get(
  '/statistics',
  conversationController.getConversationStatistics
);

/**
 * GET /api/conversations/:id
 * Get conversation by ID with all messages
 */
router.get(
  '/:id',
  conversationController.getConversationById
);

/**
 * POST /api/conversations
 * Create new conversation
 */
router.post(
  '/',
  conversationController.createConversation
);

/**
 * PUT /api/conversations/:id
 * Update conversation
 */
router.put(
  '/:id',
  conversationController.updateConversation
);

/**
 * POST /api/conversations/:id/messages
 * Send message in conversation
 */
router.post(
  '/:id/messages',
  conversationController.sendMessage
);

/**
 * PATCH /api/conversations/:id/assign
 * Assign conversation to agent
 */
router.patch(
  '/:id/assign',
  conversationController.assignToAgent
);

/**
 * PATCH /api/conversations/:id/read
 * Mark messages as read
 */
router.patch(
  '/:id/read',
  conversationController.markAsRead
);

/**
 * DELETE /api/conversations/:id
 * Delete conversation (soft delete)
 */
router.delete(
  '/:id',
  conversationController.deleteConversation
);

/**
 * DELETE /api/conversations/bulk
 * Bulk delete conversations (soft delete)
 */
router.delete(
  '/bulk',
  conversationController.bulkDeleteConversations
);

export default router;

