import prisma from '../config/database';
import logger from '../utils/logger';

export interface ConversationFilters {
  userId?: string;
  leadId?: string;
  gymId?: string;
  status?: 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
  channel?: string;
  limit?: number;
  offset?: number;
  accessibleGymIds?: string[]; // Gym IDs the requesting user can access
}

export interface CreateConversationData {
  leadId: string;
  userId?: string;
  channel?: string;
}

export interface UpdateConversationData {
  userId?: string;
  status?: 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
  channel?: string;
}

export interface CreateMessageData {
  conversationId: string;
  content: string;
  type?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO';
  sender: 'AI' | 'AGENT' | 'CUSTOMER';
  metadata?: any;
}

/**
 * Get all conversations with filtering
 */
export async function getAllConversations(filters: ConversationFilters = {}) {
  try {
    const {
      userId,
      leadId,
      gymId,
      status,
      channel,
      limit = 50,
      offset = 0,
      accessibleGymIds
    } = filters;

    const where: any = { isDeleted: false };

    if (userId) where.userId = userId;
    if (leadId) where.leadId = leadId;
    if (status) where.status = status;
    if (channel) where.channel = channel;
    if (gymId) {
      where.lead = { gymId };
    } else if (accessibleGymIds && accessibleGymIds.length > 0) {
      // Filter by accessible gyms if no specific gymId provided (for non-admin users)
      where.lead = { gymId: { in: accessibleGymIds } };
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              status: true,
              gym: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          messages: {
            take: 1,
            orderBy: {
              sentAt: 'desc'
            },
            select: {
              id: true,
              content: true,
              sender: true,
              sentAt: true
            }
          }
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: limit,
        skip: offset
      }),
      prisma.conversation.count({ where })
    ]);

    return {
      conversations,
      total,
      hasMore: offset + limit < total
    };
  } catch (error) {
    logger.error('Error getting all conversations:', error);
    throw error;
  }
}

/**
 * Get conversation by ID with all messages
 */
export async function getConversationById(conversationId: string) {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            status: true,
            source: true,
            score: true,
            notes: true,
            isDeleted: true,
            gym: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        },
        messages: {
          where: {
            isDeleted: false
          },
          orderBy: {
            sentAt: 'asc'
          }
        }
      }
    });

    if (!conversation || conversation.isDeleted) {
      throw new Error('Conversation not found');
    }

    return conversation;
  } catch (error) {
    logger.error('Error getting conversation by ID:', error);
    throw error;
  }
}

/**
 * Create new conversation
 */
export async function createConversation(data: CreateConversationData, createdBy: string) {
  try {
    const { leadId, userId, channel = 'whatsapp' } = data;

    // Check if lead exists
    const lead = await prisma.lead.findUnique({
      where: { id: leadId }
    });

    if (!lead || lead.isDeleted) {
      throw new Error('Lead not found');
    }

    // Create conversation
    const conversation = await prisma.conversation.create({
      data: {
        leadId,
        userId,
        channel,
        status: 'ACTIVE'
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: 'CONVERSATION_STARTED',
        description: `Conversation started with ${lead.name}`,
        userId: userId || createdBy,
        leadId: lead.id,
        metadata: {
          conversationId: conversation.id,
          channel
        }
      }
    });

    logger.info(`Conversation created: ${conversation.id} for lead ${leadId}`);

    return conversation;
  } catch (error) {
    logger.error('Error creating conversation:', error);
    throw error;
  }
}

/**
 * Update conversation
 */
export async function updateConversation(
  conversationId: string,
  data: UpdateConversationData,
  updatedBy: string
) {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        lead: true
      }
    });

    if (!conversation || conversation.isDeleted) {
      throw new Error('Conversation not found');
    }

    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        ...data,
        updatedAt: new Date()
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true
          }
        },
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Log status change if applicable
    if (data.status && data.status !== conversation.status) {
      await prisma.activityLog.create({
        data: {
          type: 'CONVERSATION_CLOSED',
          description: `Conversation ${data.status.toLowerCase()} with ${conversation.lead.name}`,
          userId: updatedBy,
          leadId: conversation.leadId,
          metadata: {
            conversationId,
            oldStatus: conversation.status,
            newStatus: data.status
          }
        }
      });
    }

    logger.info(`Conversation updated: ${conversationId}`);

    return updatedConversation;
  } catch (error) {
    logger.error('Error updating conversation:', error);
    throw error;
  }
}

/**
 * Send message in conversation
 */
