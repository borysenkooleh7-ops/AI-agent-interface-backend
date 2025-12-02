import axios, { AxiosResponse } from 'axios';
import logger from '../utils/logger';
import prisma from '../config/database';
import { ActivityType } from '@prisma/client';
import { getSocketInstance } from '../utils/socketManager';
import aiService from './ai.service';
import messageAnalysisService from './messageAnalysis.service';
import * as aiPromptService from './aiPrompt.service';
import responseStrategyService from './responseStrategy.service';
import qualificationFlowService from './qualificationFlow.service';

export interface WhatsAppMessage {
  to: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video';
  text?: {
    body: string;
  };
  image?: {
    link?: string;
    id?: string;
    caption?: string;
  };
  document?: {
    link?: string;
    id?: string;
    filename?: string;
    caption?: string;
  };
  audio?: {
    link?: string;
    id?: string;
  };
  video?: {
    link?: string;
    id?: string;
    caption?: string;
  };
}

export interface WhatsAppWebhookMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: {
    body: string;
  };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  document?: {
    id: string;
    mime_type: string;
    sha256: string;
    filename?: string;
    caption?: string;
  };
  audio?: {
    id: string;
    mime_type: string;
    sha256: string;
  };
  video?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  context?: {
    from: string;
    id: string;
  };
}

export interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: {
          name: string;
        };
        wa_id: string;
      }>;
      messages?: WhatsAppWebhookMessage[];
      statuses?: Array<{
        id: string;
        status: 'sent' | 'delivered' | 'read' | 'failed';
        timestamp: string;
        recipient_id: string;
        errors?: Array<{
          code: number;
          title: string;
          message: string;
        }>;
      }>;
    };
    field: string;
  }>;
}

export interface WhatsAppWebhookData {
  object: string;
  entry: WhatsAppWebhookEntry[];
}

class WhatsAppService {
  private apiVersion: string;
  private baseUrl: string;

  constructor() {
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
    this.baseUrl = process.env.WHATSAPP_API_BASE_URL || 'https://graph.facebook.com';
  }

  /**
   * Get WhatsApp account configuration for a gym
   */
  private async getWhatsAppConfig(gymId: string) {
    const whatsappAccount = await prisma.whatsAppAccount.findFirst({
      where: { gymId, status: 'ACTIVE' }
    });

    if (!whatsappAccount) {
      // Check if there's a WhatsApp account with a different status
      const anyAccount = await prisma.whatsAppAccount.findFirst({
        where: { gymId }
      });

      if (anyAccount) {
        logger.warn(`WhatsApp account found for gym ${gymId} but status is ${anyAccount.status}, not ACTIVE`);
        throw new Error(`WhatsApp account for gym ${gymId} is not active. Current status: ${anyAccount.status}. Please activate the WhatsApp account in the configuration.`);
      } else {
        // Check all WhatsApp accounts to help with debugging
        const allAccounts = await prisma.whatsAppAccount.findMany({
          select: { id: true, gymId: true, phoneNumber: true, status: true }
        });
        logger.error(`No WhatsApp account found for gym ${gymId}`, {
          requestedGymId: gymId,
          availableAccounts: allAccounts
        });
        throw new Error(`No WhatsApp account configured for gym ${gymId}. Please configure a WhatsApp account in the settings.`);
      }
    }

    return {
      accessToken: whatsappAccount.accessToken,
      phoneNumberId: whatsappAccount.phoneNumberId
    };
  }

  /**
   * Get headers for API requests
   */
  private getHeaders(accessToken: string) {
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get media headers for file uploads
   */
  private getMediaHeaders(accessToken: string) {
    return {
      'Authorization': `Bearer ${accessToken}`,
    };
  }

  /**
   * Send a text message
   */
  async sendTextMessage(to: string, message: string, gymId: string): Promise<any> {
    if (!gymId) {
      throw new Error('Gym ID is required for sending WhatsApp messages');
    }

    try {
      const whatsappMessage: WhatsAppMessage = {
        to,
        type: 'text',
        text: {
          body: message
        }
      };

      const response = await this.sendMessage(whatsappMessage, gymId);
      
      // Log activity
      await this.logMessageActivity(to, message, 'sent', gymId);

      return response;
    } catch (error) {
      logger.error('Error sending WhatsApp text message:', error);
      throw error;
    }
  }

  /**
   * Send media message (image, document, audio, video)
   */
  async sendMediaMessage(
    to: string,
    type: 'image' | 'document' | 'audio' | 'video',
    mediaId: string,
    caption?: string,
    filename?: string,
    gymId?: string
  ): Promise<any> {
    if (!gymId) {
      throw new Error('Gym ID is required for sending WhatsApp messages');
    }

    try {
      const whatsappMessage: WhatsAppMessage = {
        to,
        type,
        [type]: {
          id: mediaId,
          ...(caption && { caption }),
          ...(filename && { filename })
        }
      };

      const response = await this.sendMessage(whatsappMessage, gymId);
      
      // Log activity
      await this.logMessageActivity(to, `${type}: ${mediaId}`, 'sent', gymId);

      return response;
    } catch (error) {
      logger.error(`Error sending WhatsApp ${type} message:`, error);
      throw error;
    }
  }

  /**
   * Send message using WhatsApp API
   */
  private async sendMessage(message: WhatsAppMessage, gymId: string): Promise<any> {
    const config = await this.getWhatsAppConfig(gymId);

    const url = `${this.baseUrl}/${this.apiVersion}/${config.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      to: message.to,
      type: message.type,
      [message.type]: message[message.type]
    };

    logger.info('Sending WhatsApp API request', {
      url,
      gymId,
      phoneNumberId: config.phoneNumberId,
      to: message.to,
      type: message.type,
      hasText: !!message.text,
      hasMediaId: !!(message.image?.id || message.document?.id || message.audio?.id || message.video?.id),
      preview: message.text?.body ? message.text.body.substring(0, 60) : undefined
    });

    try {
      const response: AxiosResponse = await axios.post(url, payload, {
      headers: this.getHeaders(config.accessToken)
    });

      logger.info('WhatsApp API response received', {
        to: message.to,
        gymId,
        phoneNumberId: config.phoneNumberId,
        status: response.status,
        messageId: response.data?.messages?.[0]?.id,
        responseData: response.data
      });

    return response.data;
    } catch (error: any) {
      logger.error('WhatsApp API request failed', {
        to: message.to,
        gymId,
        phoneNumberId: config.phoneNumberId,
        error: error.response?.data || error.message
      });
      throw error;
    }
  }

  /**
   * Upload media to WhatsApp
   */
  async uploadMedia(fileBuffer: Buffer, mimeType: string, gymId: string): Promise<string> {
    try {
      const config = await this.getWhatsAppConfig(gymId);

      // Use phoneNumberId for media uploads (not businessAccountId)
      const url = `${this.baseUrl}/${this.apiVersion}/${config.phoneNumberId}/media`;
      
      const formData = new FormData();
      // Convert Buffer to Blob for FormData (Node.js compatible)
      const blob = new Blob([fileBuffer as any], { type: mimeType });
      formData.append('file', blob);
      formData.append('messaging_product', 'whatsapp');

      const response: AxiosResponse = await axios.post(url, formData, {
        headers: this.getMediaHeaders(config.accessToken)
      });

      logger.info(`Media uploaded to WhatsApp: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      logger.error('Error uploading media to WhatsApp:', error);
      throw error;
    }
  }

