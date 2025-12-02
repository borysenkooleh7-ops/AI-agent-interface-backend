import type { DetectedObjection } from './messageAnalysis.service';

export interface ObjectionResponseContext {
  gymName?: string;
  gymAddress?: string;
  leadName?: string;
  conversationSummary?: string;
  callToAction?: string;
}

export interface ObjectionResponseResult {
  text: string;
  confidence: number;
  templateUsed: boolean;
  metadata?: Record<string, any>;
}

/**
 * Service responsible for generating responses for detected objections.
 * Uses stored templates and adds light personalization.
 */
class ObjectionResponseService {
  /**
   * Generate a response for a detected objection when a template exists.
   */
  generateResponse(
    objection: DetectedObjection,
    context: ObjectionResponseContext = {}
  ): ObjectionResponseResult | null {
    if (!objection || !objection.suggestedResponse) {
      return null;
    }

    const {
      gymName,
      gymAddress,
      leadName,
      conversationSummary,
      callToAction
    } = context;

    const template = objection.suggestedResponse;
    let response = template;

    // Basic placeholder replacements
    response = response
      .replace(/{gym_name}/gi, gymName || 'DuxFit')
      .replace(/{gym_address}/gi, gymAddress || 'nosso espaço')
      .replace(/{customer_name}/gi, leadName || 'por aqui');

    // Add conversation summary if provided
    if (conversationSummary) {
      response += `\n\nResumo do que você comentou: ${conversationSummary}`;
    }

    // Default CTA if none provided
    const defaultCTA =
      'Posso te ajudar a garantir essa condição agora mesmo?';
    response += `\n\n${callToAction || defaultCTA}`;

    return {
      text: response.trim(),
      confidence: objection.confidence,
      templateUsed: true,
      metadata: {
        objectionType: objection.type,
        matchedPattern: objection.matchedPattern
      }
    };
  }
}

const objectionResponseService = new ObjectionResponseService();
export default objectionResponseService;

