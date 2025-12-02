import OpenAI from 'openai';
import logger from '../utils/logger';
import prisma from '../config/database';
import * as aiPromptService from './aiPrompt.service';
import type { MessageAnalysis } from './messageAnalysis.service';
import qualificationFlowService from './qualificationFlow.service';

class AIService {
  private client: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({
        apiKey: apiKey
      });
      logger.info('OpenAI client initialized');
    } else {
      logger.warn('OpenAI API key not found. AI responses will be disabled.');
    }
  }

  /**
   * Generate AI response for a customer message
   */
  async generateResponse(
    customerMessage: string,
    conversationId: string,
    gymId: string,
    messageAnalysis?: MessageAnalysis
  ): Promise<string | null> {
    if (!this.client) {
      logger.warn('OpenAI client not available. Skipping AI response generation.');
      return null;
    }

    try {
      // Get conversation history
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              status: true
            }
          },
          messages: {
            where: {
              isDeleted: false
            },
            orderBy: {
              sentAt: 'asc'
            },
            take: 20, // Last 20 messages for context
            select: {
              content: true,
              sender: true,
              sentAt: true,
              type: true
            }
          }
        }
      });

      if (!conversation) {
        logger.error(`Conversation ${conversationId} not found`);
        return null;
      }

      // Get AI prompt configuration
      let aiPrompt;
      try {
        aiPrompt = await aiPromptService.getAIPrompt(gymId);
      } catch (error) {
        logger.warn(`AI prompt not found for gym ${gymId}, using default`);
        // Use default template if not configured
        const defaultTemplate = aiPromptService.getDefaultPromptTemplate();
        aiPrompt = {
          systemPrompt: defaultTemplate.systemPrompt,
          greetingMessage: defaultTemplate.greetingMessage,
          qualificationFlow: defaultTemplate.qualificationFlow,
          objectionHandling: defaultTemplate.objectionHandling,
          faqs: defaultTemplate.faqs,
          escalationRules: defaultTemplate.escalationRules
        } as any;
      }

      // Get gym information for context
      const gym = await prisma.gym.findUnique({
        where: { id: gymId },
        select: {
          name: true,
          address: true,
          phone: true,
          email: true,
          registrationUrl: true
        }
      });

      // Build enhanced system prompt with gym information and analysis context
      let systemPrompt = aiPrompt.systemPrompt || '';
      if (gym) {
        systemPrompt = systemPrompt
          .replace(/{gym_name}/g, gym.name || 'the gym')
          .replace(/{gym_address}/g, gym.address || '');
      }

      // Check qualification flow state
      const qualificationState = await qualificationFlowService.getQualificationState(conversationId);
      const qualificationFlow = aiPrompt.qualificationFlow;

      // Enhance system prompt with message analysis context
      if (messageAnalysis) {
        // Add objection handling context if objection detected
        if (messageAnalysis.objection && aiPrompt.objectionHandling) {
          const objectionContext = `
IMPORTANT: The customer has raised an objection: "${messageAnalysis.objection.matchedPattern}"
Suggested response approach: ${messageAnalysis.objection.suggestedResponse || 'Address the concern empathetically and provide value.'}
Handle this objection professionally while maintaining a positive, helpful tone.`;
          systemPrompt += '\n\n' + objectionContext;
        }

        // Add FAQ context if FAQ matched
        if (messageAnalysis.faqMatch && messageAnalysis.faqMatch.matchScore > 0.7) {
          const faqContext = `
The customer is asking about: "${messageAnalysis.faqMatch.question}"
You have a direct answer available: ${messageAnalysis.faqMatch.answer}
Use this information to provide a clear, helpful response. You can personalize it based on the conversation context.`;
          systemPrompt += '\n\n' + faqContext;
        }

        // Add qualification flow context if user wants to register
        if (qualificationState && !qualificationState.isComplete) {
          const nextQuestion = qualificationFlowService.getNextQuestion(qualificationState, qualificationFlow);
          if (nextQuestion) {
            const qualificationContext = `
IMPORTANT: The customer is in the registration process. 
Collected information so far:
${Object.entries(qualificationState.collectedData)
  .filter(([_, value]) => value !== undefined && value !== null && value !== '')
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}

Next question to ask: "${nextQuestion}"
Try to extract the answer from the customer's message. If the answer is provided, acknowledge it and move to the next question.`;
            systemPrompt += '\n\n' + qualificationContext;
          }
        }

        // Add intent context
        const intentContext = `
Message Intent: ${messageAnalysis.intent.type} (confidence: ${messageAnalysis.intent.confidence})
Sentiment: ${messageAnalysis.sentiment}
${messageAnalysis.requiresEscalation ? '⚠️ WARNING: This message may require human escalation.' : ''}`;
        systemPrompt += '\n\n' + intentContext;
      }

      // Check if customer mentioned a price or plan in their message or recent conversation
      const hasPriceMention = this.detectPriceMention(customerMessage, conversation.messages);
      
      // Check if this is a plan explanation message (AI explaining plans/prices)
      const isPlanExplanation = this.isPlanExplanationMessage(customerMessage, conversation.messages);

      // Build conversation history for context
      const conversationHistory = conversation.messages.map(msg => ({
        role: msg.sender === 'CUSTOMER' ? 'user' : msg.sender === 'AI' ? 'assistant' : 'user',
        content: msg.content
      }));

      // Add instructions for price mentions and plan explanations
      if (hasPriceMention) {
        systemPrompt += '\n\nIMPORTANT: The customer has mentioned or asked about a price/plan. After explaining the plan and price, you MUST:';
        systemPrompt += '\n1. Always include the registration link in your response if available.';
        systemPrompt += '\n2. After explaining the plan, ask: "Please let me know if the registration process went smoothly."';
        if (gym?.registrationUrl) {
          systemPrompt += `\n3. Registration link: ${gym.registrationUrl}`;
        }
      }

      if (isPlanExplanation) {
        systemPrompt += '\n\nIMPORTANT: You are explaining plans/prices to the customer. You MUST:';
        systemPrompt += '\n1. Always include the registration link in your final message explaining the plan.';
        systemPrompt += '\n2. After explaining the plan, ask: "Please let me know if the registration process went smoothly."';
        if (gym?.registrationUrl) {
          systemPrompt += `\n3. Registration link: ${gym.registrationUrl}`;
        }
      }

      // Add current customer message
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        {
          role: 'user',
          content: customerMessage
        }
      ];

      // Call OpenAI API
      const completion = await this.client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 500,
        presence_penalty: 0.6,
        frequency_penalty: 0.6
      });

      let aiResponse = completion.choices[0]?.message?.content?.trim();

      if (!aiResponse) {
        logger.warn('OpenAI returned empty response');
        return null;
      }

      // Post-process: Ensure registration link and follow-up question are included
      if (aiResponse && (hasPriceMention || isPlanExplanation) && gym?.registrationUrl) {
        // Check if registration link is already in response
        if (!aiResponse.includes(gym.registrationUrl)) {
          // Add registration link before the follow-up question
          aiResponse += `\n\n👉 Registration link: ${gym.registrationUrl}`;
        }
        
        // Check if follow-up question is already in response
        const followUpQuestion = 'Please let me know if the registration process went smoothly';
        const followUpVariations = [
          'please let me know if the registration process went smoothly',
          'let me know if the registration process went smoothly',
          'let us know if everything went well with your registration',
          'let me know if everything went well with your registration'
        ];
        
        // TypeScript needs explicit check here since we're inside a callback
        const responseText = aiResponse.toLowerCase();
        const hasFollowUp = followUpVariations.some(variation => 
          responseText.includes(variation.toLowerCase())
        );
        
        if (!hasFollowUp) {
          aiResponse += `\n\n👉 ${followUpQuestion}.`;
        }
      }

      logger.info('AI response generated successfully', {
        conversationId,
        responseLength: aiResponse.length,
        hasPriceMention,
        isPlanExplanation
      });

      return aiResponse;
    } catch (error: any) {
      logger.error('Error generating AI response:', {
        error: error.message,
        conversationId,
        gymId
      });
      return null;
    }
  }

  /**
   * Detect if customer message mentions price or plan
   */
  private detectPriceMention(message: string, conversationHistory: any[]): boolean {
    const pricePatterns = [
      /(preço|precos|price|prices|valor|valores|quanto|how much|cost)/i,
      /(plano|planos|plan|plans|mensalidade|monthly|anual|annual)/i,
      /(r\$|reais|dollar|usd)/i,
      /(assinatura|subscription|membership)/i
    ];

    // Check current message
    const messageLower = message.toLowerCase();
    if (pricePatterns.some(pattern => pattern.test(messageLower))) {
      return true;
    }

    // Check recent conversation history (last 5 messages)
    const recentMessages = conversationHistory.slice(-5);
    for (const msg of recentMessages) {
      if (msg.sender === 'CUSTOMER' && msg.content) {
        const contentLower = msg.content.toLowerCase();
        if (pricePatterns.some(pattern => pattern.test(contentLower))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if this is a plan explanation context (customer asking about plans)
   */
  private isPlanExplanationMessage(message: string, conversationHistory: any[]): boolean {
    const planQuestionPatterns = [
      /(quais são os planos|what are the plans|quais planos|which plans)/i,
      /(me explique os planos|explain the plans|tell me about plans)/i,
      /(quero saber sobre|want to know about|gostaria de saber)/i,
      /(informações sobre planos|information about plans|plan details)/i
    ];

    const messageLower = message.toLowerCase();
    if (planQuestionPatterns.some(pattern => pattern.test(messageLower))) {
      return true;
    }

    // Check if recent AI messages mentioned plans/prices
    const recentMessages = conversationHistory.slice(-3);
    for (const msg of recentMessages) {
      if (msg.sender === 'AI' && msg.content) {
        const contentLower = msg.content.toLowerCase();
        if (/(plano|plan|preço|price|valor|value)/i.test(contentLower)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if message should trigger AI response
   * Returns false if conversation is assigned to an agent or if escalation is needed
   */
  async shouldGenerateResponse(conversationId: string): Promise<boolean> {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          userId: true, // If assigned to agent, don't auto-respond
          status: true
        }
      });

      if (!conversation) {
        return false;
      }

      // Don't auto-respond if conversation is assigned to an agent
      if (conversation.userId) {
        logger.info(`Conversation ${conversationId} is assigned to agent, skipping AI response`);
        return false;
      }

      // Don't auto-respond if conversation is closed
      if (conversation.status === 'CLOSED' || conversation.status === 'ARCHIVED') {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking if should generate response:', error);
      return false;
    }
  }
}

// Export singleton instance
const aiService = new AIService();
export default aiService;

