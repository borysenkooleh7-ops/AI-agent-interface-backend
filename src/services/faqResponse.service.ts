import type { FAQMatch } from './messageAnalysis.service';

export interface FAQResponseContext {
  gymName?: string;
  gymAddress?: string;
  leadName?: string;
}

export interface FAQResponseResult {
  text: string;
  metadata?: Record<string, any>;
}

/**
 * Generates quick answers for FAQ matches.
 */
class FAQResponseService {
  generateResponse(
    faqMatch: FAQMatch,
    context: FAQResponseContext = {}
  ): FAQResponseResult | null {
    if (!faqMatch?.answer) {
      return null;
    }

    const { gymName, gymAddress, leadName } = context;

    let response = faqMatch.answer;

    response = response
      .replace(/{gym_name}/gi, gymName || 'DuxFit')
      .replace(/{gym_address}/gi, gymAddress || 'nosso endereço')
      .replace(/{customer_name}/gi, leadName || 'você');

    return {
      text: response.trim(),
      metadata: {
        faqQuestion: faqMatch.question,
        matchedKeywords: faqMatch.matchedKeywords,
        matchScore: faqMatch.matchScore
      }
    };
  }
}

const faqResponseService = new FAQResponseService();
export default faqResponseService;