  /**
   * Get media URL from WhatsApp
   */
  async getMediaUrl(mediaId: string, gymId: string): Promise<string> {
    try {
      const config = await this.getWhatsAppConfig(gymId);

      const url = `${this.baseUrl}/${this.apiVersion}/${mediaId}`;
      
      const response: AxiosResponse = await axios.get(url, {
        headers: this.getHeaders(config.accessToken)
      });

      return response.data.url;
    } catch (error) {
      logger.error('Error getting media URL from WhatsApp:', error);
      throw error;
    }
  }

  /**
   * Download media from WhatsApp
   */
  async downloadMedia(mediaId: string, gymId: string): Promise<Buffer> {
    try {
      const mediaUrl = await this.getMediaUrl(mediaId, gymId);
      
      const config = await this.getWhatsAppConfig(gymId);
      
      const response: AxiosResponse = await axios.get(mediaUrl, {
        headers: this.getHeaders(config.accessToken),
        responseType: 'arraybuffer'
      });

      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Error downloading media from WhatsApp:', error);
      throw error;
    }
  }

  /**
   * Process incoming webhook message
   */
  async processWebhookMessage(webhookData: WhatsAppWebhookData, gymId?: string): Promise<void> {
    try {
      logger.info('Processing WhatsApp webhook', {
        hasEntries: !!webhookData.entry,
        entryCount: webhookData.entry?.length || 0,
        providedGymId: gymId
      });

      for (const entry of webhookData.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            const { messages, contacts, metadata } = change.value;
            
            logger.info('Processing messages change', {
              phoneNumberId: metadata?.phone_number_id,
              messageCount: messages?.length || 0,
              hasGymId: !!gymId
            });
            
            // Identify gym from phone_number_id if not provided
            if (!gymId && metadata?.phone_number_id) {
              logger.info('Attempting to resolve gymId from phone_number_id', {
                phoneNumberId: metadata.phone_number_id
              });
              
              const whatsappAccount = await prisma.whatsAppAccount.findFirst({
                where: { phoneNumberId: metadata.phone_number_id }
              });
              
              if (whatsappAccount) {
                gymId = whatsappAccount.gymId;
                logger.info('Successfully resolved gymId from phone_number_id', {
                  gymId,
                  phoneNumberId: metadata.phone_number_id
                });
              } else {
                logger.warn('Could not find WhatsApp account for phone_number_id', {
                  phoneNumberId: metadata.phone_number_id,
                  availableAccounts: await prisma.whatsAppAccount.findMany({
                    select: { phoneNumberId: true, gymId: true }
                  })
                });
              }
            }

            if (!gymId) {
              logger.error('Cannot process messages: gymId is missing', {
                phoneNumberId: metadata?.phone_number_id,
                messageCount: messages?.length || 0
              });
              // Continue processing but log the issue
            }

            if (messages) {
              for (const message of messages) {
                await this.handleIncomingMessage(message, contacts, gymId);
              }
            }

            // Handle message statuses
            const { statuses } = change.value;
            if (statuses) {
              for (const status of statuses) {
                await this.handleMessageStatus(status, gymId);
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error processing WhatsApp webhook:', error);
      throw error;
    }
  }

  /**
   * Handle incoming message
   */
  private async handleIncomingMessage(
    message: WhatsAppWebhookMessage,
    contacts?: Array<{ profile: { name: string }; wa_id: string }>,
    gymId?: string
  ): Promise<void> {
    try {
      const contact = contacts?.find(c => c.wa_id === message.from);
      const contactName = contact?.profile.name || 'Unknown';

      logger.info('Handling incoming WhatsApp message', {
        messageId: message.id,
        from: message.from,
        type: message.type,
        gymId,
        contactName
      });

      if (!gymId) {
        logger.error('Cannot process message: gymId is missing', {
          messageId: message.id,
          from: message.from,
          type: message.type
        });
        throw new Error('gymId is required to process incoming messages');
      }

      // Find or create lead
      // First, check for any lead with this phone and gymId (including deleted ones)
      // This is important because the unique constraint (gymId, phone) prevents
      // creating a new lead if a deleted one exists
      let lead = await prisma.lead.findFirst({
        where: {
          phone: message.from,
          gymId: gymId
          // Note: Not filtering by isDeleted - we want to find deleted leads too
        }
      });

      logger.info('Lead lookup result', {
        found: !!lead,
        isDeleted: lead?.isDeleted ?? false,
        phone: message.from,
        gymId
      });

      if (lead) {
        // Lead exists - check if it's deleted and restore if needed
        if (lead.isDeleted) {
          // Restore the deleted lead
          lead = await prisma.lead.update({
            where: { id: lead.id },
            data: {
              isDeleted: false,
              deletedAt: null,
              deletedBy: null,
              name: contactName, // Update name from WhatsApp
              status: 'NEW',
              source: 'WHATSAPP'
            }
          });

          logger.info('Restored deleted lead from WhatsApp message', {
            leadId: lead.id,
            phone: message.from,
            name: contactName
          });
        } else {
          // Lead exists and is active - use it
          logger.info('Found existing active lead from WhatsApp message', {
            leadId: lead.id,
            phone: message.from,
            name: contactName
          });
        }
      } else {
        // No lead found with this gymId and phone
        // Check if phone exists for a different gym (for error reporting)
        const leadInOtherGym = await prisma.lead.findFirst({
          where: {
            phone: message.from
          },
          include: {
            gym: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });

        if (leadInOtherGym && leadInOtherGym.gymId !== gymId) {
          // Phone number exists for different gym - log warning and skip
          logger.warn('Phone number already exists for different gym', {
            phone: message.from,
            existingGymId: leadInOtherGym.gymId,
            existingGymName: leadInOtherGym.gym.name,
            requestedGymId: gymId,
            contactName
          });
          throw new Error(`Phone number ${message.from} already registered to gym: ${leadInOtherGym.gym.name}`);
        }

        // No lead exists - create a new one
        // Handle race conditions where another request might create it simultaneously
        try {
          lead = await prisma.lead.create({
            data: {
              name: contactName,
              phone: message.from,
              gymId,
              source: 'WHATSAPP',
              status: 'NEW'
            }
          });

          logger.info('Created new lead from WhatsApp message', {
            leadId: lead.id,
            phone: message.from,
            name: contactName
          });

          // Log lead creation
          await prisma.activityLog.create({
            data: {
              type: ActivityType.LEAD_CREATED,
              description: `New lead created from WhatsApp: ${contactName}`,
              userId: undefined,
              leadId: lead.id,
              gymId,
              metadata: {
                source: 'whatsapp',
                phone: message.from
              }
            }
          });
        } catch (createError: any) {
          // Handle race condition: lead was created by another request
          if (createError.code === 'P2002') {
            logger.warn('Race condition: Lead already exists, fetching it', {
              phone: message.from,
              gymId
            });

            // Immediately try to find it (without isDeleted filter to catch all cases)
            // Use a retry loop with short delays to handle transaction commit timing
            for (let attempt = 0; attempt < 5; attempt++) {
              if (attempt > 0) {
                await new Promise(resolve => setTimeout(resolve, 50 * attempt));
              }

              lead = await prisma.lead.findFirst({
                where: {
                  phone: message.from,
                  gymId: gymId
                }
              });

              if (lead) {
                // If found but deleted, restore it
                if (lead.isDeleted) {
                  lead = await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                      isDeleted: false,
                      deletedAt: null,
                      deletedBy: null,
                      name: contactName,
                      status: 'NEW',
                      source: 'WHATSAPP'
                    }
                  });
                  logger.info('Restored deleted lead found after race condition', {
                    leadId: lead.id,
                    phone: message.from
                  });
                } else {
                  logger.info('Found existing lead after race condition', {
                    leadId: lead.id,
                    phone: message.from
                  });
                }
                break;
              }
            }

            // If still not found, try broader search
            if (!lead) {
              const anyLead = await prisma.lead.findFirst({
                where: { phone: message.from }
              });

              if (anyLead) {
                if (anyLead.gymId !== gymId) {
                  throw new Error(`Phone number belongs to different gym: ${anyLead.gymId}`);
                }
                // Use it and restore if deleted
                lead = anyLead;
                if (lead.isDeleted) {
                  lead = await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                      isDeleted: false,
                      deletedAt: null,
                      deletedBy: null,
                      name: contactName,
                      status: 'NEW',
                      source: 'WHATSAPP'
                    }
                  });
                }
              } else {
                logger.error('Cannot find lead after unique constraint error', {
                  phone: message.from,
                  gymId
                });
                throw createError;
              }
            }
          } else {
            throw createError;
          }
        }
      }

