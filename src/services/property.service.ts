import prisma from '../config/database';
import { softDelete } from '../utils/softDelete';
import { triggerWebhooks } from './webhook.service';

export interface CreatePropertyData {
  agencyId: string;
  agentId?: string;
  title: string;
  description?: string;
  reference?: string;
  propertyType: string;
  transactionType: string;
  address?: string;
  city?: string;
  zone?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  price: number;
  pricePerSqm?: number;
  sqmTotal?: number;
  sqmBuilt?: number;
  sqmUsable?: number;
  bedrooms?: number;
  bathrooms?: number;
  floors?: number;
  floor?: number;
  hasElevator?: boolean;
  hasParking?: boolean;
  parkingSpaces?: number;
  hasPool?: boolean;
  hasTerrace?: boolean;
  hasGarden?: boolean;
  hasAC?: boolean;
  hasHeating?: boolean;
  yearBuilt?: number;
  energyRating?: string;
  features?: string[];
  images?: string[];
  videoUrl?: string;
  virtualTourUrl?: string;
  status?: string;
  featured?: boolean;
}

export interface UpdatePropertyData extends Partial<CreatePropertyData> {}

export interface PropertyFilters {
  agencyId?: string;
  search?: string;
  propertyType?: string;
  transactionType?: string;
  status?: string;
  city?: string;
  zone?: string;
  minPrice?: number;
  maxPrice?: number;
  minSqm?: number;
  maxSqm?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  hasParking?: boolean;
  hasPool?: boolean;
  hasTerrace?: boolean;
  hasGarden?: boolean;
  featured?: boolean;
  showDeleted?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Obtener todas las propiedades con filtros
 */
export async function getAllProperties(filters: PropertyFilters = {}) {
  const {
    agencyId,
    search,
    propertyType,
    transactionType,
    status,
    city,
    zone,
    minPrice,
    maxPrice,
    minSqm,
    maxSqm,
    minBedrooms,
    minBathrooms,
    hasParking,
    hasPool,
    hasTerrace,
    hasGarden,
    featured,
    showDeleted = false,
    limit = 50,
    offset = 0,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = filters;

  const where: any = {};

  if (!showDeleted) {
    where.isDeleted = false;
  }

  if (agencyId) {
    where.agencyId = agencyId;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { reference: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { zone: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (propertyType) {
    where.propertyType = propertyType;
  }

  if (transactionType) {
    where.transactionType = transactionType;
  }

  if (status && status !== 'all') {
    where.status = status;
  }

  if (city) {
    where.city = { contains: city, mode: 'insensitive' };
  }

  if (zone) {
    where.zone = { contains: zone, mode: 'insensitive' };
  }

  if (minPrice !== undefined) {
    where.price = { ...where.price, gte: minPrice };
  }

  if (maxPrice !== undefined) {
    where.price = { ...where.price, lte: maxPrice };
  }

  if (minSqm !== undefined) {
    where.sqmTotal = { ...where.sqmTotal, gte: minSqm };
  }

  if (maxSqm !== undefined) {
    where.sqmTotal = { ...where.sqmTotal, lte: maxSqm };
  }

  if (minBedrooms !== undefined) {
    where.bedrooms = { gte: minBedrooms };
  }

  if (minBathrooms !== undefined) {
    where.bathrooms = { gte: minBathrooms };
  }

  if (hasParking !== undefined) {
    where.hasParking = hasParking;
  }

  if (hasPool !== undefined) {
    where.hasPool = hasPool;
  }

  if (hasTerrace !== undefined) {
    where.hasTerrace = hasTerrace;
  }

  if (hasGarden !== undefined) {
    where.hasGarden = hasGarden;
  }

  if (featured !== undefined) {
    where.featured = featured;
  }

  const orderBy: any = {};
  orderBy[sortBy] = sortOrder;

  const [properties, total] = await Promise.all([
    prisma.property.findMany({
      where,
      include: {
        agency: {
          select: {
            id: true,
            name: true,
            logo: true
          }
        },
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatar: true
          }
        },
        _count: {
          select: {
            visits: true,
            leadInterests: true
          }
        }
      },
      orderBy,
      take: limit,
      skip: offset
    }),
    prisma.property.count({ where })
  ]);

  return {
    properties,
    total,
    hasMore: offset + limit < total
  };
}

/**
 * Obtener propiedad por ID
 */
export async function getPropertyById(propertyId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      agency: {
        select: {
          id: true,
          name: true,
          logo: true,
          phone: true,
          email: true
        }
      },
      agent: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          avatar: true
        }
      },
      visits: {
        where: {
          status: { in: ['SCHEDULED', 'CONFIRMED'] }
        },
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              phone: true
            }
          }
        },
        orderBy: { scheduledAt: 'asc' },
        take: 10
      },
      leadInterests: {
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true
            }
          }
        },
        orderBy: { interest: 'desc' },
        take: 10
      },
      _count: {
        select: {
          visits: true,
          leadInterests: true
        }
      }
    }
  });

  if (!property) {
    throw new Error('Propiedad no encontrada');
  }

  return property;
}

