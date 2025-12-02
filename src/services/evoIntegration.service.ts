import prisma from '../config/database';
import logger from '../utils/logger';

export interface EVOConfig {
  apiUrl: string;
  apiKey: string;
  branchId: string;
  autoSync: boolean;
  bidirectional: boolean;
  syncNotifications: boolean;
  syncInterval: number; // in minutes
}

export interface EVOLead {
  id: string;
  name: string;
  email?: string;
  phone: string;
  cpf?: string;
  birthDate?: string;
  address?: string;
  zipCode?: string;
  status: string;
  source: string;
  score: number;
  notes?: string;
  evoMemberId?: string;
}

export interface EVOSyncResult {
  success: boolean;
  recordsSynced: number;
  duration: number;
  errors: string[];
  newLeads: EVOLead[];
  updatedLeads: EVOLead[];
}

/**
 * Test EVO API connection
 */
export async function testEVOConnection(config: EVOConfig): Promise<boolean> {
  try {
    const response = await fetch(`${config.apiUrl}/api/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'X-Branch-ID': config.branchId
      },
      // timeout: 10000 // Not supported in standard fetch
    });

    return response.ok;
  } catch (error) {
    logger.error('EVO connection test failed:', error);
    return false;
  }
}

/**
 * Get integration by gym ID and type
 */
export async function getIntegrationByGymAndType(gymId: string, type: string) {
  return await prisma.integration.findUnique({
    where: {
      gymId_type: {
        gymId,
        type: type as any
      }
    },
    include: {
      fieldMappings: true,
      syncHistory: {
        orderBy: { startedAt: 'desc' },
        take: 10
      }
    }
  });
}

/**
 * Create or update EVO integration
 */
export async function createOrUpdateEVOIntegration(
  gymId: string,
  config: EVOConfig,
  _createdBy: string
) {
  // Test connection first
  const isConnected = await testEVOConnection(config);
  if (!isConnected) {
    throw new Error('Failed to connect to EVO API. Please check your credentials.');
  }

  const integrationData = {
    gymId,
    type: 'EVO' as const,
    name: 'EVO Gym Management System',
    status: 'ACTIVE' as const,
    config: {
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      branchId: config.branchId,
      autoSync: config.autoSync,
      bidirectional: config.bidirectional,
      syncNotifications: config.syncNotifications,
      syncInterval: config.syncInterval
    }
  };

  const integration = await prisma.integration.upsert({
    where: {
      gymId_type: {
        gymId,
        type: 'EVO'
      }
    },
    update: {
      ...integrationData,
      updatedAt: new Date()
    },
    create: integrationData
  });

  // Create default field mappings if they don't exist
  await createDefaultFieldMappings(integration.id);

  logger.info(`EVO integration ${integration.id ? 'updated' : 'created'} for gym ${gymId}`);
  return integration;
}

/**
 * Create default field mappings for EVO
 */
async function createDefaultFieldMappings(integrationId: string) {
  const defaultMappings = [
    { duxfitField: 'name', externalField: 'member_name' },
    { duxfitField: 'cpf', externalField: 'cpf_number' },
    { duxfitField: 'email', externalField: 'email_address' },
    { duxfitField: 'phone', externalField: 'phone_number' },
    { duxfitField: 'birthDate', externalField: 'birth_date' },
    { duxfitField: 'address', externalField: 'address_line_1' },
    { duxfitField: 'zipCode', externalField: 'postal_code' }
  ];

  for (const mapping of defaultMappings) {
    await prisma.fieldMapping.upsert({
      where: {
        integrationId_duxfitField: {
          integrationId,
          duxfitField: mapping.duxfitField
        }
      },
      update: mapping,
      create: {
        integrationId,
        ...mapping
      }
    });
  }
}

/**
 * Sync leads from EVO to DuxFit
 */
export async function syncLeadsFromEVO(gymId: string, integrationId: string): Promise<EVOSyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const newLeads: EVOLead[] = [];
  const updatedLeads: EVOLead[] = [];

  try {
    // Get integration config
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
      include: { fieldMappings: true }
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    const config = integration.config as any as EVOConfig;

    // Create sync history record
    const syncRecord = await prisma.syncHistory.create({
      data: {
        integrationId,
        type: 'MANUAL',
        status: 'RUNNING',
        startedAt: new Date()
      }
    });

    try {
      // Fetch leads from EVO API
      const response = await fetch(`${config.apiUrl}/api/leads`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'X-Branch-ID': config.branchId
        }
      });

      if (!response.ok) {
        throw new Error(`EVO API error: ${response.status} ${response.statusText}`);
      }

      const evoLeads = await response.json() as EVOLead[];

      // Process each lead
      for (const evoLead of evoLeads) {
        try {
          // Check if lead already exists
          const existingLead = await prisma.lead.findFirst({
            where: {
              gymId,
              OR: [
                { phone: evoLead.phone },
                { evoMemberId: evoLead.evoMemberId }
              ]
            }
          });

          const leadData = {
            gymId,
            name: evoLead.name,
            email: evoLead.email,
            phone: evoLead.phone,
            cpf: evoLead.cpf,
            birthDate: evoLead.birthDate ? new Date(evoLead.birthDate) : null,
            address: evoLead.address,
            zipCode: evoLead.zipCode,
            status: mapEVOStatusToDuxFit(evoLead.status) as any,
            source: 'EVO' as any,
            score: evoLead.score,
            notes: evoLead.notes,
            evoMemberId: evoLead.evoMemberId
          };

          if (existingLead) {
            // Update existing lead
            await prisma.lead.update({
              where: { id: existingLead.id },
              data: leadData
            });
            updatedLeads.push(evoLead);
          } else {
            // Create new lead
            await prisma.lead.create({
              data: leadData
            });
            newLeads.push(evoLead);
          }
        } catch (leadError) {
          const errorMsg = `Failed to process lead ${evoLead.phone}: ${leadError}`;
          errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }

      // Update sync record
      const duration = Date.now() - startTime;
      await prisma.syncHistory.update({
        where: { id: syncRecord.id },
        data: {
          status: 'SUCCESS',
          recordsSynced: newLeads.length + updatedLeads.length,
          duration,
          completedAt: new Date(),
          errorMessage: errors.length > 0 ? errors.join('; ') : null
        }
      });

      // Update integration last sync time
      await prisma.integration.update({
        where: { id: integrationId },
        data: { lastSyncAt: new Date() }
      });

      logger.info(`EVO sync completed: ${newLeads.length} new, ${updatedLeads.length} updated, ${errors.length} errors`);

      return {
        success: true,
        recordsSynced: newLeads.length + updatedLeads.length,
        duration,
        errors,
        newLeads,
        updatedLeads
      };

    } catch (syncError) {
      // Update sync record with error
      await prisma.syncHistory.update({
        where: { id: syncRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: syncError.message,
          completedAt: new Date()
        }
      });

      throw syncError;
    }

  } catch (error) {
    logger.error('EVO sync failed:', error);
    return {
      success: false,
      recordsSynced: 0,
      duration: Date.now() - startTime,
      errors: [error.message],
      newLeads: [],
      updatedLeads: []
    };
  }
}

/**
 * Sync leads from DuxFit to EVO
 */
export async function syncLeadsToEVO(gymId: string, integrationId: string): Promise<EVOSyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const newLeads: EVOLead[] = [];
  const updatedLeads: EVOLead[] = [];

  try {
    // Get integration config
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
      include: { fieldMappings: true }
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    const config = integration.config as any as EVOConfig;

    // Get leads that need to be synced to EVO
    const leads = await prisma.lead.findMany({
      where: {
        gymId,
        isDeleted: false,
        OR: [
          { evoMemberId: null },
          { updatedAt: { gt: integration.lastSyncAt || new Date(0) } }
        ]
      }
    });

    // Create sync history record
    const syncRecord = await prisma.syncHistory.create({
      data: {
        integrationId,
        type: 'MANUAL',
        status: 'RUNNING',
        startedAt: new Date()
      }
    });

    try {
      for (const lead of leads) {
        try {
          const evoLeadData = {
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            cpf: lead.cpf,
            birthDate: lead.birthDate?.toISOString(),
            address: lead.address,
            zipCode: lead.zipCode,
            status: mapDuxFitStatusToEVO(lead.status),
            source: lead.source,
            score: lead.score,
            notes: lead.notes
          };

          if (lead.evoMemberId) {
            // Update existing EVO member
            const response = await fetch(`${config.apiUrl}/api/members/${lead.evoMemberId}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
                'X-Branch-ID': config.branchId
              },
              body: JSON.stringify(evoLeadData)
            });

            if (response.ok) {
              updatedLeads.push(evoLeadData as EVOLead);
            } else {
              errors.push(`Failed to update EVO member ${lead.evoMemberId}: ${response.statusText}`);
            }
          } else {
            // Create new EVO member
            const response = await fetch(`${config.apiUrl}/api/members`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
                'X-Branch-ID': config.branchId
              },
              body: JSON.stringify(evoLeadData)
            });

            if (response.ok) {
              const createdMember = await response.json() as any;
              // Update lead with EVO member ID
              await prisma.lead.update({
                where: { id: lead.id },
                data: { evoMemberId: createdMember.id }
              });
              newLeads.push(evoLeadData as EVOLead);
            } else {
              errors.push(`Failed to create EVO member for lead ${lead.id}: ${response.statusText}`);
            }
          }
        } catch (leadError) {
          const errorMsg = `Failed to sync lead ${lead.id}: ${leadError}`;
          errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }

      // Update sync record
      const duration = Date.now() - startTime;
      await prisma.syncHistory.update({
        where: { id: syncRecord.id },
        data: {
          status: 'SUCCESS',
          recordsSynced: newLeads.length + updatedLeads.length,
          duration,
          completedAt: new Date(),
          errorMessage: errors.length > 0 ? errors.join('; ') : null
        }
      });

      // Update integration last sync time
      await prisma.integration.update({
        where: { id: integrationId },
        data: { lastSyncAt: new Date() }
      });

      logger.info(`EVO sync to EVO completed: ${newLeads.length} new, ${updatedLeads.length} updated, ${errors.length} errors`);

      return {
        success: true,
        recordsSynced: newLeads.length + updatedLeads.length,
        duration,
        errors,
        newLeads,
        updatedLeads
      };

    } catch (syncError) {
      // Update sync record with error
      await prisma.syncHistory.update({
        where: { id: syncRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: syncError.message,
          completedAt: new Date()
        }
      });

      throw syncError;
    }

  } catch (error) {
    logger.error('EVO sync to EVO failed:', error);
    return {
      success: false,
      recordsSynced: 0,
      duration: Date.now() - startTime,
      errors: [error.message],
      newLeads: [],
      updatedLeads: []
    };
  }
}