      // Create or update conversation
      let conversation = await prisma.conversation.findFirst({
        where: {
          leadId: lead.id,
          channel: 'whatsapp'
        }
      });

      const isNewConversation = !conversation;
      
      // Get WhatsApp message timestamp for proper ordering
      const messageTimestamp = message.timestamp 
        ? new Date(parseInt(message.timestamp) * 1000)
        : new Date();
      
      if (isNewConversation) {
        conversation = await prisma.conversation.create({
          data: {
            leadId: lead.id,
            channel: 'whatsapp',
            status: 'ACTIVE'
          }
        });

        logger.info('Created new conversation', {
          conversationId: conversation.id,
          leadId: lead.id
        });

        // Send automatic greeting for new conversations BEFORE saving customer message
        // Pass the message timestamp so greeting can be set to appear before it
        await this.sendAutoGreeting(message.from, gymId, conversation.id, messageTimestamp);
      }

      // Ensure conversation exists (should always be true at this point)
      if (!conversation) {
        throw new Error('Failed to create or find conversation for lead');
      }

      // Create message record
      const messageContent = this.extractMessageContent(message);
      // Use WhatsApp timestamp if available, otherwise use current time
      const messageSentAt = message.timestamp 
        ? new Date(parseInt(message.timestamp) * 1000)
        : new Date();
      
