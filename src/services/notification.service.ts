import prisma from '../config/database';
import logger from '../utils/logger';

export interface CreateNotificationData {
  userId: string;
  type: 'NEW_LEAD' | 'NEW_MESSAGE' | 'FOLLOW_UP_DUE' | 'SYSTEM_ALERT' | 'LEAD_STATUS_CHANGE' | 'MEMBER_APPLICATION_RECEIVED' | 'MEMBER_APPLICATION_APPROVED' | 'MEMBER_APPLICATION_REJECTED' | 'HUMAN_ASSISTANCE_REQUESTED' | 'REGISTRATION_REQUEST_CREATED' | 'REGISTRATION_REQUEST_APPROVED' | 'REGISTRATION_REQUEST_REJECTED';
  title: string;
  message: string;
  data?: any;
}

export interface NotificationFilters {
  userId: string;
  read?: boolean;
  type?: string;
  limit?: number;
  offset?: number;
}

/**
 * Create a new notification
 */
export async function createNotification(notificationData: CreateNotificationData) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: notificationData.userId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data || {},
        read: false
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    logger.info(`Notification created: ${notification.id} for user ${notificationData.userId}`);

    return notification;
  } catch (error) {
    logger.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Get all notifications for a user
 */
export async function getUserNotifications(filters: NotificationFilters, userRole?: string) {
  try {
    const {
      userId,
      read,
      type,
      limit = 50,
      offset = 0
    } = filters;

    const where: any = {
      userId
    };

    if (read !== undefined) {
      where.read = read;
    }

    if (type) {
      where.type = type;
    }

    // Get user role if not provided
    let role = userRole;
    if (!role) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });
      role = user?.role;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.notification.count({ where })
    ]);

    // For MANAGER users viewing HUMAN_ASSISTANCE_REQUESTED notifications,
    // enrich with agent read status from agent notifications
    if (role === 'MANAGER') {
      // Get all HUMAN_ASSISTANCE_REQUESTED notifications
      const humanAssistanceNotifications = notifications.filter(
        n => n.type === 'HUMAN_ASSISTANCE_REQUESTED'
      );
      
      if (humanAssistanceNotifications.length > 0) {
        // Get user's gyms
        const userGyms = await prisma.gymUser.findMany({
          where: { userId },
          select: { gymId: true }
        });
        const gymIds = userGyms.map(ug => ug.gymId);
        
        if (gymIds.length > 0) {
          // Get all agent users in the same gyms
          const agentGymUsers = await prisma.gymUser.findMany({
            where: {
              gymId: { in: gymIds },
              role: 'AGENT',
              user: {
                status: 'ACTIVE',
                isDeleted: false
              }
            },
            select: {
              userId: true
            }
          });
          const agentUserIds = agentGymUsers.map(agu => agu.userId);
          
          if (agentUserIds.length > 0) {
            // Get all agent notifications of type HUMAN_ASSISTANCE_REQUESTED
            const agentNotifications = await prisma.notification.findMany({
              where: {
                userId: { in: agentUserIds },
                type: 'HUMAN_ASSISTANCE_REQUESTED'
              },
              select: {
                id: true,
                data: true,
                read: true
              }
            });
            
            // Create a map of conversationId/messageId to agent read status
            const agentReadStatusMap = new Map<string, any>();
            agentNotifications.forEach(agentNotif => {
              const agentData = agentNotif.data as any;
              const key = agentData?.conversationId || agentData?.messageId;
              if (key) {
                const readStatus = agentData?.readStatus || {};
                agentReadStatusMap.set(key, {
                  readByAgent: readStatus.readByAgent || agentNotif.read,
                  agentReadAt: readStatus.agentReadAt || null
                });
              }
            });
            
            // Enrich manager notifications with agent read status
            const enrichedNotifications = notifications.map(notification => {
              if (notification.type === 'HUMAN_ASSISTANCE_REQUESTED' && notification.data) {
                const data = notification.data as any;
                const key = data.conversationId || data.messageId;
                
                if (key && agentReadStatusMap.has(key)) {
                  const agentStatus = agentReadStatusMap.get(key);
                  data.readStatus = {
                    ...(data.readStatus || {}),
                    readByAgent: agentStatus.readByAgent,
                    agentReadAt: agentStatus.agentReadAt
                  };
                  
                  return {
                    ...notification,
                    data
                  };
                }
              }
              return notification;
            });
            
            return {
              notifications: enrichedNotifications,
              total,
              hasMore: offset + limit < total
            };
          }
        }
      }
    }

    return {
      notifications,
      total,
      hasMore: offset + limit < total
    };
  } catch (error) {
    logger.error('Error getting user notifications:', error);
    throw error;
  }
}

/**
 * Get notification by ID
 */
