import prisma from '../config/database';
import logger from '../utils/logger';
import * as memberService from './member.service';
import * as notificationService from './notification.service';
import whatsappService from './whatsapp.service';
import { getSocketInstance } from '../utils/socketManager';

export interface QualificationData {
  fullName?: string;
  cpf?: string;
  birthDate?: Date;
  address?: string;
  zipCode?: string;
  preferredWorkoutTime?: string;
  gymGoal?: string;
  email?: string;
  phone?: string;
}

export interface QualificationState {
  conversationId: string;
  leadId: string;
  gymId: string;
  collectedData: QualificationData;
  currentStep?: number;
  isComplete: boolean;
  memberApplicationId?: string;
}

/**
 * Qualification Flow Service
 * Manages the collection of member registration information during conversations
 */
class QualificationFlowService {
  /**
   * Get or create qualification state for a conversation
   */
  async getQualificationState(conversationId: string): Promise<QualificationState | null> {
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
              cpf: true,
              birthDate: true,
              address: true,
              zipCode: true,
              gymId: true
            }
          }
        }
      });

      if (!conversation) {
        return null;
      }

      // Initialize qualification data from lead
      const collectedData: QualificationData = {
        fullName: conversation.lead.name,
        phone: conversation.lead.phone,
        email: conversation.lead.email || undefined,
        cpf: conversation.lead.cpf || undefined,
        birthDate: conversation.lead.birthDate || undefined,
        address: conversation.lead.address || undefined,
        zipCode: conversation.lead.zipCode || undefined
      };

      // Check if member application already exists
      const existingMember = await prisma.member.findFirst({
        where: {
          leadId: conversation.leadId,
          isDeleted: false
        },
        select: {
          id: true,
          status: true
        }
      });

      // Determine if qualification is complete
      const isComplete = this.isQualificationComplete(collectedData);

      return {
        conversationId,
        leadId: conversation.lead.id,
        gymId: conversation.lead.gymId,
        collectedData,
        isComplete,
        memberApplicationId: existingMember?.id
      };
    } catch (error) {
      logger.error('Error getting qualification state:', error);
      return null;
    }
  }

  /**
   * Update qualification data from a message
   */
  async updateQualificationData(
    conversationId: string,
    field: keyof QualificationData,
    value: string | Date
  ): Promise<QualificationState | null> {
    try {
      const state = await this.getQualificationState(conversationId);
      if (!state) {
        return null;
      }

      // Update the collected data
      const updatedData = {
        ...state.collectedData,
        [field]: value
      };

      // Update lead information in database
      const updateData: any = {};
      if (field === 'fullName') updateData.name = value as string;
      if (field === 'cpf') updateData.cpf = value as string;
      if (field === 'birthDate') updateData.birthDate = value as Date;
      if (field === 'address') updateData.address = value as string;
      if (field === 'zipCode') updateData.zipCode = value as string;
      if (field === 'email') updateData.email = value as string;

      if (Object.keys(updateData).length > 0) {
        await prisma.lead.update({
          where: { id: state.leadId },
          data: updateData
        });
      }

      // Check if qualification is now complete
      const isComplete = this.isQualificationComplete(updatedData);

      const newState: QualificationState = {
        ...state,
        collectedData: updatedData,
        isComplete
      };

      // If complete and no member application exists, create one
      if (isComplete && !state.memberApplicationId) {
        await this.createMemberApplication(newState);
      }

      return newState;
    } catch (error) {
      logger.error('Error updating qualification data:', error);
      return null;
    }
  }

  /**
   * Check if all required qualification fields are collected
   */
  private isQualificationComplete(data: QualificationData): boolean {
    const requiredFields: (keyof QualificationData)[] = [
      'fullName',
      'cpf',
      'birthDate',
      'gymGoal',
      'email'
    ];

    return requiredFields.every(field => {
      const value = data[field];
      return value !== undefined && value !== null && value !== '';
    });
  }

  /**
   * Get next question to ask based on missing fields
   */
  getNextQuestion(state: QualificationState, qualificationFlow?: any): string | null {
    if (state.isComplete) {
      return null;
    }

    const steps = qualificationFlow?.steps || this.getDefaultSteps();
    const data = state.collectedData;

    for (const step of steps) {
      const field = step.field as keyof QualificationData;
      const value = data[field];

      if (step.required && (!value || value === '')) {
        return step.question;
      }
    }

    return null;
  }

  /**
   * Extract field value from message
   */
  extractFieldValue(message: string, field: string): string | Date | null {

    switch (field) {
      case 'email':
        const emailRegex = /[\w\.-]+@[\w\.-]+\.\w+/;
        const emailMatch = message.match(emailRegex);
        return emailMatch ? emailMatch[0] : null;

      case 'cpf':
        // Brazilian CPF format: XXX.XXX.XXX-XX or just numbers
        const cpfRegex = /(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/;
        const cpfMatch = message.match(cpfRegex);
        if (cpfMatch) {
          return cpfMatch[1].replace(/[.-]/g, '');
        }
        // Try to extract 11 digits
        const digits = message.replace(/\D/g, '');
        if (digits.length === 11) {
          return digits;
        }
        return null;

      case 'birthDate':
        // Try various date formats
        const dateFormats = [
          /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
          /(\d{4})-(\d{2})-(\d{2})/,   // YYYY-MM-DD
          /(\d{2})-(\d{2})-(\d{4})/    // DD-MM-YYYY
        ];

        for (const format of dateFormats) {
          const match = message.match(format);
          if (match) {
            if (format === dateFormats[0]) {
              // DD/MM/YYYY
              const day = parseInt(match[1]);
              const month = parseInt(match[2]) - 1;
              const year = parseInt(match[3]);
              return new Date(year, month, day);
            } else if (format === dateFormats[1]) {
              // YYYY-MM-DD
              return new Date(match[0]);
            } else {
              // DD-MM-YYYY
              const day = parseInt(match[1]);
              const month = parseInt(match[2]) - 1;
              const year = parseInt(match[3]);
              return new Date(year, month, day);
            }
          }
        }
        return null;

      case 'zipCode':
        // Brazilian ZIP code: XXXXX-XXX or XXXXXXXX
        const zipRegex = /(\d{5}-?\d{3})/;
        const zipMatch = message.match(zipRegex);
        if (zipMatch) {
          return zipMatch[1].replace(/-/g, '');
        }
        return null;

      default:
        // For other fields, return the message if it seems like a direct answer
        if (message.length > 2 && message.length < 200) {
          return message;
        }
        return null;
    }
  }

  /**
   * Create member application when qualification is complete
   */
  private async createMemberApplication(state: QualificationState): Promise<void> {
    try {
      if (!state.isComplete) {
        return;
      }

      const data = state.collectedData;

      // Create member application
      const member = await memberService.createMember({
        gymId: state.gymId,
        leadId: state.leadId,
        fullName: data.fullName!,
        cpf: data.cpf!,
        birthDate: data.birthDate!,
        address: data.address,
        zipCode: data.zipCode,
        preferredWorkoutTime: data.preferredWorkoutTime,
        gymGoal: data.gymGoal!,
        email: data.email!,
        phone: data.phone!
      });

      // Send notification to customer via WhatsApp
      const notificationMessage = `✅ Obrigado! Recebemos sua solicitação de registro na academia. Nossa equipe irá analisar e entrar em contato em breve.`;
      
      try {
        await whatsappService.sendTextMessage(
          data.phone!,
          notificationMessage,
          state.gymId
        );
      } catch (error) {
        logger.error('Error sending notification via WhatsApp:', error);
      }

      // Create notification for gym admins/managers
      const gymUsers = await prisma.gymUser.findMany({
        where: {
          gymId: state.gymId,
          role: { in: ['ADMIN', 'MANAGER'] }
        },
        select: {
          userId: true
        }
      });

      for (const gymUser of gymUsers) {
        await notificationService.createNotification({
          userId: gymUser.userId,
          type: 'MEMBER_APPLICATION_RECEIVED',
          title: 'Nova Solicitação de Membro',
          message: `Nova solicitação de registro recebida de ${data.fullName}`,
          data: {
            memberId: member.id,
            leadId: state.leadId,
            gymId: state.gymId
          }
        });
      }

      // Emit Socket.IO event
      const io = getSocketInstance();
      if (io) {
        for (const gymUser of gymUsers) {
          io.to(`user:${gymUser.userId}`).emit('notification:new', {
            type: 'MEMBER_APPLICATION_RECEIVED',
            title: 'Nova Solicitação de Membro',
            message: `Nova solicitação de registro recebida de ${data.fullName}`
          });
        }
      }

      logger.info(`Member application created: ${member.id} for lead ${state.leadId}`);
    } catch (error) {
      logger.error('Error creating member application:', error);
    }
  }

  /**
   * Get default qualification steps
   */
  private getDefaultSteps() {
    return [
      {
        field: 'fullName',
        question: "Para começar, qual é o seu nome completo?",
        required: true
      },
      {
        field: 'cpf',
        question: "Ótimo! E qual é o seu CPF para registro?",
        required: true,
        validation: 'cpf'
      },
      {
        field: 'birthDate',
        question: "Perfeito! Qual é a sua data de nascimento? (DD/MM/AAAA)",
        required: true,
        validation: 'date'
      },
      {
        field: 'gymGoal',
        question: "Qual é o seu principal objetivo na academia?",
        required: true
      },
      {
        field: 'preferredWorkoutTime',
        question: "Quando você prefere treinar?",
        required: false
      },
      {
        field: 'email',
        question: "Último passo! Qual é o seu endereço de e-mail?",
        required: true,
        validation: 'email'
      }
    ];
  }
}

// Export singleton instance
const qualificationFlowService = new QualificationFlowService();
export default qualificationFlowService;

