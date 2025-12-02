/**
 * Soft Delete Utility Functions
 * 
 * Provides reusable functions for soft delete operations
 * across all models in the application.
 */

import prisma from '../config/database';

/**
 * Soft delete a record by ID
 * Marks the record as deleted without actually removing it from database
 * Returns null if record doesn't exist, or the record if already deleted
 */
export async function softDelete(
  model: any,
  id: string,
  deletedBy?: string
): Promise<any> {
  try {
    // First check if the record exists and isn't already deleted
    const record = await model.findUnique({
      where: { id },
      select: { id: true, isDeleted: true },
    });

    if (!record) {
      // Record doesn't exist - return null instead of throwing
      // This allows bulk operations to continue even if some records are missing
      return null;
    }

    if (record.isDeleted) {
      // Already deleted, return the record without updating
      return record;
    }

    return await model.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        ...(deletedBy && { deletedBy }),
      },
    });
  } catch (error: any) {
    // If update fails (e.g., record was deleted between check and update), return null
    if (error.code === 'P2025') {
      return null;
    }
    throw error;
  }
}

/**
 * Soft delete multiple records
 */
export async function softDeleteMany(
  model: any,
  where: any,
  deletedBy?: string
): Promise<any> {
  return await model.updateMany({
    where,
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      ...(deletedBy && { deletedBy }),
    },
  });
}

/**
 * Restore a soft-deleted record
 */
export async function restore(model: any, id: string): Promise<any> {
  return await model.update({
    where: { id },
    data: {
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
    },
  });
}

/**
 * Restore multiple soft-deleted records
 */
export async function restoreMany(model: any, where: any): Promise<any> {
  return await model.updateMany({
    where,
    data: {
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
    },
  });
}

/**
 * Hard delete - permanently remove from database
 * ⚠️ WARNING: This is irreversible! Use with extreme caution
 */
export async function hardDelete(model: any, id: string): Promise<any> {
  return await model.delete({
    where: { id },
  });
}

/**
 * Find records including deleted ones
 */
export async function findWithDeleted(
  model: any,
  where: any = {}
): Promise<any> {
  return await model.findMany({
    where: {
      ...where,
      // No isDeleted filter - includes all
    },
  });
}

/**
 * Find only deleted records
 */
export async function findDeleted(model: any, where: any = {}): Promise<any> {
  return await model.findMany({
    where: {
      ...where,
      isDeleted: true,
    },
    orderBy: {
      deletedAt: 'desc',
    },
  });
}

/**
 * Count deleted records
 */
export async function countDeleted(model: any, where: any = {}): Promise<number> {
  return await model.count({
    where: {
      ...where,
      isDeleted: true,
    },
  });
}

/**
 * Check if a record is deleted
 */
export async function isDeleted(model: any, id: string): Promise<boolean> {
  const record = await model.findUnique({
    where: { id },
    select: { isDeleted: true },
  });
  
  return record?.isDeleted || false;
}

/**
 * Cascade soft delete for Lead
 * When deleting a lead, also soft delete related conversations and messages
 */
export async function cascadeSoftDeleteLead(
  leadId: string,
  deletedBy?: string
): Promise<void> {
  const timestamp = new Date();

  await prisma.$transaction([
    // Soft delete the lead
    prisma.lead.update({
      where: { id: leadId },
      data: {
        isDeleted: true,
        deletedAt: timestamp,
        deletedBy,
      },
    }),
    
    // Soft delete all conversations for this lead
    prisma.conversation.updateMany({
      where: { leadId },
      data: {
        isDeleted: true,
        deletedAt: timestamp,
        deletedBy,
      },
    }),
    
    // Soft delete all messages in conversations for this lead
    prisma.message.updateMany({
      where: {
        conversation: {
          leadId,
        },
      },
      data: {
        isDeleted: true,
        deletedAt: timestamp,
      },
    }),
  ]);
}

/**
 * Cascade restore for Lead
 * When restoring a lead, also restore related conversations and messages
 */
export async function cascadeRestoreLead(leadId: string): Promise<void> {
  await prisma.$transaction([
    // Restore the lead
    prisma.lead.update({
      where: { id: leadId },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
      },
    }),
    
    // Restore all conversations for this lead
    prisma.conversation.updateMany({
      where: { leadId },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
      },
    }),
    
    // Restore all messages
    prisma.message.updateMany({
      where: {
        conversation: {
          leadId,
        },
      },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    }),
  ]);
}