export async function getNotificationById(notificationId: string, userRole?: string) {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    // For MANAGER users viewing HUMAN_ASSISTANCE_REQUESTED notifications,
    // enrich with agent read status
    if (userRole === 'MANAGER' && notification.type === 'HUMAN_ASSISTANCE_REQUESTED' && notification.data) {
      const data = notification.data as any;
      const conversationId = data.conversationId;
      const messageId = data.messageId;
      
      if (conversationId || messageId) {
        // Get user's gyms
        const userGyms = await prisma.gymUser.findMany({
          where: { userId: notification.userId },
          select: { gymId: true }
        });
        const gymIds = userGyms.map(ug => ug.gymId);
        
        if (gymIds.length > 0) {
          // Get all agent users in the same gyms
          const agentGymUsers = await prisma.gymUser.findMany({
            where: {
              gymId: { in: gymIds },
              role: 'AGENT',
              user: {
                status: 'ACTIVE',
                isDeleted: false
              }
            },
            select: {
              userId: true
            }
          });
          const agentUserIds = agentGymUsers.map(agu => agu.userId);
          
          if (agentUserIds.length > 0) {
            // Find agent notification for the same conversation/message
            const agentNotifications = await prisma.notification.findMany({
              where: {
                userId: { in: agentUserIds },
                type: 'HUMAN_ASSISTANCE_REQUESTED'
              },
              select: {
                data: true,
                read: true
              }
            });
            
            // Find matching agent notification by conversationId or messageId
            const matchingAgentNotif = agentNotifications.find(agentNotif => {
              const agentData = agentNotif.data as any;
              return agentData?.conversationId === conversationId || agentData?.messageId === messageId;
            });
            
            if (matchingAgentNotif) {
              const agentData = matchingAgentNotif.data as any;
              const agentReadStatus = agentData?.readStatus || {};
              
              // Merge agent read status into manager's notification data
              data.readStatus = {
                ...(data.readStatus || {}),
                readByAgent: agentReadStatus.readByAgent || matchingAgentNotif.read,
                agentReadAt: agentReadStatus.agentReadAt || null
              };
              
              return {
                ...notification,
                data
              };
            }
          }
        }
      }
    }

    return notification;
  } catch (error) {
    logger.error('Error getting notification by ID:', error);
    throw error;
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string, userId: string, userRole?: string) {
  try {
    // Verify the notification belongs to the user
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId
      },
      include: {
        user: {
          select: {
            role: true
          }
        }
      }
    });

    if (!notification) {
      throw new Error('Notification not found or access denied');
    }

    // Get user role if not provided
    const role = userRole || notification.user.role;
    
    // For HUMAN_ASSISTANCE_REQUESTED notifications, track read status by role
    if (notification.type === 'HUMAN_ASSISTANCE_REQUESTED') {
      const data = (notification.data as any) || {};
      const readStatus = data.readStatus || {};
      
      // Update read status based on user role
      if (role === 'AGENT') {
        readStatus.readByAgent = true;
        readStatus.agentReadAt = new Date().toISOString();
      } else if (role === 'MANAGER') {
        readStatus.readByManager = true;
        readStatus.managerReadAt = new Date().toISOString();
      }
      
      // Mark as read if either agent or manager has read it
      const isRead = readStatus.readByAgent || readStatus.readByManager;
      
      const updatedNotification = await prisma.notification.update({
        where: { id: notificationId },
        data: { 
          read: isRead,
          data: {
            ...data,
            readStatus
          }
        }
      });

      logger.info(`Notification marked as read by ${role}: ${notificationId}`);
      return updatedNotification;
    } else {
      // For other notification types, use standard read status
      const updatedNotification = await prisma.notification.update({
        where: { id: notificationId },
        data: { read: true }
      });

      logger.info(`Notification marked as read: ${notificationId}`);
      return updatedNotification;
    }
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string) {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        read: false
      },
      data: {
        read: true
      }
    });

    logger.info(`Marked ${result.count} notifications as read for user ${userId}`);

    return result.count;
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    throw error;
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string) {
  try {
    const count = await prisma.notification.count({
      where: {
        userId,
        read: false
      }
    });

    return count;
  } catch (error) {
    logger.error('Error getting unread count:', error);
    throw error;
  }
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId: string, userId: string) {
  try {
    // Verify the notification belongs to the user
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId
      }
    });

    if (!notification) {
      throw new Error('Notification not found or access denied');
    }

    await prisma.notification.delete({
      where: { id: notificationId }
    });

    logger.info(`Notification deleted: ${notificationId}`);
  } catch (error) {
    logger.error('Error deleting notification:', error);
    throw error;
  }
}

/**
 * Delete all read notifications for a user
 */
export async function deleteReadNotifications(userId: string) {
  try {
    const result = await prisma.notification.deleteMany({
      where: {
        userId,
        read: true
      }
    });

    logger.info(`Deleted ${result.count} read notifications for user ${userId}`);

    return result.count;
  } catch (error) {
    logger.error('Error deleting read notifications:', error);
    throw error;
  }
}

/**
 * Helper function to create notification for new lead
 */
export async function notifyNewLead(userId: string, leadData: any) {
  return createNotification({
    userId,
    type: 'NEW_LEAD',
    title: `New lead: ${leadData.name}`,
    message: `A new lead has been created and assigned to you`,
    data: {
      leadId: leadData.id,
      leadName: leadData.name,
      source: leadData.source,
      score: leadData.score
    }
  });
}