/**
 * Map EVO status to DuxFit status
 */
function mapEVOStatusToDuxFit(evoStatus: string): string {
  const statusMap: { [key: string]: string } = {
    'new': 'NEW',
    'contacted': 'CONTACTED',
    'qualified': 'QUALIFIED',
    'negotiating': 'NEGOTIATING',
    'closed': 'CLOSED',
    'lost': 'LOST'
  };
  return statusMap[evoStatus.toLowerCase()] || 'NEW';
}

/**
 * Map DuxFit status to EVO status
 */
function mapDuxFitStatusToEVO(duxfitStatus: string): string {
  const statusMap: { [key: string]: string } = {
    'NEW': 'new',
    'CONTACTED': 'contacted',
    'QUALIFIED': 'qualified',
    'NEGOTIATING': 'negotiating',
    'CLOSED': 'closed',
    'LOST': 'lost'
  };
  return statusMap[duxfitStatus] || 'new';
}

/**
 * Get sync history for integration
 */
export async function getSyncHistory(integrationId: string, limit: number = 50) {
  return await prisma.syncHistory.findMany({
    where: { integrationId },
    orderBy: { startedAt: 'desc' },
    take: limit
  });
}

/**
 * Update field mappings
 */
export async function updateFieldMappings(integrationId: string, mappings: Array<{
  duxfitField: string;
  externalField: string;
  isActive: boolean;
}>) {
  // Delete existing mappings
  await prisma.fieldMapping.deleteMany({
    where: { integrationId }
  });

  // Create new mappings
  await prisma.fieldMapping.createMany({
    data: mappings.map(mapping => ({
      integrationId,
      ...mapping
    }))
  });

  logger.info(`Field mappings updated for integration ${integrationId}`);
}
