import logger from '../utils/logger';
import type { MessageAnalysis } from './messageAnalysis.service';
import objectionResponseService from './objectionResponse.service';
import faqResponseService from './faqResponse.service';
import aiService from './ai.service';
import prisma from '../config/database';

/**
 * Response Strategy Types
 */
export type ResponseStrategyType = 'objectionTemplate' | 'faq' | 'ai' | 'escalation';

/**
 * Response Strategy Result
 */
export interface ResponseStrategy {
  type: ResponseStrategyType;
  response: string;
  confidence: number;
  metadata?: Record<string, any>;
}

/**
 * Response Strategy Service
 * Implements intelligent decision tree for selecting the best response type
 */
class ResponseStrategyService {
  /**
   * Determine the best response strategy for a message
   */
  async determineStrategy(
    customerMessage: string,
    conversationId: string,
    gymId: string,
    messageAnalysis: MessageAnalysis,
    leadName?: string,
    gymName?: string
  ): Promise<ResponseStrategy> {
    try {
      // Decision Tree:
      // 1. Check for escalation requirements
      if (messageAnalysis.requiresEscalation) {
        return await this.handleEscalation(messageAnalysis);
      }

      // 2. Check for high-confidence objection with template
      if (messageAnalysis.objection && messageAnalysis.objection.confidence >= 0.7) {
        const objectionResult = objectionResponseService.generateResponse(
          messageAnalysis.objection,
          {
            gymName,
            leadName
          }
        );

        if (objectionResult?.text) {
          logger.info('Using objection template response', {
            conversationId,
            objectionType: messageAnalysis.objection.type,
            confidence: messageAnalysis.objection.confidence
          });

          return {
            type: 'objectionTemplate',
            response: objectionResult.text,
            confidence: objectionResult.confidence || messageAnalysis.objection.confidence,
            metadata: {
              objectionType: messageAnalysis.objection.type,
              intent: messageAnalysis.intent.type,
              sentiment: messageAnalysis.sentiment,
              ...objectionResult.metadata
            }
          };
        }
      }

      // 3. Check for high-confidence FAQ match
      if (messageAnalysis.faqMatch && messageAnalysis.faqMatch.matchScore >= 0.7) {
        const faqResult = faqResponseService.generateResponse(
          messageAnalysis.faqMatch,
          {
            gymName,
            leadName
          }
        );

        if (faqResult?.text) {
          logger.info('Using FAQ quick answer', {
            conversationId,
            faqQuestion: messageAnalysis.faqMatch.question,
            matchScore: messageAnalysis.faqMatch.matchScore
          });

          return {
            type: 'faq',
            response: faqResult.text,
            confidence: messageAnalysis.faqMatch.matchScore,
            metadata: {
              faqQuestion: messageAnalysis.faqMatch.question,
              faqMatchScore: messageAnalysis.faqMatch.matchScore,
              intent: messageAnalysis.intent.type,
              sentiment: messageAnalysis.sentiment,
              ...faqResult.metadata
            }
          };
        }
      }

      // 4. Check for medium-confidence objection (use AI with objection context)
      if (messageAnalysis.objection && messageAnalysis.objection.confidence >= 0.5) {
        logger.info('Using AI with objection context', {
          conversationId,
          objectionType: messageAnalysis.objection.type,
          confidence: messageAnalysis.objection.confidence
        });

        const aiResponse = await aiService.generateResponse(
          customerMessage,
          conversationId,
          gymId,
          messageAnalysis
        );

        if (aiResponse) {
          return {
            type: 'ai',
            response: aiResponse,
            confidence: 0.75,
            metadata: {
              objectionType: messageAnalysis.objection.type,
              intent: messageAnalysis.intent.type,
              sentiment: messageAnalysis.sentiment,
              hasObjectionContext: true
            }
          };
        }
      }

      // 5. Check for medium-confidence FAQ match (use AI with FAQ context)
      if (messageAnalysis.faqMatch && messageAnalysis.faqMatch.matchScore >= 0.5) {
        logger.info('Using AI with FAQ context', {
          conversationId,
          faqQuestion: messageAnalysis.faqMatch.question,
          matchScore: messageAnalysis.faqMatch.matchScore
        });

        const aiResponse = await aiService.generateResponse(
          customerMessage,
          conversationId,
          gymId,
          messageAnalysis
        );

        if (aiResponse) {
          return {
            type: 'ai',
            response: aiResponse,
            confidence: 0.7,
            metadata: {
              faqQuestion: messageAnalysis.faqMatch.question,
              faqMatchScore: messageAnalysis.faqMatch.matchScore,
              intent: messageAnalysis.intent.type,
              sentiment: messageAnalysis.sentiment,
              hasFAQContext: true
            }
          };
        }
      }

      // 6. Default: Full AI response with all context
      logger.info('Using full AI response', {
        conversationId,
        intent: messageAnalysis.intent.type
      });

      const aiResponse = await aiService.generateResponse(
        customerMessage,
        conversationId,
        gymId,
        messageAnalysis
      );

      if (aiResponse) {
        return {
          type: 'ai',
          response: aiResponse,
          confidence: 0.6,
          metadata: {
            intent: messageAnalysis.intent.type,
            sentiment: messageAnalysis.sentiment
          }
        };
      }

      // 7. Fallback: Generic response if AI fails
      return this.getFallbackResponse(messageAnalysis);
    } catch (error: any) {
      logger.error('Error determining response strategy:', {
        error: error.message,
        conversationId,
        gymId
      });

      // Return safe fallback on error
      return this.getFallbackResponse(messageAnalysis);
    }
  }

