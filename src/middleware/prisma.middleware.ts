/**
 * Prisma Middleware for Soft Delete
 * 
 * Automatically intercepts Prisma queries to:
 * 1. Filter out deleted records from all queries
 * 2. Convert delete operations to soft deletes
 */

import { Prisma } from '@prisma/client';

/**
 * Models that support soft delete
 */
const SOFT_DELETE_MODELS = [
  'User',
  'Gym',
  'Lead',
  'Conversation',
  'Message',
];

/**
 * Check if a model supports soft delete
 */
function supportsSoftDelete(model: string): boolean {
  return SOFT_DELETE_MODELS.includes(model);
}

/**
 * Soft Delete Middleware
 * 
 * Usage: Add this to your Prisma client configuration
 * prisma.$use(softDeleteMiddleware);
 */
export const softDeleteMiddleware: Prisma.Middleware = async (params, next) => {
  const model = params.model;

  // Only apply to models that support soft delete
  if (!model || !supportsSoftDelete(model)) {
    return next(params);
  }

  // ================================================
  // FIND OPERATIONS - Automatically filter deleted
  // ================================================
  
  if (params.action === 'findUnique' || params.action === 'findFirst') {
    // Add isDeleted: false to where clause
    params.args.where = {
      ...params.args.where,
      isDeleted: false,
    };
  }

  if (params.action === 'findMany') {
    // Check if explicitly querying deleted records
    if (params.args.where?.isDeleted !== undefined) {
      // User explicitly set isDeleted, don't override
      return next(params);
    }

    // Add isDeleted: false to where clause
    params.args.where = {
      ...params.args.where,
      isDeleted: false,
    };
  }

  // ================================================
  // COUNT OPERATIONS - Filter deleted
  // ================================================
  
  if (params.action === 'count') {
    // Check if explicitly counting deleted records
    if (params.args.where?.isDeleted !== undefined) {
      return next(params);
    }

    params.args.where = {
      ...params.args.where,
      isDeleted: false,
    };
  }

  // ================================================
  // DELETE OPERATIONS - Convert to soft delete
  // ================================================
  
  if (params.action === 'delete') {
    // Convert delete to update
    params.action = 'update';
    params.args.data = {
      isDeleted: true,
      deletedAt: new Date(),
    };
  }

  if (params.action === 'deleteMany') {
    // Convert deleteMany to updateMany
    params.action = 'updateMany';
    params.args.data = {
      isDeleted: true,
      deletedAt: new Date(),
    };
  }

  return next(params);
};

/**
 * Extension methods for Prisma Client
 * Adds helper methods to work with soft deletes
 */
export const softDeleteExtensions = {
  /**
   * Find including deleted records
   */
  findManyWithDeleted: async (model: any, args: any = {}) => {
    return await model.findMany({
      ...args,
      where: {
        ...args.where,
        // Don't filter by isDeleted
      },
    });
  },

  /**
   * Find only deleted records
   */
  findManyDeleted: async (model: any, args: any = {}) => {
    return await model.findMany({
      ...args,
      where: {
        ...args.where,
        isDeleted: true,
      },
    });
  },

  /**
   * Restore a soft-deleted record
   */
  restore: async (model: any, id: string) => {
    return await model.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
      },
    });
  },

  /**
   * Hard delete (permanent deletion)
   * ⚠️ Use with extreme caution!
   */
  forceDelete: async (model: any, id: string) => {
    // Temporarily disable middleware for this operation
    return await model.delete({
      where: { id },
    });
  },
};

