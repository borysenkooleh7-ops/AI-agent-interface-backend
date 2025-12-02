import logger from '../utils/logger';

/**
 * Message Intent Types
 */
export type MessageIntentType = 'question' | 'objection' | 'request' | 'greeting' | 'complaint' | 'information' | 'other';

/**
 * Message Intent
 */
export interface MessageIntent {
  type: MessageIntentType;
  confidence: number;
  category?: string;
}

/**
 * Detected Objection
 */
export interface DetectedObjection {
  type: string;
  trigger: string;
  matchedPattern: string;
  confidence: number;
  suggestedResponse?: string;
}

/**
 * FAQ Match
 */
export interface FAQMatch {
  question: string;
  answer: string;
  keywords: string[];
  matchScore: number;
  matchedKeywords: string[];
}

/**
 * Message Analysis Result
 */
export interface MessageAnalysis {
  intent: MessageIntent;
  objection?: DetectedObjection;
  faqMatch?: FAQMatch;
  keywords: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  requiresEscalation: boolean;
  escalationReason?: string;
}

/**
 * Message Analysis Service
 * Analyzes incoming messages to detect intent, objections, FAQs, and escalation needs
 */
class MessageAnalysisService {
  // Common stop words in Portuguese and English
  private stopWords = new Set([
    // Portuguese
    'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
    'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas',
    'por', 'para', 'com', 'sem', 'sob', 'sobre', 'entre',
    'é', 'são', 'está', 'estão', 'foi', 'foram',
    'que', 'qual', 'quais', 'quando', 'onde', 'como', 'porque',
    'eu', 'você', 'ele', 'ela', 'nós', 'eles', 'elas',
    'me', 'te', 'se', 'nos', 'vos',
    'meu', 'minha', 'meus', 'minhas',
    'seu', 'sua', 'seus', 'suas',
    'este', 'esta', 'estes', 'estas',
    'esse', 'essa', 'esses', 'essas',
    'aquele', 'aquela', 'aqueles', 'aquelas',
    // English
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were',
    'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it',
    'we', 'they', 'me', 'him', 'her', 'us', 'them'
  ]);

  /**
   * Analyze incoming message
   */
  async analyzeMessage(
    message: string,
    _gymId: string, // Reserved for future gym-specific analysis
    objectionHandling?: any,
    faqs?: any,
    escalationRules?: any
  ): Promise<MessageAnalysis> {
    try {
      // Normalize message
      const normalizedMessage = this.normalizeMessage(message);
      
      // Extract keywords
      const keywords = this.extractKeywords(normalizedMessage);
      
      // Detect intent
      const intent = this.detectIntent(normalizedMessage, keywords);
      
      // Detect objection
      const objection = objectionHandling
        ? await this.detectObjection(normalizedMessage, objectionHandling)
        : undefined;
      
      // Match FAQ
      const faqMatch = faqs
        ? await this.matchFAQ(normalizedMessage, keywords, faqs)
        : undefined;
      
      // Analyze sentiment
      const sentiment = this.analyzeSentiment(normalizedMessage);
      
      // Check escalation requirements
      const escalation = this.checkEscalation(
        normalizedMessage,
        keywords,
        escalationRules
      );
      
      return {
        intent,
        objection: objection || undefined,
        faqMatch: faqMatch || undefined,
        keywords,
        sentiment,
        requiresEscalation: escalation.requires,
        escalationReason: escalation.reason
      };
    } catch (error: any) {
      logger.error('Error analyzing message:', {
        error: error.message,
        message: message.substring(0, 100)
      });
      
      // Return default analysis on error
      return {
        intent: { type: 'other', confidence: 0 },
        keywords: [],
        sentiment: 'neutral',
        requiresEscalation: false
      };
    }
  }