  /**
   * Handle escalation requirements
   */
  private async handleEscalation(
    messageAnalysis: MessageAnalysis
  ): Promise<ResponseStrategy> {
    logger.warn('Message requires escalation', {
      reason: messageAnalysis.escalationReason
    });

    // Return a response that indicates escalation is needed
    // In the future, this could trigger notifications to agents
    const escalationMessage = `I understand your concern. Let me connect you with one of our team members who can better assist you. Please hold on while I transfer your conversation.`;

    return {
      type: 'escalation',
      response: escalationMessage,
      confidence: 1.0,
      metadata: {
        requiresHumanReview: true,
        escalationReason: messageAnalysis.escalationReason,
        intent: messageAnalysis.intent.type,
        sentiment: messageAnalysis.sentiment
      }
    };
  }

  /**
   * Get fallback response when all strategies fail
   */
  private getFallbackResponse(
    messageAnalysis: MessageAnalysis
  ): ResponseStrategy {
    // Use objection template if available, otherwise generic response
    if (messageAnalysis.objection?.suggestedResponse) {
      return {
        type: 'objectionTemplate',
        response: messageAnalysis.objection.suggestedResponse,
        confidence: 0.5,
        metadata: {
          objectionType: messageAnalysis.objection.type,
          intent: messageAnalysis.intent.type,
          sentiment: messageAnalysis.sentiment,
          isFallback: true
        }
      };
    }

    // Use FAQ answer if available
    if (messageAnalysis.faqMatch?.answer) {
      return {
        type: 'faq',
        response: messageAnalysis.faqMatch.answer,
        confidence: 0.5,
        metadata: {
          faqQuestion: messageAnalysis.faqMatch.question,
          intent: messageAnalysis.intent.type,
          sentiment: messageAnalysis.sentiment,
          isFallback: true
        }
      };
    }

    // Generic fallback
    const genericResponse = messageAnalysis.intent.type === 'greeting'
      ? 'Hello! How can I help you today?'
      : 'Thank you for your message. I\'m here to help. Could you please provide more details?';

    return {
      type: 'ai',
      response: genericResponse,
      confidence: 0.3,
      metadata: {
        intent: messageAnalysis.intent.type,
        sentiment: messageAnalysis.sentiment,
        isFallback: true
      }
    };
  }

  /**
   * Validate response quality
   */
  validateResponse(response: string): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check length
    if (response.length < 10) {
      issues.push('Response too short');
    }
    if (response.length > 2000) {
      issues.push('Response too long');
    }

    // Check for empty or whitespace-only
    if (!response.trim()) {
      issues.push('Response is empty');
    }

    // Check for common errors
    if (response.includes('undefined') || response.includes('null')) {
      issues.push('Response contains undefined/null values');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Enhance response with personalization
   */
  async enhanceResponse(
    response: string,
    conversationId: string,
    leadName?: string
  ): Promise<string> {
    try {
      // Get conversation context for personalization
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          lead: {
            select: {
              name: true
            }
          },
          messages: {
            where: { isDeleted: false },
            orderBy: { sentAt: 'desc' },
            take: 5,
            select: {
              content: true,
              sender: true
            }
          }
        }
      });

      const customerName = leadName || conversation?.lead?.name || 'there';

      // Replace placeholders
      let enhanced = response
        .replace(/{customer_name}/g, customerName)
        .replace(/{lead_name}/g, customerName);

      // Add personal touch for greetings
      if (conversation?.messages.length === 0) {
        enhanced = enhanced.replace(/Hello/g, `Hello ${customerName}`);
      }

      return enhanced;
    } catch (error) {
      logger.error('Error enhancing response:', error);
      return response; // Return original if enhancement fails
    }
  }
}

// Export singleton instance
const responseStrategyService = new ResponseStrategyService();
export default responseStrategyService;