export async function sendMessage(data: CreateMessageData, sentBy: string) {
  try {
    const { conversationId, content, type = 'TEXT', sender, metadata } = data;

    // Verify conversation exists
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { 
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            gymId: true,
            isDeleted: true
          }
        }
      }
    });

    if (!conversation || conversation.isDeleted) {
      throw new Error('Conversation not found');
    }

    // Validate sender enum
    if (!['AI', 'AGENT', 'CUSTOMER'].includes(sender)) {
      throw new Error(`Invalid sender value: ${sender}. Must be one of: AI, AGENT, CUSTOMER`);
    }

    // Validate type enum
    const validTypes = ['TEXT', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO'];
    const messageType = validTypes.includes(type) ? type : 'TEXT';

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId,
        content,
        type: messageType as any,
        sender: sender as any,
        metadata: metadata || {},
        sentAt: new Date()
      }
    });

    // Update conversation last message time
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: new Date(),
        updatedAt: new Date()
      }
    });

    // Log activity if sent by agent
    if (sender === 'AGENT' && conversation.lead && !conversation.lead.isDeleted) {
      try {
        await prisma.activityLog.create({
          data: {
            type: 'MESSAGE_SENT',
            description: `Message sent to ${conversation.lead.name || 'lead'}`,
            userId: sentBy,
            leadId: conversation.leadId,
            metadata: {
              conversationId,
              messageId: message.id,
              channel: conversation.channel
            }
          }
        });
      } catch (activityError) {
        // Don't fail message creation if activity log fails
        logger.warn('Failed to create activity log for message', {
          error: activityError,
          messageId: message.id,
          conversationId
        });
      }
    }

    logger.info(`Message sent: ${message.id} in conversation ${conversationId}`);

    return message;
  } catch (error) {
    logger.error('Error sending message:', error);
    throw error;
  }
}

/**
 * Get conversation statistics
 */
export async function getConversationStatistics(filters: { gymId?: string; userId?: string } = {}) {
  try {
    const { gymId, userId } = filters;

    const baseWhere: any = { isDeleted: false };
    if (gymId) baseWhere.lead = { gymId };
    if (userId) baseWhere.userId = userId;

    const [total, active, closed, archived] = await Promise.all([
      prisma.conversation.count({ where: baseWhere }),
      prisma.conversation.count({ where: { ...baseWhere, status: 'ACTIVE' } }),
      prisma.conversation.count({ where: { ...baseWhere, status: 'CLOSED' } }),
      prisma.conversation.count({ where: { ...baseWhere, status: 'ARCHIVED' } })
    ]);

    return {
      total,
      active,
      closed,
      archived
    };
  } catch (error) {
    logger.error('Error getting conversation statistics:', error);
    throw error;
  }
}

/**
 * Assign conversation to agent
 */
export async function assignConversationToAgent(
  conversationId: string,
  userId: string,
  assignedBy: string
) {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { lead: true, user: true }
    });

    if (!conversation || conversation.isDeleted) {
      throw new Error('Conversation not found');
    }

    const updatedConversation = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        userId,
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        lead: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Log handoff
    await prisma.activityLog.create({
      data: {
        type: 'CONVERSATION_STARTED',
        description: `Conversation assigned to ${updatedConversation.user?.name}`,
        userId: assignedBy,
        leadId: conversation.leadId,
        metadata: {
          conversationId,
          previousAgent: conversation.user?.name,
          newAgent: updatedConversation.user?.name
        }
      }
    });

    logger.info(`Conversation ${conversationId} assigned to ${userId}`);

    return updatedConversation;
  } catch (error) {
    logger.error('Error assigning conversation:', error);
    throw error;
  }
}

/**
 * Update message metadata
 */
export async function updateMessageMetadata(messageId: string, metadata: any) {
  try {
    const message = await prisma.message.update({
      where: { id: messageId },
      data: {
        metadata: metadata
      }
    });

    logger.info(`Message metadata updated: ${messageId}`);
    return message;
  } catch (error) {
    logger.error('Error updating message metadata:', error);
    throw error;
  }
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(conversationId: string, messageIds: string[]) {
  try {
    await prisma.message.updateMany({
      where: {
        id: { in: messageIds },
        conversationId
      },
      data: {
        readAt: new Date()
      }
    });

    logger.info(`Marked ${messageIds.length} messages as read in conversation ${conversationId}`);
  } catch (error) {
    logger.error('Error marking messages as read:', error);
    throw error;
  }
}

/**
 * Delete conversation (soft delete)
 */
export async function deleteConversation(conversationId: string, deletedBy: string): Promise<void> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation || conversation.isDeleted) {
      throw new Error('Conversation not found');
    }

    // Soft delete conversation and all its messages
    await prisma.$transaction([
      prisma.conversation.update({
        where: { id: conversationId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy
        }
      }),
      prisma.message.updateMany({
        where: { conversationId },
        data: {
          isDeleted: true,
          deletedAt: new Date()
        }
      })
    ]);

    logger.info(`Conversation soft deleted: ${conversationId} by ${deletedBy}`);
  } catch (error) {
    logger.error('Error deleting conversation:', error);
    throw error;
  }
}

/**
 * Bulk delete conversations (soft delete)
 */
export async function bulkDeleteConversations(conversationIds: string[], deletedBy: string): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.conversation.updateMany({
        where: {
          id: { in: conversationIds }
        },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy
        }
      }),
      prisma.message.updateMany({
        where: {
          conversationId: { in: conversationIds }
        },
        data: {
          isDeleted: true,
          deletedAt: new Date()
        }
      })
    ]);

    logger.info(`Bulk delete: ${conversationIds.length} conversations soft deleted by ${deletedBy}`);
  } catch (error) {
    logger.error('Error bulk deleting conversations:', error);
    throw error;
  }
}