/**
 * Helper function to create notification for new message
 */
export async function notifyNewMessage(userId: string, messageData: any) {
  return createNotification({
    userId,
    type: 'NEW_MESSAGE',
    title: `New message from ${messageData.senderName}`,
    message: messageData.content,
    data: {
      conversationId: messageData.conversationId,
      messageId: messageData.id,
      senderId: messageData.senderId,
      senderName: messageData.senderName
    }
  });
}

/**
 * Helper function to create notification for follow-up due
 */
export async function notifyFollowUpDue(userId: string, followUpData: any) {
  return createNotification({
    userId,
    type: 'FOLLOW_UP_DUE',
    title: `Follow-up due with ${followUpData.leadName}`,
    message: `You have a scheduled ${followUpData.type.toLowerCase()} at ${followUpData.scheduledTime}`,
    data: {
      followUpId: followUpData.id,
      leadId: followUpData.leadId,
      leadName: followUpData.leadName,
      type: followUpData.type,
      scheduledAt: followUpData.scheduledAt
    }
  });
}

/**
 * Helper function to create notification for lead status change
 */
export async function notifyLeadStatusChange(userId: string, statusData: any) {
  return createNotification({
    userId,
    type: 'LEAD_STATUS_CHANGE',
    title: `Lead status changed: ${statusData.leadName}`,
    message: `${statusData.leadName} moved from ${statusData.oldStatus} to ${statusData.newStatus}`,
    data: {
      leadId: statusData.leadId,
      leadName: statusData.leadName,
      oldStatus: statusData.oldStatus,
      newStatus: statusData.newStatus
    }
  });
}

/**
 * Helper function to create system alert notification
 */
export async function notifySystemAlert(userId: string, alertData: any) {
  return createNotification({
    userId,
    type: 'SYSTEM_ALERT',
    title: alertData.title,
    message: alertData.message,
    data: alertData.data || {}
  });
}

/**
 * Helper function to create notification for member application received
 */
export async function notifyMemberApplicationReceived(userId: string, memberData: any) {
  return createNotification({
    userId,
    type: 'MEMBER_APPLICATION_RECEIVED',
    title: `New member application: ${memberData.fullName}`,
    message: `A new member application has been received and requires your review`,
    data: {
      memberId: memberData.id,
      memberName: memberData.fullName,
      gymId: memberData.gymId,
      leadId: memberData.leadId
    }
  });
}

/**
 * Helper function to create notification for member application approved
 */
export async function notifyMemberApplicationApproved(userId: string, memberData: any) {
  return createNotification({
    userId,
    type: 'MEMBER_APPLICATION_APPROVED',
    title: `Member application approved: ${memberData.fullName}`,
    message: `The member application for ${memberData.fullName} has been approved`,
    data: {
      memberId: memberData.id,
      memberName: memberData.fullName,
      gymId: memberData.gymId,
      planId: memberData.planId
    }
  });
}

/**
 * Helper function to create notification for member application rejected
 */
export async function notifyMemberApplicationRejected(userId: string, memberData: any) {
  return createNotification({
    userId,
    type: 'MEMBER_APPLICATION_REJECTED',
    title: `Member application rejected: ${memberData.fullName}`,
    message: `The member application for ${memberData.fullName} has been rejected`,
    data: {
      memberId: memberData.id,
      memberName: memberData.fullName,
      gymId: memberData.gymId
    }
  });
}

/**
 * Helper function to notify multiple users (e.g., all agents in a gym)
 */
export async function notifyMultipleUsers(userIds: string[], notificationData: Omit<CreateNotificationData, 'userId'>) {
  // Ensure readStatus is included for HUMAN_ASSISTANCE_REQUESTED notifications
  let finalNotificationData = { ...notificationData };
  if (notificationData.type === 'HUMAN_ASSISTANCE_REQUESTED' && notificationData.data) {
    const data = notificationData.data as any;
    if (!data.readStatus) {
      finalNotificationData = {
        ...notificationData,
        data: {
          ...data,
          readStatus: {
            readByAgent: false,
            readByManager: false,
            agentReadAt: null,
            managerReadAt: null
          }
        }
      };
    }
  }
  
  const notifications = [];
  for (const userId of userIds) {
    try {
      const notification = await createNotification({
        ...finalNotificationData,
        userId
      });
      notifications.push(notification);
    } catch (error) {
      logger.error(`Failed to create notification for user ${userId}:`, error);
    }
  }
  return notifications;
}

/**
 * Helper function to create notification for human assistance request
 */
export async function notifyHumanAssistanceRequested(userId: string, conversationData: any) {
  return createNotification({
    userId,
    type: 'HUMAN_ASSISTANCE_REQUESTED',
    title: `Human assistance requested by ${conversationData.leadName}`,
    message: `A client has requested to speak with a real person in conversation`,
    data: {
      conversationId: conversationData.conversationId,
      leadId: conversationData.leadId,
      leadName: conversationData.leadName,
      messageId: conversationData.messageId,
      readStatus: {
        readByAgent: false,
        readByManager: false,
        agentReadAt: null,
        managerReadAt: null
      }
    }
  });
}