/**
 * Crear nueva propiedad
 */
export async function createProperty(data: CreatePropertyData, createdBy: string) {
  // Calcular precio por m² si no se proporciona
  if (data.sqmTotal && data.price && !data.pricePerSqm) {
    data.pricePerSqm = Math.round(data.price / data.sqmTotal);
  }

  const property = await prisma.property.create({
    data: {
      agencyId: data.agencyId,
      agentId: data.agentId,
      title: data.title,
      description: data.description,
      reference: data.reference,
      propertyType: data.propertyType as any,
      transactionType: data.transactionType as any,
      address: data.address,
      city: data.city,
      zone: data.zone,
      state: data.state,
      zipCode: data.zipCode,
      country: data.country || 'España',
      latitude: data.latitude,
      longitude: data.longitude,
      price: data.price,
      pricePerSqm: data.pricePerSqm,
      sqmTotal: data.sqmTotal,
      sqmBuilt: data.sqmBuilt,
      sqmUsable: data.sqmUsable,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      floors: data.floors,
      floor: data.floor,
      hasElevator: data.hasElevator,
      hasParking: data.hasParking,
      parkingSpaces: data.parkingSpaces,
      hasPool: data.hasPool,
      hasTerrace: data.hasTerrace,
      hasGarden: data.hasGarden,
      hasAC: data.hasAC,
      hasHeating: data.hasHeating,
      yearBuilt: data.yearBuilt,
      energyRating: data.energyRating,
      features: data.features || [],
      images: data.images || [],
      videoUrl: data.videoUrl,
      virtualTourUrl: data.virtualTourUrl,
      status: (data.status as any) || 'DRAFT',
      featured: data.featured || false
    },
    include: {
      agency: {
        select: { id: true, name: true }
      },
      agent: {
        select: { id: true, name: true }
      }
    }
  });

  console.log(`✅ Propiedad creada: ${property.title} por ${createdBy}`);

  // Disparar webhook
  await triggerWebhooks(data.agencyId, 'PROPERTY_CREATED', {
    propertyId: property.id,
    title: property.title,
    propertyType: property.propertyType,
    transactionType: property.transactionType,
    price: property.price,
    city: property.city,
    zone: property.zone
  });

  return property;
}

/**
 * Actualizar propiedad
 */
export async function updateProperty(propertyId: string, data: UpdatePropertyData, updatedBy: string) {
  const existing = await prisma.property.findUnique({
    where: { id: propertyId }
  });

  if (!existing) {
    throw new Error('Propiedad no encontrada');
  }

  // Recalcular precio por m² si se actualiza precio o superficie
  if ((data.sqmTotal || existing.sqmTotal) && (data.price || existing.price)) {
    const sqm = data.sqmTotal || existing.sqmTotal;
    const price = data.price || existing.price;
    if (sqm && price) {
      data.pricePerSqm = Math.round(price / sqm);
    }
  }

  const property = await prisma.property.update({
    where: { id: propertyId },
    data: data as any,
    include: {
      agency: {
        select: { id: true, name: true }
      },
      agent: {
        select: { id: true, name: true }
      }
    }
  });

  console.log(`✅ Propiedad actualizada: ${property.title} por ${updatedBy}`);

  // Disparar webhook
  await triggerWebhooks(existing.agencyId, 'PROPERTY_UPDATED', {
    propertyId: property.id,
    title: property.title,
    changes: Object.keys(data)
  });

  return property;
}

/**
 * Eliminar propiedad (soft delete)
 */
export async function deleteProperty(propertyId: string, deletedBy: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId }
  });

  if (!property) {
    throw new Error('Propiedad no encontrada');
  }

  await softDelete(prisma.property, propertyId, deletedBy);

  console.log(`🗑️ Propiedad eliminada: ${propertyId} por ${deletedBy}`);

  // Disparar webhook
  await triggerWebhooks(property.agencyId, 'PROPERTY_DELETED', {
    propertyId: property.id,
    title: property.title
  });
}

/**
 * Publicar propiedad
 */
export async function publishProperty(propertyId: string, updatedBy: string) {
  const property = await prisma.property.update({
    where: { id: propertyId },
    data: {
      status: 'AVAILABLE',
      publishedAt: new Date()
    }
  });

  console.log(`📢 Propiedad publicada: ${property.title} por ${updatedBy}`);
  return property;
}

/**
 * Cambiar estado de propiedad
 */
export async function updatePropertyStatus(propertyId: string, status: string, updatedBy: string) {
  const property = await prisma.property.update({
    where: { id: propertyId },
    data: { status: status as any }
  });

  console.log(`✅ Estado de propiedad actualizado: ${property.title} -> ${status} por ${updatedBy}`);

  // Disparar webhook
  await triggerWebhooks(property.agencyId, 'PROPERTY_STATUS_CHANGED', {
    propertyId: property.id,
    title: property.title,
    newStatus: status
  });

  return property;
}

/**
 * Obtener propiedades similares
 */
