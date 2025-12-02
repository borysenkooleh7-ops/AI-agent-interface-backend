import { Request, Response } from 'express';
import * as conversationService from '../services/conversation.service';
import * as gymAccess from '../utils/gymAccess';
import whatsappService from '../services/whatsapp.service';
import prisma from '../config/database';
import logger from '../utils/logger';

/**
 * Get all conversations
 */
export async function getAllConversations(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { leadId, gymId, status, channel, limit, offset } = req.query;

    // Get accessible gym IDs (admins get all, others get only assigned)
    const accessibleGymIds = await gymAccess.getUserAccessibleGymIds(userId, userRole);

    // If specific gymId is requested, verify access
    let filterGymId = gymId as string;
    if (filterGymId && userRole !== 'ADMIN') {
      if (!accessibleGymIds.includes(filterGymId)) {
        res.status(403).json({ success: false, message: 'Access denied to this gym' });
        return;
      }
    }

    const filters: any = {
      accessibleGymIds: userRole === 'ADMIN' ? undefined : accessibleGymIds
    };
    
    if (leadId) filters.leadId = leadId as string;
    if (filterGymId) filters.gymId = filterGymId;
    if (status) filters.status = status as string;
    if (channel) filters.channel = channel as string;
    if (limit) filters.limit = parseInt(limit as string);
    if (offset) filters.offset = parseInt(offset as string);

    const result = await conversationService.getAllConversations(filters);

    res.json({
      success: true,
      data: result.conversations,
      pagination: {
        total: result.total,
        limit: filters.limit || 50,
        offset: filters.offset || 0,
        hasMore: result.hasMore
      }
    });
  } catch (error: any) {
    logger.error('Error in getAllConversations controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversations'
    });
  }
}

/**
 * Get conversation by ID
 */
export async function getConversationById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const conversation = await conversationService.getConversationById(id);

    res.json({
      success: true,
      data: conversation
    });
  } catch (error: any) {
    logger.error('Error in getConversationById controller:', error);
    if (error.message === 'Conversation not found') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve conversation'
      });
    }
  }
}

/**
 * Create new conversation
 */
export async function createConversation(req: Request, res: Response): Promise<void> {
  try {
    const { leadId, userId, channel } = req.body;
    const createdBy = (req as any).user.userId;

    if (!leadId) {
      res.status(400).json({
        success: false,
        message: 'leadId is required'
      });
      return;
    }

    const conversation = await conversationService.createConversation(
      { leadId, userId, channel },
      createdBy
    );

    // Emit Socket.IO event
    const io = (req.app as any).get('io');
    if (io && userId) {
      io.to(`user:${userId}`).emit('conversation:created', conversation);
    }

    res.status(201).json({
      success: true,
      data: conversation,
      message: 'Conversation created successfully'
    });
  } catch (error: any) {
    logger.error('Error in createConversation controller:', error);
    if (error.message === 'Lead not found') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to create conversation'
      });
    }
  }
}

/**
 * Update conversation
 */
export async function updateConversation(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { userId, status, channel } = req.body;
    const updatedBy = (req as any).user.userId;

    const conversation = await conversationService.updateConversation(
      id,
      { userId, status, channel },
      updatedBy
    );

    // Emit Socket.IO event
    const io = (req.app as any).get('io');
    if (io) {
      if (conversation.userId) {
        io.to(`user:${conversation.userId}`).emit('conversation:updated', conversation);
      }
      io.to(`conversation:${id}`).emit('conversation:updated', conversation);
    }

    res.json({
      success: true,
      data: conversation,
      message: 'Conversation updated successfully'
    });
  } catch (error: any) {
    logger.error('Error in updateConversation controller:', error);
    if (error.message === 'Conversation not found') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to update conversation'
      });
    }
  }
}

/**
 * Send message in conversation
 */
