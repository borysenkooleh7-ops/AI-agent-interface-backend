import prisma from '../config/database';

export interface CreateAIPromptData {
  gymId: string;
  systemPrompt: string;
  greetingMessage?: string;
  qualificationFlow?: any;
  objectionHandling?: any;
  faqs?: any;
  escalationRules?: any;
}

export interface UpdateAIPromptData {
  systemPrompt?: string;
  greetingMessage?: string;
  qualificationFlow?: any;
  objectionHandling?: any;
  faqs?: any;
  escalationRules?: any;
}

/**
 * Get AI prompt for a gym
 */
export async function getAIPrompt(gymId: string) {
  const prompt = await prisma.aIPrompt.findUnique({
    where: { gymId },
    include: {
      gym: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  });

  if (!prompt) {
    throw new Error('AI Prompt not found for this gym');
  }

  return prompt;
}

/**
 * Create AI prompt for a gym
 */
export async function createAIPrompt(data: CreateAIPromptData, createdBy: string) {
  // Check if gym exists
  const gym = await prisma.gym.findUnique({
    where: { id: data.gymId }
  });

  if (!gym) {
    throw new Error('Gym not found');
  }

  // Check if AI prompt already exists for this gym
  const existing = await prisma.aIPrompt.findUnique({
    where: { gymId: data.gymId }
  });

  if (existing) {
    throw new Error('AI Prompt already exists for this gym');
  }

  const prompt = await prisma.aIPrompt.create({
    data: {
      gymId: data.gymId,
      systemPrompt: data.systemPrompt,
      greetingMessage: data.greetingMessage,
      qualificationFlow: data.qualificationFlow || {},
      objectionHandling: data.objectionHandling || {},
      faqs: data.faqs || {},
      escalationRules: data.escalationRules || {}
    }
  });

  console.log(`✅ AI Prompt created for gym ${gym.name} by ${createdBy}`);
  return prompt;
}

/**
 * Update AI prompt
 */
export async function updateAIPrompt(gymId: string, data: UpdateAIPromptData, updatedBy: string) {
  const existing = await prisma.aIPrompt.findUnique({
    where: { gymId }
  });

  if (!existing) {
    throw new Error('AI Prompt not found');
  }

  const prompt = await prisma.aIPrompt.update({
    where: { gymId },
    data
  });

  console.log(`✅ AI Prompt updated for gym ${gymId} by ${updatedBy}`);
  return prompt;
}

/**
 * Delete AI prompt
 */
export async function deleteAIPrompt(gymId: string, deletedBy: string) {
  const prompt = await prisma.aIPrompt.delete({
    where: { gymId }
  });

  console.log(`🗑️ AI Prompt deleted for gym ${gymId} by ${deletedBy}`);
  return prompt;
}

/**
 * Get default AI prompt template
 */
export function getDefaultPromptTemplate() {
  return {
    systemPrompt: `You are an AI sales assistant for {gym_name}, located at {gym_address}.

Your Objective:
- Provide friendly, persuasive customer service
- Qualify leads by collecting required information
- Answer questions about plans, pricing, and facilities
- Handle objections professionally
- Guide customers toward registration

Your Tone:
- Friendly and energetic
- Confident but not pushy
- Use emojis appropriately (💪🔥👏)
- Professional yet approachable

Gym Information:
- Name: {gym_name}
- Location: {gym_address}
- Size: {gym_size}m²
- Equipment: {gym_equipment}

Operating Hours:
{operating_hours}

Required Information to Collect:
- Full Name
- CPF
- Date of Birth
- Address + ZIP Code
- Preferred Workout Time
- Fitness Goal
- Email Address

When to Escalate to Human:
- Billing disputes or refunds
- Cancellation requests
- HR or employment questions
- Complex technical issues
- Customer insists on speaking to human

Redirect Rules:
- For unlisted inquiries → Instagram {gym_instagram}
- For resumes/jobs → {gym_email}`,
    
    greetingMessage: "🎉 Hello, welcome to {gym_name}! 💪🔥\n\n👉 What's your question, or how can I help you today?\n\n🙌 If you're not yet a customer, to make your registration easier, please provide me with:\nFull name, CPF, date of birth, address + zip code, preferred workout time, gym goal, and email address.",
    
    qualificationFlow: {
      steps: [
        {
          field: "name",
          question: "To get started, what's your full name?",
          required: true
        },
        {
          field: "cpf",
          question: "Great! And what's your CPF for registration?",
          required: true,
          validation: "cpf"
        },
        {
          field: "birthDate",
          question: "Perfect! What's your date of birth? (DD/MM/YYYY)",
          required: true,
          validation: "date"
        },
        {
          field: "goal",
          question: "Awesome! What's your main fitness goal?",
          required: true
        },
        {
          field: "preferredTime",
          question: "When do you prefer to work out?",
          required: false
        },
        {
          field: "email",
          question: "Last step! What's your email address?",
          required: true,
          validation: "email"
        }
      ]
    },
    
    objectionHandling: {
      objections: [
        {
          trigger: "I'll think about it|I need to think|let me think",
          response: "I totally understand! Taking time to think is smart. Just so you know, our pre-sale offer ends soon, and spots are filling up fast. Can I secure your spot with just R$9.99 for the first month while you decide?"
        },
        {
          trigger: "too expensive|can't afford|very expensive",
          response: "I hear you! That's exactly why we created our annual plan at R$99.99/month - less than R$3.50 per day. That's less than a coffee! Plus, investing in your health now saves you money on medical bills later. Would you like me to break down the savings?"
        },
        {
          trigger: "no time|don't have time|too busy",
          response: "I totally get it - life is busy! That's why we're open 24/5. You can work out at 5 AM, midnight, or whenever works for you. Even 20 minutes a day makes a difference. Would you like to start with a flexible schedule?"
        }
      ]
    },
    
    faqs: {
      questions: [
        {
          question: "What are your hours?",
          keywords: ["hours|open|close|schedule|time"],
          answer: "We're open 24/5! That's 24 hours on Monday-Friday, and 7 AM to 7 PM on weekends and holidays. You can work out whenever it fits your schedule! 🕐"
        },
        {
          question: "Do you have a kids room?",
          keywords: ["kids|children|child|baby"],
          answer: "Yes! Our DUX KIDS room welcomes children aged 2.5 to 10 years. It has a monitor and security cameras, and is open 6-9 AM and 4-9 PM. It's included FREE with all memberships! 👶"
        },
        {
          question: "What equipment do you have?",
          keywords: ["equipment|machines|weights|cardio"],
          answer: "We have top-of-the-line Speedo equipment across 3,000m²! That includes cardio machines, free weights, machines, and everything you need for a complete workout. 🏋️"
        },
        {
          question: "Do you have parking?",
          keywords: ["parking|park|car"],
          answer: "Yes! We have FREE parking for all members with security. 🚗"
        }
      ]
    },
    
    escalationRules: {
      keywords: {
        billing: ["refund", "charge", "payment issue", "double charged", "billing"],
        cancellation: ["cancel", "quit", "leave", "unsubscribe", "terminate"],
        hr: ["job", "work here", "hiring", "resume", "curriculum", "employment"],
        complex: ["speak to manager", "talk to human", "real person", "agent"]
      },
      actions: {
        billing: "transfer_to_billing",
        cancellation: "transfer_to_manager",
        hr: "redirect_to_email",
        complex: "transfer_to_agent"
      }
    }
  };
}