export async function getSimilarProperties(propertyId: string, limit: number = 4) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId }
  });

  if (!property) {
    throw new Error('Propiedad no encontrada');
  }

  const priceRange = property.price * 0.2; // ±20%

  const similar = await prisma.property.findMany({
    where: {
      id: { not: propertyId },
      agencyId: property.agencyId,
      isDeleted: false,
      status: 'AVAILABLE',
      propertyType: property.propertyType,
      transactionType: property.transactionType,
      price: {
        gte: property.price - priceRange,
        lte: property.price + priceRange
      },
      OR: [
        { city: property.city },
        { zone: property.zone }
      ]
    },
    include: {
      agency: {
        select: { id: true, name: true, logo: true }
      }
    },
    take: limit,
    orderBy: { createdAt: 'desc' }
  });

  return similar;
}

/**
 * Buscar propiedades que coincidan con los criterios de un lead
 */
export async function matchPropertiesForLead(leadId: string, limit: number = 10) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId }
  });

  if (!lead) {
    throw new Error('Lead no encontrado');
  }

  const where: any = {
    agencyId: lead.agencyId,
    isDeleted: false,
    status: 'AVAILABLE'
  };

  if (lead.transactionInterest) {
    where.transactionType = lead.transactionInterest;
  }

  if (lead.propertyTypeInterest && lead.propertyTypeInterest.length > 0) {
    where.propertyType = { in: lead.propertyTypeInterest };
  }

  if (lead.budgetMin || lead.budgetMax) {
    where.price = {};
    if (lead.budgetMin) where.price.gte = lead.budgetMin;
    if (lead.budgetMax) where.price.lte = lead.budgetMax;
  }

  if (lead.sqmMin || lead.sqmMax) {
    where.sqmTotal = {};
    if (lead.sqmMin) where.sqmTotal.gte = lead.sqmMin;
    if (lead.sqmMax) where.sqmTotal.lte = lead.sqmMax;
  }

  if (lead.bedroomsMin) {
    where.bedrooms = { gte: lead.bedroomsMin };
  }

  if (lead.preferredZones && lead.preferredZones.length > 0) {
    where.OR = lead.preferredZones.map(zone => ({
      zone: { contains: zone, mode: 'insensitive' }
    }));
  }

  const properties = await prisma.property.findMany({
    where,
    include: {
      agency: {
        select: { id: true, name: true, logo: true }
      },
      agent: {
        select: { id: true, name: true, phone: true }
      }
    },
    take: limit,
    orderBy: [
      { featured: 'desc' },
      { createdAt: 'desc' }
    ]
  });

  return properties;
}

/**
 * Obtener estadísticas de propiedades
 */
export async function getPropertyStatistics(agencyId: string) {
  const [
    total,
    available,
    reserved,
    sold,
    rented,
    draft,
    byType,
    byTransaction,
    avgPrice
  ] = await Promise.all([
    prisma.property.count({ where: { agencyId, isDeleted: false } }),
    prisma.property.count({ where: { agencyId, isDeleted: false, status: 'AVAILABLE' } }),
    prisma.property.count({ where: { agencyId, isDeleted: false, status: 'RESERVED' } }),
    prisma.property.count({ where: { agencyId, isDeleted: false, status: 'SOLD' } }),
    prisma.property.count({ where: { agencyId, isDeleted: false, status: 'RENTED' } }),
    prisma.property.count({ where: { agencyId, isDeleted: false, status: 'DRAFT' } }),
    prisma.property.groupBy({
      by: ['propertyType'],
      where: { agencyId, isDeleted: false },
      _count: true
    }),
    prisma.property.groupBy({
      by: ['transactionType'],
      where: { agencyId, isDeleted: false },
      _count: true
    }),
    prisma.property.aggregate({
      where: { agencyId, isDeleted: false, status: 'AVAILABLE' },
      _avg: { price: true }
    })
  ]);

  return {
    total,
    byStatus: {
      available,
      reserved,
      sold,
      rented,
      draft
    },
    byType: byType.map(t => ({ type: t.propertyType, count: t._count })),
    byTransaction: byTransaction.map(t => ({ type: t.transactionType, count: t._count })),
    avgPrice: avgPrice._avg.price || 0
  };
}

/**
 * Agregar imagen a propiedad
 */
export async function addPropertyImage(propertyId: string, imageUrl: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId }
  });

  if (!property) {
    throw new Error('Propiedad no encontrada');
  }

  const images = [...(property.images || []), imageUrl];

  return prisma.property.update({
    where: { id: propertyId },
    data: { images }
  });
}

/**
 * Eliminar imagen de propiedad
 */
export async function removePropertyImage(propertyId: string, imageUrl: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId }
  });

  if (!property) {
    throw new Error('Propiedad no encontrada');
  }

  const images = (property.images || []).filter(img => img !== imageUrl);

  return prisma.property.update({
    where: { id: propertyId },
    data: { images }
  });
}

/**
 * Reordenar imágenes de propiedad
 */
export async function reorderPropertyImages(propertyId: string, images: string[]) {
  return prisma.property.update({
    where: { id: propertyId },
    data: { images }
  });
}