  /**
   * Normalize message text
   */
  private normalizeMessage(message: string): string {
    return message
      .toLowerCase()
      .trim()
      .replace(/[^\w\s\u00C0-\u017F]/g, ' ') // Remove special chars, keep accented letters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Extract keywords from message
   */
  private extractKeywords(message: string): string[] {
    const words = message.split(/\s+/);
    return words
      .filter(word => word.length > 2) // Filter short words
      .filter(word => !this.stopWords.has(word)) // Remove stop words
      .filter((word, index, self) => self.indexOf(word) === index); // Remove duplicates
  }

  /**
   * Detect message intent
   */
  private detectIntent(message: string, _keywords: string[]): MessageIntent {
    const lowerMessage = message.toLowerCase();
    
    // Greeting patterns
    const greetingPatterns = [
      /^(oi|olá|ola|hello|hi|hey|bom dia|boa tarde|boa noite)/i,
      /^(tudo bem|como vai|como está)/i
    ];
    
    // Question patterns
    const questionPatterns = [
      /\?/,
      /^(quanto|qual|quais|quando|onde|como|por que|porque|porquê)/i,
      /^(what|how|when|where|why|which|who)/i
    ];
    
    // Objection patterns (basic detection, detailed in detectObjection)
    const objectionPatterns = [
      /(caro|caro demais|muito caro|expensive|too expensive)/i,
      /(não tenho tempo|sem tempo|no time|don't have time)/i,
      /(vou pensar|preciso pensar|i'll think|need to think)/i,
      /(não gosto|não curto|don't like)/i
    ];
    
    // Request patterns
    const requestPatterns = [
      /^(quero|gostaria|preciso|desejo|want|would like|need|i want)/i,
      /^(me envie|envie|send|me mande|mande)/i,
      /^(agende|agendar|schedule|book)/i
    ];
    
    // Complaint patterns
    const complaintPatterns = [
      /(reclamação|reclamar|complaint|problema|problem|erro|error)/i,
      /(não funciona|não está funcionando|not working|broken)/i,
      /(ruim|péssimo|bad|terrible|horrible)/i
    ];
    
    // Information patterns
    const informationPatterns = [
      /^(informação|info|information|dados|data)/i,
      /^(horário|horarios|schedule|hours|hora)/i,
      /^(preço|precos|price|prices|valor|valores)/i,
      /^(plano|planos|plan|plans)/i
    ];
    
    // Check patterns in order of priority
    if (greetingPatterns.some(pattern => pattern.test(lowerMessage))) {
      return { type: 'greeting', confidence: 0.9, category: 'greeting' };
    }
    
    if (objectionPatterns.some(pattern => pattern.test(lowerMessage))) {
      return { type: 'objection', confidence: 0.8, category: 'objection' };
    }
    
    if (questionPatterns.some(pattern => pattern.test(lowerMessage))) {
      return { type: 'question', confidence: 0.85, category: 'question' };
    }
    
    if (requestPatterns.some(pattern => pattern.test(lowerMessage))) {
      return { type: 'request', confidence: 0.8, category: 'request' };
    }
    
    if (complaintPatterns.some(pattern => pattern.test(lowerMessage))) {
      return { type: 'complaint', confidence: 0.85, category: 'complaint' };
    }
    
    if (informationPatterns.some(pattern => pattern.test(lowerMessage))) {
      return { type: 'information', confidence: 0.75, category: 'information' };
    }
    
    // Default to other
    return { type: 'other', confidence: 0.5, category: 'general' };
  }

  /**
   * Detect objections in message
   */
  async detectObjection(
    message: string,
    objectionHandling: any
  ): Promise<DetectedObjection | null> {
    if (!objectionHandling || !objectionHandling.objections) {
      return null;
    }

    const normalizedMessage = this.normalizeMessage(message);
    const objections = Array.isArray(objectionHandling.objections)
      ? objectionHandling.objections
      : [];

    let bestMatch: DetectedObjection | null = null;
    let highestScore = 0;

    for (const objection of objections) {
      if (!objection.trigger) continue;

      // Split trigger patterns (can be pipe-separated: "pattern1|pattern2")
      const patterns = objection.trigger.split('|').map((p: string) => p.trim());
      
      for (const pattern of patterns) {
        // Create regex pattern (case insensitive, word boundaries)
        const regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        
        if (regex.test(normalizedMessage)) {
          // Calculate confidence based on match
          const confidence = this.calculateObjectionConfidence(
            pattern,
            normalizedMessage,
            objection
          );
          
          if (confidence > highestScore) {
            highestScore = confidence;
            bestMatch = {
              type: objection.type || 'general',
              trigger: pattern,
              matchedPattern: pattern,
              confidence,
              suggestedResponse: objection.response
            };
          }
        }
      }
    }

    // Only return if confidence is above threshold
    return highestScore >= 0.6 ? bestMatch : null;
  }

  /**
   * Calculate objection detection confidence
   */
  private calculateObjectionConfidence(
    pattern: string,
    message: string,
    objection: any
  ): number {
    let score = 0.7; // Base score for pattern match
    
    // Boost if pattern appears multiple times
    const matches = (message.match(new RegExp(pattern, 'gi')) || []).length;
    if (matches > 1) {
      score += 0.1 * Math.min(matches - 1, 2); // Max 0.2 boost
    }
    
    // Boost if objection has a specific response
    if (objection.response && objection.response.length > 20) {
      score += 0.1;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Match message against FAQs
   */
  async matchFAQ(
    message: string,
    _keywords: string[], // Reserved for future use
    faqs: any
  ): Promise<FAQMatch | null> {
    if (!faqs || !faqs.questions) {
      return null;
    }

    const normalizedMessage = this.normalizeMessage(message);
    const questions = Array.isArray(faqs.questions)
      ? faqs.questions
      : [];

    let bestMatch: FAQMatch | null = null;
    let highestScore = 0;

    for (const faq of questions) {
      if (!faq.keywords || !faq.answer) continue;

      // Get keywords from FAQ (can be pipe-separated or array)
      const faqKeywords = Array.isArray(faq.keywords)
        ? faq.keywords
        : typeof faq.keywords === 'string'
        ? faq.keywords.split('|').map((k: string) => k.trim().toLowerCase())
        : [];

      // Calculate match score
      const matchedKeywords: string[] = [];
      let matchScore = 0;

      // Check keyword matches
      for (const faqKeyword of faqKeywords) {
        // Check if keyword appears in message
        const regex = new RegExp(`\\b${faqKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(normalizedMessage)) {
          matchedKeywords.push(faqKeyword);
          matchScore += 1.0; // Each keyword match adds 1 point
        }
      }

      // Check if question text matches
      if (faq.question) {
        const questionLower = faq.question.toLowerCase();
        const questionWords = questionLower.split(/\s+/);
        const matchingQuestionWords = questionWords.filter((word: string) =>
          normalizedMessage.includes(word) && word.length > 3
        );
        matchScore += matchingQuestionWords.length * 0.5;
      }

      // Normalize score (0-1 range)
      const normalizedScore = Math.min(matchScore / Math.max(faqKeywords.length, 1), 1.0);

      // Only consider matches with at least one keyword
      if (matchedKeywords.length > 0 && normalizedScore > highestScore) {
        highestScore = normalizedScore;
        bestMatch = {
          question: faq.question || '',
          answer: faq.answer,
          keywords: faqKeywords,
          matchScore: normalizedScore,
          matchedKeywords
        };
      }
    }

    // Only return if match score is above threshold
    return highestScore >= 0.5 ? bestMatch : null;
  }

  /**
   * Analyze message sentiment
   */
  private analyzeSentiment(message: string): 'positive' | 'neutral' | 'negative' {
    const lowerMessage = message.toLowerCase();
    
    // Positive indicators
    const positiveWords = [
      'obrigado', 'obrigada', 'thanks', 'thank you', 'gratidão',
      'ótimo', 'otimo', 'excelente', 'great', 'excellent', 'awesome',
      'gostei', 'like', 'loved', 'adorei',
      'perfeito', 'perfect', 'maravilhoso', 'wonderful'
    ];
    
    // Negative indicators
    const negativeWords = [
      'ruim', 'péssimo', 'pessimo', 'bad', 'terrible', 'horrible',
      'não gosto', 'don\'t like', 'hate', 'odeio',
      'problema', 'problem', 'erro', 'error', 'bug',
      'reclamação', 'complaint', 'insatisfeito', 'dissatisfied'
    ];
    
    const positiveCount = positiveWords.filter(word => lowerMessage.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerMessage.includes(word)).length;
    
    if (negativeCount > positiveCount) {
      return 'negative';
    } else if (positiveCount > negativeCount) {
      return 'positive';
    }
    
    return 'neutral';
  }

  /**
   * Check if message requires escalation
   */
  private checkEscalation(
    message: string,
    _keywords: string[], // Reserved for future use
    escalationRules?: any
  ): { requires: boolean; reason?: string } {
    if (!escalationRules || !escalationRules.keywords) {
      return { requires: false };
    }

    const normalizedMessage = this.normalizeMessage(message);
    const rules = escalationRules.keywords;

    // Check each escalation category
    for (const [category, keywords] of Object.entries(rules)) {
      const categoryKeywords = Array.isArray(keywords) ? keywords : [];
      
      for (const keyword of categoryKeywords) {
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(normalizedMessage)) {
          return {
            requires: true,
            reason: category
          };
        }
      }
    }

    return { requires: false };
  }
}

// Export singleton instance
const messageAnalysisService = new MessageAnalysisService();
export default messageAnalysisService;