export async function sendMessage(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { content, type, sender, metadata } = req.body;
    const sentBy = (req as any).user?.userId;

    if (!sentBy) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized - user not found'
      });
      return;
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'content is required and must be a non-empty string'
      });
      return;
    }

    if (!sender || !['AI', 'AGENT', 'CUSTOMER'].includes(sender)) {
      res.status(400).json({
        success: false,
        message: 'sender is required and must be one of: AI, AGENT, CUSTOMER'
      });
      return;
    }

    // Get conversation to check channel and get lead info
    const conversation = await conversationService.getConversationById(id);
    
    const message = await conversationService.sendMessage(
      {
        conversationId: id,
        content,
        type,
        sender,
        metadata
      },
      sentBy
    );

    // If message is sent by AGENT and channel is WhatsApp, send via WhatsApp API
    let whatsappMessageId: string | undefined;
    if (sender === 'AGENT' && conversation.channel === 'whatsapp' && conversation.lead && !conversation.lead.isDeleted && conversation.lead.phone) {
      let gymId: string | null = null;
      try {
        // Get gymId from lead - need to fetch full lead to get gymId
        const fullLead = await prisma.lead.findUnique({
          where: { id: conversation.lead.id },
          select: { gymId: true }
        });
        
        gymId = fullLead?.gymId || conversation.lead.gym?.id || null;
        if (gymId) {
          logger.info('Sending message via WhatsApp', {
            conversationId: id,
            phone: conversation.lead.phone,
            gymId
          });
          
          const whatsappResponse = await whatsappService.sendTextMessage(
            conversation.lead.phone,
            content,
            gymId
          );
          
          whatsappMessageId = whatsappResponse.messages?.[0]?.id;
          
          // Update message metadata with WhatsApp message ID
          if (whatsappMessageId) {
            const existingMetadata = message.metadata && typeof message.metadata === 'object' 
              ? message.metadata as Record<string, any>
              : {};
            await conversationService.updateMessageMetadata(message.id, {
              ...existingMetadata,
              whatsappMessageId
            });
          }
          
          logger.info('Message sent via WhatsApp successfully', {
            messageId: message.id,
            whatsappMessageId
          });
        } else {
          logger.warn('Cannot send WhatsApp message: gymId not found', {
            conversationId: id,
            leadId: conversation.lead.id
          });
        }
      } catch (error: any) {
        logger.error('Error sending message via WhatsApp', {
          error: error.message,
          conversationId: id,
          messageId: message.id,
          gymId: gymId || 'unknown',
          phone: conversation.lead.phone
        });
        // Don't fail the request if WhatsApp sending fails, message is already saved
        // But log a warning in the message metadata
        const existingMetadata = message.metadata && typeof message.metadata === 'object' 
          ? message.metadata as Record<string, any>
          : {};
        await conversationService.updateMessageMetadata(message.id, {
          ...existingMetadata,
          whatsappError: error.message,
          whatsappErrorAt: new Date().toISOString()
        }).catch(() => {
          // Ignore errors updating metadata
        });
      }
    }

    // Emit Socket.IO event
    const io = (req.app as any).get('io');
    if (io) {
      io.to(`conversation:${id}`).emit('message:new', message);
      
      // Notify assigned agent if message is from customer
      if (conversation.userId && sender === 'CUSTOMER' && conversation.lead) {
        io.to(`user:${conversation.userId}`).emit('message:new', {
          ...message,
          conversation: {
            id: conversation.id,
            leadName: conversation.lead.name || 'Unknown'
          }
        });
      }
    }

    res.status(201).json({
      success: true,
      data: message,
      message: 'Message sent successfully'
    });
  } catch (error: any) {
    logger.error('Error in sendMessage controller:', {
      error: error.message,
      stack: error.stack,
      conversationId: req.params.id,
      body: req.body,
      userId: (req as any).user?.userId
    });
    if (error.message === 'Conversation not found') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send message',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

/**
 * Get conversation statistics
 */
export async function getConversationStatistics(req: Request, res: Response): Promise<void> {
  try {
    const { gymId, userId } = req.query;

    const filters: any = {};
    if (gymId) filters.gymId = gymId as string;
    if (userId) filters.userId = userId as string;

    const statistics = await conversationService.getConversationStatistics(filters);

    res.json({
      success: true,
      data: statistics
    });
  } catch (error: any) {
    logger.error('Error in getConversationStatistics controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve conversation statistics'
    });
  }
}

/**
 * Assign conversation to agent
 */
export async function assignToAgent(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const assignedBy = (req as any).user.userId;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'userId is required'
      });
      return;
    }

    const conversation = await conversationService.assignConversationToAgent(id, userId, assignedBy);

    // Emit Socket.IO event
    const io = (req.app as any).get('io');
    if (io) {
      io.to(`user:${userId}`).emit('conversation:assigned', conversation);
    }

    res.json({
      success: true,
      data: conversation,
      message: 'Conversation assigned successfully'
    });
  } catch (error: any) {
    logger.error('Error in assignToAgent controller:', error);
    if (error.message === 'Conversation not found') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to assign conversation'
      });
    }
  }
}

/**
 * Mark messages as read
 */
export async function markAsRead(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { messageIds } = req.body;

    if (!messageIds || !Array.isArray(messageIds)) {
      res.status(400).json({
        success: false,
        message: 'messageIds array is required'
      });
      return;
    }

    await conversationService.markMessagesAsRead(id, messageIds);

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error: any) {
    logger.error('Error in markAsRead controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read'
    });
  }
}

/**
 * Delete conversation (soft delete)
 */
export async function deleteConversation(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    await conversationService.deleteConversation(id, userId);

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error in deleteConversation controller:', error);
    if (error.message === 'Conversation not found') {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to delete conversation'
      });
    }
  }
}

/**
 * Bulk delete conversations (soft delete)
 */
export async function bulkDeleteConversations(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    const { conversationIds } = req.body;

    if (!conversationIds || !Array.isArray(conversationIds) || conversationIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'conversationIds array is required'
      });
      return;
    }

    await conversationService.bulkDeleteConversations(conversationIds, userId);

    res.json({
      success: true,
      message: `${conversationIds.length} conversations deleted successfully`
    });
  } catch (error: any) {
    logger.error('Error in bulkDeleteConversations controller:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete conversations'
    });
  }
}