      const savedMessage = await prisma.message.create({
          data: {
            conversationId: conversation.id,
          content: messageContent,
            type: this.mapMessageType(message.type) as any,
            sender: 'CUSTOMER',
            sentAt: messageSentAt,
            metadata: {
              whatsappMessageId: message.id,
              messageType: message.type,
              ...(message.image && { imageId: message.image.id }),
              ...(message.document && { documentId: message.document.id }),
              ...(message.audio && { audioId: message.audio.id }),
              ...(message.video && { videoId: message.video.id })
            }
          }
        });

      logger.info('Message saved to database', {
        messageId: savedMessage.id,
        conversationId: conversation.id,
        content: messageContent.substring(0, 50)
        });

        // Update conversation last message
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessage: new Date() }
        });

      // Emit Socket.IO event for real-time updates
      const io = getSocketInstance();
      if (io) {
        io.to(`conversation:${conversation.id}`).emit('message:new', savedMessage);

        if (conversation.userId) {
          io.to(`user:${conversation.userId}`).emit('message:new', {
            ...savedMessage,
            conversation: {
              id: conversation.id,
              leadName: lead?.name || contactName
            }
          });
        }
      }

      // Create notification for new message
      // Notify assigned agent if conversation is assigned, otherwise notify all agents/managers for the gym
      const { notifyNewMessage } = await import('./notification.service');
      const messagePreview = messageContent.length > 100 
        ? messageContent.substring(0, 100) + '...' 
        : messageContent;

      if (conversation.userId) {
        // Notify assigned agent
        try {
          await notifyNewMessage(conversation.userId, {
            id: savedMessage.id,
            conversationId: conversation.id,
            content: messagePreview,
            senderName: lead?.name || contactName,
            senderId: lead?.id
          });

          // Emit Socket.IO notification event
          if (io) {
            io.to(`user:${conversation.userId}`).emit('notification', {
              type: 'NEW_MESSAGE',
              title: `New message from ${lead?.name || contactName}`,
              message: messagePreview,
              data: {
                conversationId: conversation.id,
                messageId: savedMessage.id,
                senderName: lead?.name || contactName,
                senderId: lead?.id
              }
            });
          }
        } catch (error) {
          logger.error('Failed to create notification for assigned agent:', error);
        }
      } else {
        // Notify all agents and managers for this gym
        const gymUsers = await prisma.gymUser.findMany({
          where: {
            gymId: gymId,
            role: { in: ['AGENT', 'MANAGER'] },
            user: {
              status: 'ACTIVE',
              isDeleted: false
            }
          },
          select: {
            userId: true,
            user: {
              select: {
                id: true,
                status: true
              }
            }
          }
        });

        for (const gymUser of gymUsers) {
          try {
            await notifyNewMessage(gymUser.userId, {
              id: savedMessage.id,
              conversationId: conversation.id,
              content: messagePreview,
              senderName: lead?.name || contactName,
              senderId: lead?.id
            });

            // Emit Socket.IO notification event
            if (io) {
              io.to(`user:${gymUser.userId}`).emit('notification', {
                type: 'NEW_MESSAGE',
                title: `New message from ${lead?.name || contactName}`,
                message: messagePreview,
                data: {
                  conversationId: conversation.id,
                  messageId: savedMessage.id,
                  senderName: lead?.name || contactName,
                  senderId: lead?.id
                }
              });
            }
          } catch (error) {
            logger.error(`Failed to create notification for user ${gymUser.userId}:`, error);
          }
        }
      }

      // Check if message indicates client wants to talk with a real person
      const messageLower = messageContent.toLowerCase();
      const humanAssistanceKeywords = [
        'quero falar com uma pessoa',
        'quero falar com alguém',
        'quero falar com atendente',
        'quero falar com humano',
        'quero falar com pessoa real',
        'preciso falar com alguém',
        'preciso falar com atendente',
        'preciso falar com humano',
        'preciso falar com pessoa',
        'falar com pessoa',
        'falar com humano',
        'falar com atendente',
        'atendente humano',
        'pessoa real',
        'i want to talk to a person',
        'i want to talk to someone',
        'i want to talk to a human',
        'i want to speak with someone',
        'i want to speak with a person',
        'i want to speak with a human',
        'talk to a person',
        'talk to someone',
        'talk to a human',
        'speak with someone',
        'speak with a person',
        'speak with a human',
        'human agent',
        'real person',
        'live agent',
        'human support'
      ];
      
      const wantsHumanAssistance = humanAssistanceKeywords.some(keyword => messageLower.includes(keyword));
      
      // Check if message indicates client wants to speak with a counselor
      const counselorKeywords = [
        'quero falar com um consultor',
        'quero falar com consultor',
        'quero falar com conselheiro',
        'quero falar com um conselheiro',
        'preciso falar com consultor',
        'preciso falar com um consultor',
        'preciso falar com conselheiro',
        'preciso falar com um conselheiro',
        'falar com consultor',
        'falar com conselheiro',
        'consultor',
        'conselheiro',
        'orientador',
        'quero consultoria',
        'preciso de consultoria',
        'i want to speak with a counselor',
        'i want to talk to a counselor',
        'i need to speak with a counselor',
        'i need to talk to a counselor',
        'speak with counselor',
        'talk to counselor',
        'counselor',
        'consultant',
        'advisor',
        'i need counseling',
        'i want counseling'
      ];
      
      const wantsCounselor = counselorKeywords.some(keyword => messageLower.includes(keyword));
      
      if (wantsHumanAssistance) {
        const { notifyMultipleUsers } = await import('./notification.service');
        
        // Get all agents and managers for this gym
        const gymUsers = await prisma.gymUser.findMany({
          where: {
            gymId: gymId,
            role: { in: ['AGENT', 'MANAGER'] },
            user: {
              status: 'ACTIVE',
              isDeleted: false
            }
          },
          select: {
            userId: true,
            role: true
          }
        });
        
        // Notify both AGENT and MANAGER users
        const userIds = gymUsers.map(gu => gu.userId);
        if (userIds.length > 0) {
          const notificationData = {
            type: 'HUMAN_ASSISTANCE_REQUESTED' as const,
            title: `Human assistance requested by ${lead?.name || contactName}`,
            message: `A client has requested to speak with a real person in conversation`,
            data: {
              conversationId: conversation.id,
              leadId: lead?.id,
              leadName: lead?.name || contactName,
              messageId: savedMessage.id,
              readStatus: {
                readByAgent: false,
                readByManager: false,
                agentReadAt: null,
                managerReadAt: null
              }
            }
          };
          
          await notifyMultipleUsers(userIds, notificationData);
          
          // Emit Socket.IO notification events
          if (io) {
            userIds.forEach(userId => {
              io.to(`user:${userId}`).emit('notification', {
                type: 'HUMAN_ASSISTANCE_REQUESTED',
                title: notificationData.title,
                message: notificationData.message,
                data: notificationData.data
              });
            });
          }
        }
        
        logger.info('Human assistance notification sent', {
          conversationId: conversation.id,
          leadId: lead?.id,
          messageId: savedMessage.id
        });
      }
      
      // Handle counselor connection request
      if (wantsCounselor) {
        try {
          // Send automatic message to customer connecting them with a counselor
          const counselorMessage = `Olá! Entendemos que você gostaria de falar com um consultor. Estamos conectando você com um de nossos consultores especializados. Em breve, você receberá uma mensagem de um consultor que poderá ajudá-lo melhor.\n\nObrigado pela sua paciência!`;
          
          // Send message via WhatsApp
          await this.sendTextMessage(message.from, counselorMessage, gymId);
          
          // Save counselor connection message to conversation
          const counselorMessageRecord = await prisma.message.create({
            data: {
              conversationId: conversation.id,
              content: counselorMessage,
              type: 'TEXT',
              sender: 'AI',
              sentAt: new Date(),
              metadata: {
                autoCounselorConnection: true,
                triggeredBy: savedMessage.id
              }
            }
          });
          
          // Update conversation last message
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { lastMessage: new Date() }
          });
          
          // Emit Socket.IO event for real-time updates
          if (io) {
            io.to(`conversation:${conversation.id}`).emit('message:new', counselorMessageRecord);
          }
          
          // Notify gym's agent about counselor connection request
          const { notifyHumanAssistanceRequested, notifyMultipleUsers } = await import('./notification.service');
          
          if (conversation.userId) {
            // Notify assigned agent
            try {
              await notifyHumanAssistanceRequested(conversation.userId, {
                conversationId: conversation.id,
                leadId: lead?.id,
                leadName: lead?.name || contactName,
                messageId: savedMessage.id
              });
              
              // Emit Socket.IO notification event
              if (io) {
                io.to(`user:${conversation.userId}`).emit('notification', {
                  type: 'HUMAN_ASSISTANCE_REQUESTED',
                  title: `Cliente solicitou conexão com consultor: ${lead?.name || contactName}`,
                  message: `Um cliente solicitou falar com um consultor. Uma mensagem automática foi enviada conectando-o com um consultor.`,
                  data: {
                    conversationId: conversation.id,
                    leadId: lead?.id,
                    leadName: lead?.name || contactName,
                    messageId: savedMessage.id,
                    counselorRequest: true
                  }
                });
              }
            } catch (error) {
              logger.error('Failed to create counselor notification for assigned agent:', error);
            }
          } else {
            // Notify all agents and managers for this gym
            const gymUsers = await prisma.gymUser.findMany({
              where: {
                gymId: gymId,
                role: { in: ['AGENT', 'MANAGER'] },
                user: {
                  status: 'ACTIVE',
                  isDeleted: false
                }
              },
              select: {
                userId: true
              }
            });
            
            const userIds = gymUsers.map(gu => gu.userId);
            if (userIds.length > 0) {
              await notifyMultipleUsers(userIds, {
                type: 'HUMAN_ASSISTANCE_REQUESTED',
                title: `Cliente solicitou conexão com consultor: ${lead?.name || contactName}`,
                message: `Um cliente solicitou falar com um consultor. Uma mensagem automática foi enviada conectando-o com um consultor.`,
                data: {
                  conversationId: conversation.id,
                  leadId: lead?.id,
                  leadName: lead?.name || contactName,
                  messageId: savedMessage.id,
                  counselorRequest: true
                }
              });
              
              // Emit Socket.IO notification events
              if (io) {
                userIds.forEach(userId => {
                  io.to(`user:${userId}`).emit('notification', {
                    type: 'HUMAN_ASSISTANCE_REQUESTED',
                    title: `Cliente solicitou conexão com consultor: ${lead?.name || contactName}`,
                    message: `Um cliente solicitou falar com um consultor. Uma mensagem automática foi enviada conectando-o com um consultor.`,
                    data: {
                      conversationId: conversation.id,
                      leadId: lead?.id,
                      leadName: lead?.name || contactName,
                      messageId: savedMessage.id,
                      counselorRequest: true
                    }
                  });
                });
              }
            }
          }
          
          logger.info('Counselor connection message sent and notification created', {
            conversationId: conversation.id,
            leadId: lead?.id,
            messageId: savedMessage.id,
            counselorMessageId: counselorMessageRecord.id
          });
        } catch (error) {
          logger.error('Error handling counselor connection request:', error);
          // Don't throw - counselor connection failure shouldn't break message processing
        }
      }

      // Log message activity
      await this.logMessageActivity(message.from, messageContent, 'received', gymId);

      // Handle qualification flow - extract and update qualification data
      const qualificationState = await qualificationFlowService.getQualificationState(conversation.id);
      if (qualificationState && !qualificationState.isComplete) {
        const aiPrompt = await aiPromptService.getAIPrompt(gymId).catch(() => null);
        const qualificationFlow = aiPrompt?.qualificationFlow as any;
        const flowSteps = qualificationFlow?.steps || [];
        
        // Try to extract field values from the message
        for (const step of flowSteps) {
          const field = step.field as keyof import('./qualificationFlow.service').QualificationData;
          const value = qualificationFlowService.extractFieldValue(messageContent, step.field);
          
          if (value && !qualificationState.collectedData[field]) {
            await qualificationFlowService.updateQualificationData(
              conversation.id,
              field,
              value
            );
            logger.info('Qualification data updated', {
              conversationId: conversation.id,
              field,
              hasValue: !!value
            });
            break; // Only extract one field per message
          }
        }
      }

      // Check if message indicates registration intent
      const registrationKeywords = [
        'quero me registrar',
        'quero me cadastrar',
        'quero fazer matrícula',
        'quero me matricular',
        'quero me inscrever',
        'register',
        'sign up',
        'become a member',
        'join the gym',
        'membership',
        'cadastro',
        'matrícula',
        'inscrição',
        'registro'
      ];
      
      const wantsToRegister = registrationKeywords.some(keyword => messageLower.includes(keyword));
      
      if (wantsToRegister && (!qualificationState || !qualificationState.isComplete)) {
        // Start qualification flow if not already started
        const state = await qualificationFlowService.getQualificationState(conversation.id);
        if (state && !state.isComplete) {
          const aiPrompt = await aiPromptService.getAIPrompt(gymId).catch(() => null);
          const qualificationFlow = aiPrompt?.qualificationFlow as any;
          const nextQuestion = qualificationFlowService.getNextQuestion(state, qualificationFlow);
          
          if (nextQuestion) {
            // Send the qualification question via WhatsApp
            await this.sendTextMessage(lead.phone, nextQuestion, gymId);
            
            // Save the question as an AI message
            await prisma.message.create({
              data: {
                conversationId: conversation.id,
                content: nextQuestion,
                type: 'TEXT',
                sender: 'AI',
                metadata: {
                  qualificationFlow: true,
                  step: 'collecting'
                }
              }
            });
            
            // Emit Socket.IO event
            const io = getSocketInstance();
            if (io) {
              io.to(`conversation:${conversation.id}`).emit('message:new', {
                id: 'temp',
                conversationId: conversation.id,
                content: nextQuestion,
                type: 'TEXT',
                sender: 'AI',
                sentAt: new Date()
              });
            }
            
            logger.info('Qualification flow question sent', {
              conversationId: conversation.id,
              question: nextQuestion.substring(0, 50)
            });
            
            return; // Don't trigger regular AI response
          }
        }
      }

      // Generate and send AI response for existing conversations (greeting already sent for new ones)
      if (!isNewConversation) {
        await this.handleAIResponse(messageContent, conversation.id, gymId);
      }

      logger.info(`WhatsApp message processed successfully from ${message.from}: ${message.id}`);
    } catch (error) {
      logger.error('Error handling incoming WhatsApp message:', {
        error: error instanceof Error ? error.message : error,
        messageId: message?.id,
        from: message?.from,
        gymId
      });
      throw error;
    }
  }

  /**
   * Handle message status updates
   */
  private async handleMessageStatus(status: any, _gymId?: string): Promise<void> {
    try {
      // Find conversation by WhatsApp message ID
      const message = await prisma.message.findFirst({
        where: {
          metadata: {
            path: ['whatsappMessageId'],
            equals: status.id
          }
        },
        include: {
          conversation: true
        }
      });

      if (message) {
        const updateData: any = {};
        
        switch (status.status) {
          case 'delivered':
            updateData.deliveredAt = new Date(parseInt(status.timestamp) * 1000);
            break;
          case 'read':
            updateData.readAt = new Date(parseInt(status.timestamp) * 1000);
            break;
          case 'failed':
            updateData.metadata = {
              ...(message.metadata as any || {}),
              error: status.errors?.[0] || 'Unknown error'
            };
            break;
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.message.update({
            where: { id: message.id },
            data: updateData as any
          });
        }
      }

      logger.info(`WhatsApp message status updated: ${status.id} - ${status.status}`);
    } catch (error) {
      logger.error('Error handling WhatsApp message status:', error);
      throw error;
    }
  }

  /**
   * Extract message content based on type
   */
  private extractMessageContent(message: WhatsAppWebhookMessage): string {
    switch (message.type) {
      case 'text':
        return message.text?.body || '';
      case 'image':
        return message.image?.caption || '[Image]';
      case 'document':
        return message.document?.caption || `[Document: ${message.document?.filename || 'Unknown'}]`;
      case 'audio':
        return '[Audio]';
      case 'video':
        return message.video?.caption || '[Video]';
      default:
        return `[${message.type}]`;
    }
  }

  /**
   * Map WhatsApp message type to internal type
   */
  private mapMessageType(whatsappType: string): string {
    switch (whatsappType) {
      case 'text':
        return 'TEXT';
      case 'image':
        return 'IMAGE';
      case 'document':
        return 'DOCUMENT';
      case 'audio':
        return 'AUDIO';
      case 'video':
        return 'VIDEO';
      default:
        return 'TEXT';
    }
  }

  /**
   * Log message activity
   */
  private async logMessageActivity(
    phoneNumber: string,
    content: string,
    direction: 'sent' | 'received',
    gymId: string
  ): Promise<void> {
    try {
      await prisma.activityLog.create({
        data: {
          type: ActivityType.MESSAGE_SENT,
          description: `WhatsApp message ${direction}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
          userId: undefined,
          gymId,
          metadata: {
            phoneNumber,
            direction,
            content: content.substring(0, 500) // Limit content length
          }
        }
      });
    } catch (error) {
      logger.error('Error logging WhatsApp message activity:', error);
    }
  }

  /**
   * Send automatic greeting message for new conversations
   */
  private async sendAutoGreeting(phoneNumber: string, gymId: string, conversationId: string, customerMessageTime?: Date): Promise<void> {
    try {
      // Get gym information
      const gym = await prisma.gym.findUnique({
        where: { id: gymId },
            select: {
          name: true,
          state: true,
          city: true
        }
      });

      // Get AI prompt with greeting message
      const aiPrompt = await prisma.aIPrompt.findUnique({
        where: { gymId }
      });

      let greetingMessage = aiPrompt?.greetingMessage;
      
      // If no custom greeting, generate one based on gym info
      if (!greetingMessage && gym) {
        // Build greeting based on gym information
        const gymName = gym.name;
        const location = gym.state ? `in ${gym.state}` : '';
        
        greetingMessage = `🎉 Hello, welcome to ${gymName}${location ? `, ${location}` : ''}! 💪🔥\n\n👉 What's your question, or how can I help you today?\n\n🙌 If you're not yet a customer, to make your registration easier, please provide me with:\nFull name, CPF, date of birth, address + zip code, preferred workout time, gym goal, and email address.`;
      } else if (greetingMessage && gym) {
        // Replace placeholders in custom greeting
        greetingMessage = greetingMessage.replace(/{gym_name}/g, gym.name);
        if (gym.state) {
          greetingMessage = greetingMessage.replace(/{gym_state}/g, gym.state);
        }
        if (gym.city) {
          greetingMessage = greetingMessage.replace(/{gym_city}/g, gym.city);
        }
      } else {
        // Fallback if no gym info
        greetingMessage = '🎉 Hello, welcome! 💪🔥\n\n👉 What\'s your question, or how can I help you today?\n\n🙌 If you\'re not yet a customer, to make your registration easier, please provide me with:\nFull name, CPF, date of birth, address + zip code, preferred workout time, gym goal, and email address.';
      }

      // Send greeting via WhatsApp
      await this.sendTextMessage(phoneNumber, greetingMessage, gymId);

      // Save greeting message to conversation
      // Set sentAt to be before the customer message to ensure it appears first
      let greetingSentAt: Date;
      if (customerMessageTime) {
        // Set greeting to 1 second before customer message
        greetingSentAt = new Date(customerMessageTime.getTime() - 1000);
      } else {
        // Fallback: use conversation creation time minus 1 second
        const conversationCreatedAt = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { createdAt: true }
        });
        greetingSentAt = conversationCreatedAt 
          ? new Date(conversationCreatedAt.createdAt.getTime() - 1000)
          : new Date(Date.now() - 2000);
      }
      
      const greetingMessageRecord = await prisma.message.create({
        data: {
          conversationId,
          content: greetingMessage,
          type: 'TEXT',
          sender: 'AI',
          sentAt: greetingSentAt,
          metadata: {
            autoGreeting: true
          }
        }
      });

      // Update conversation last message
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessage: new Date() }
      });

      // Emit Socket.IO event for real-time updates
      const io = getSocketInstance();
      if (io) {
        io.to(`conversation:${conversationId}`).emit('message:new', greetingMessageRecord);
      }

      logger.info(`Auto-greeting sent to ${phoneNumber} for gym ${gymId}`);
    } catch (error) {
      logger.error('Error sending auto-greeting:', error);
      // Don't throw - auto-greeting failure shouldn't break message processing
    }
  }

  /**
   * Handle AI response for incoming customer messages
   */
  private async handleAIResponse(
    customerMessage: string,
    conversationId: string,
    gymId: string
  ): Promise<void> {
    try {
      // Check if AI should respond
      const shouldRespond = await aiService.shouldGenerateResponse(conversationId);
      if (!shouldRespond) {
        logger.info(`Skipping AI response for conversation ${conversationId}`);
        return;
      }

      // Get conversation to find lead phone number
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          lead: {
            select: {
              phone: true,
              name: true,
              gym: {
                select: {
                  name: true,
                  address: true
                }
              }
            }
          }
        }
      });

      if (!conversation || !conversation.lead.phone) {
        logger.warn(`Cannot send AI response: conversation or phone not found for ${conversationId}`);
        return;
      }

      // Get AI prompt configuration for message analysis
      let objectionHandling: any = null;
      let faqs: any = null;
      let escalationRules: any = null;
      
      try {
        const aiPrompt = await aiPromptService.getAIPrompt(gymId);
        objectionHandling = aiPrompt.objectionHandling;
        faqs = aiPrompt.faqs;
        escalationRules = aiPrompt.escalationRules;
      } catch (error) {
        // Use default template if not configured
        const defaultTemplate = aiPromptService.getDefaultPromptTemplate();
        objectionHandling = defaultTemplate.objectionHandling;
        faqs = defaultTemplate.faqs;
        escalationRules = defaultTemplate.escalationRules;
      }

      // Analyze message (Phase 1: Message Analysis)
      const messageAnalysis = await messageAnalysisService.analyzeMessage(
        customerMessage,
        gymId,
        objectionHandling,
        faqs,
        escalationRules
      );

      // Log analysis results
      logger.info('Message analysis completed', {
        conversationId,
        intent: messageAnalysis.intent.type,
        hasObjection: !!messageAnalysis.objection,
        hasFAQMatch: !!messageAnalysis.faqMatch,
        requiresEscalation: messageAnalysis.requiresEscalation,
        sentiment: messageAnalysis.sentiment
      });

      // Use Response Strategy Service to determine best response (Phase 5)
      const gymInfo = conversation.lead.gym;
      const strategy = await responseStrategyService.determineStrategy(
        customerMessage,
        conversationId,
        gymId,
        messageAnalysis,
        conversation.lead.name || undefined,
        gymInfo?.name || undefined
      );

      // Validate response quality
      const validation = responseStrategyService.validateResponse(strategy.response);
      if (!validation.isValid) {
        logger.warn('Response validation failed', {
          conversationId,
          issues: validation.issues,
          strategy: strategy.type
        });
        // Continue with response anyway, but log the issues
      }

      // Enhance response with personalization
      let responseText = await responseStrategyService.enhanceResponse(
        strategy.response,
        conversationId,
        conversation.lead.name || undefined
      );

      // Send response via WhatsApp
      await this.sendTextMessage(conversation.lead.phone, responseText, gymId);

      // Save response to conversation
      const aiMessageRecord = await prisma.message.create({
        data: {
          conversationId,
          content: responseText,
          type: 'TEXT',
          sender: 'AI',
          metadata: {
            aiGenerated: strategy.type === 'ai',
            originalMessage: customerMessage.substring(0, 200), // Store first 200 chars for reference
            analysis: {
              intent: messageAnalysis.intent.type,
              hasObjection: !!messageAnalysis.objection,
              hasFAQMatch: !!messageAnalysis.faqMatch,
              sentiment: messageAnalysis.sentiment
            },
            responseStrategy: strategy.type,
            strategyConfidence: strategy.confidence,
            ...strategy.metadata
          }
        }
      });

      // Update conversation last message
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessage: new Date() }
      });

      // Emit Socket.IO event for real-time updates
      const io = getSocketInstance();
      if (io) {
        io.to(`conversation:${conversationId}`).emit('message:new', aiMessageRecord);
      }

      logger.info(`AI response sent successfully for conversation ${conversationId}`);
    } catch (error) {
      logger.error('Error handling AI response:', {
        error: error instanceof Error ? error.message : error,
        conversationId,
        gymId
      });
      // Don't throw - AI response failure shouldn't break message processing
    }
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhookSignature(_payload: string, signature: string): Promise<boolean> {
    // Get verify token from Meta config (shared across all gyms)
    const { getWebhookVerifyToken } = await import('./whatsappMetaConfig.service');
    const verifyToken = await getWebhookVerifyToken();
    
    if (!verifyToken) {
      logger.warn('WhatsApp webhook verify token not configured. Please set it via /api/whatsapp/meta-config endpoint or WHATSAPP_WEBHOOK_VERIFY_TOKEN environment variable.');
      return false;
    }

    // Log comparison (without exposing actual token values in production)
    const tokensMatch = signature === verifyToken;
    if (!tokensMatch) {
      logger.warn('Webhook verification failed - token mismatch', {
        receivedTokenLength: signature.length,
        expectedTokenLength: verifyToken.length,
        receivedTokenPrefix: signature.substring(0, 4),
        expectedTokenPrefix: verifyToken.substring(0, 4)
      });
    }

    // Simple verification - in production, use proper HMAC verification
    return tokensMatch;
  }

  /**
   * Get WhatsApp business profile
   */
  async getBusinessProfile(gymId: string): Promise<any> {
    try {
      const config = await this.getWhatsAppConfig(gymId);

      const url = `${this.baseUrl}/${this.apiVersion}/${config.phoneNumberId}/whatsapp_business_profile`;
      
      const response: AxiosResponse = await axios.get(url, {
        headers: this.getHeaders(config.accessToken)
      });

      return response.data;
    } catch (error) {
      logger.error('Error getting WhatsApp business profile:', error);
      throw error;
    }
  }

  /**
   * Update WhatsApp business profile
   */
  async updateBusinessProfile(profileData: any, gymId: string): Promise<any> {
    try {
      const config = await this.getWhatsAppConfig(gymId);

      const url = `${this.baseUrl}/${this.apiVersion}/${config.phoneNumberId}/whatsapp_business_profile`;
      
      const response: AxiosResponse = await axios.post(url, profileData, {
        headers: this.getHeaders(config.accessToken)
      });

      return response.data;
    } catch (error) {
      logger.error('Error updating WhatsApp business profile:', error);
      throw error;
    }
  }
}

export default new WhatsAppService();
