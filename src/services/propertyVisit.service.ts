import prisma from '../config/database';
import { triggerWebhooks } from './webhook.service';
import * as notificationService from './notification.service';

export interface CreateVisitData {
  agencyId: string;
  propertyId: string;
  leadId: string;
  agentId?: string;
  scheduledAt: Date;
  duration?: number;
  notes?: string;
}

export interface UpdateVisitData {
  agentId?: string;
  scheduledAt?: Date;
  duration?: number;
  notes?: string;
  feedback?: string;
  rating?: number;
}

export interface VisitFilters {
  agencyId?: string;
  propertyId?: string;
  leadId?: string;
  agentId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Obtener todas las visitas con filtros
 */
export async function getAllVisits(filters: VisitFilters = {}) {
  const {
    agencyId,
    propertyId,
    leadId,
    agentId,
    status,
    startDate,
    endDate,
    limit = 50,
    offset = 0
  } = filters;

  const where: any = {};

  if (agencyId) {
    where.agencyId = agencyId;
  }

  if (propertyId) {
    where.propertyId = propertyId;
  }

  if (leadId) {
    where.leadId = leadId;
  }

  if (agentId) {
    where.agentId = agentId;
  }

  if (status && status !== 'all') {
    where.status = status;
  }

  if (startDate || endDate) {
    where.scheduledAt = {};
    if (startDate) where.scheduledAt.gte = startDate;
    if (endDate) where.scheduledAt.lte = endDate;
  }

  const [visits, total] = await Promise.all([
    prisma.propertyVisit.findMany({
      where,
      include: {
        property: {
          select: {
            id: true,
            title: true,
            address: true,
            city: true,
            zone: true,
            price: true,
            propertyType: true,
            transactionType: true,
            images: true
          }
        },
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        },
        agent: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            avatar: true
          }
        },
        agency: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
      skip: offset
    }),
    prisma.propertyVisit.count({ where })
  ]);

  return {
    visits,
    total,
    hasMore: offset + limit < total
  };
}

/**
 * Obtener visita por ID
 */
export async function getVisitById(visitId: string) {
  const visit = await prisma.propertyVisit.findUnique({
    where: { id: visitId },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          address: true,
          city: true,
          zone: true,
          price: true,
          propertyType: true,
          transactionType: true,
          images: true,
          bedrooms: true,
          bathrooms: true,
          sqmTotal: true
        }
      },
      lead: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          budgetMin: true,
          budgetMax: true
        }
      },
      agent: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          avatar: true
        }
      },
      agency: {
        select: {
          id: true,
          name: true,
          phone: true
        }
      }
    }
  });

  if (!visit) {
    throw new Error('Visita no encontrada');
  }

  return visit;
}

/**
 * Crear nueva visita
 */
export async function createVisit(data: CreateVisitData, createdBy: string) {
  // Verificar que la propiedad existe
  const property = await prisma.property.findUnique({
    where: { id: data.propertyId },
    select: { id: true, title: true, agencyId: true }
  });

  if (!property) {
    throw new Error('Propiedad no encontrada');
  }

  // Verificar que el lead existe
  const lead = await prisma.lead.findUnique({
    where: { id: data.leadId },
    select: { id: true, name: true, phone: true }
  });

  if (!lead) {
    throw new Error('Lead no encontrado');
  }

  // Verificar disponibilidad del agente si se especifica
  if (data.agentId) {
    const conflictingVisit = await prisma.propertyVisit.findFirst({
      where: {
        agentId: data.agentId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        scheduledAt: {
          gte: new Date(new Date(data.scheduledAt).getTime() - 30 * 60000), // 30 min antes
          lte: new Date(new Date(data.scheduledAt).getTime() + (data.duration || 30) * 60000)
        }
      }
    });

    if (conflictingVisit) {
      throw new Error('El agente tiene otra visita programada en ese horario');
    }
  }

  const endTime = new Date(new Date(data.scheduledAt).getTime() + (data.duration || 30) * 60000);

  const visit = await prisma.propertyVisit.create({
    data: {
      agencyId: data.agencyId,
      propertyId: data.propertyId,
      leadId: data.leadId,
      agentId: data.agentId,
      scheduledAt: data.scheduledAt,
      duration: data.duration || 30,
      endTime,
      notes: data.notes,
      status: 'SCHEDULED'
    },
    include: {
      property: {
        select: { id: true, title: true, address: true }
      },
      lead: {
        select: { id: true, name: true, phone: true }
      },
      agent: {
        select: { id: true, name: true }
      }
    }
  });

  console.log(`✅ Visita programada: ${property.title} para ${lead.name} por ${createdBy}`);

  // Crear notificación para el agente asignado
  if (data.agentId) {
    await notificationService.createNotification({
      userId: data.agentId,
      type: 'VISIT_SCHEDULED',
      title: 'Nueva visita programada',
      message: `Visita programada para ${lead.name} - ${property.title}`,
      data: {
        visitId: visit.id,
        propertyId: data.propertyId,
        leadId: data.leadId,
        scheduledAt: data.scheduledAt
      }
    });
  }

  // Disparar webhook
  await triggerWebhooks(data.agencyId, 'VISIT_SCHEDULED', {
    visitId: visit.id,
    propertyId: data.propertyId,
    propertyTitle: property.title,
    leadId: data.leadId,
    leadName: lead.name,
    leadPhone: lead.phone,
    scheduledAt: data.scheduledAt,
    agentId: data.agentId
  });

  return visit;
}

/**
 * Actualizar visita
 */
export async function updateVisit(visitId: string, data: UpdateVisitData, updatedBy: string) {
  const existing = await prisma.propertyVisit.findUnique({
    where: { id: visitId }
  });

  if (!existing) {
    throw new Error('Visita no encontrada');
  }

  // Calcular nuevo endTime si se actualiza scheduledAt o duration
  let endTime = existing.endTime;
  if (data.scheduledAt || data.duration) {
    const scheduledAt = data.scheduledAt || existing.scheduledAt;
    const duration = data.duration || existing.duration;
    endTime = new Date(new Date(scheduledAt).getTime() + duration * 60000);
  }

  const visit = await prisma.propertyVisit.update({
    where: { id: visitId },
    data: {
      ...data,
      endTime
    },
    include: {
      property: {
        select: { id: true, title: true }
      },
      lead: {
        select: { id: true, name: true }
      }
    }
  });

  console.log(`✅ Visita actualizada: ${visitId} por ${updatedBy}`);

  return visit;
}

/**
 * Confirmar visita
 */
export async function confirmVisit(visitId: string, confirmedBy: string) {
  const visit = await prisma.propertyVisit.update({
    where: { id: visitId },
    data: {
      status: 'CONFIRMED',
      confirmedAt: new Date()
    },
    include: {
      property: {
        select: { id: true, title: true }
      },
      lead: {
        select: { id: true, name: true, phone: true }
      },
      agent: {
        select: { id: true, name: true }
      }
    }
  });

  console.log(`✅ Visita confirmada: ${visitId} por ${confirmedBy}`);

  // Disparar webhook
  await triggerWebhooks(visit.agencyId, 'VISIT_CONFIRMED', {
    visitId: visit.id,
    propertyTitle: visit.property.title,
    leadName: visit.lead.name,
    leadPhone: visit.lead.phone,
    scheduledAt: visit.scheduledAt
  });

  return visit;
}

/**
 * Completar visita
 */
export async function completeVisit(visitId: string, feedback: string | undefined, rating: number | undefined, completedBy: string) {
  const visit = await prisma.propertyVisit.update({
    where: { id: visitId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      feedback,
      rating
    },
    include: {
      property: {
        select: { id: true, title: true }
      },
      lead: {
        select: { id: true, name: true }
      }
    }
  });

  console.log(`✅ Visita completada: ${visitId} por ${completedBy}`);

  // Actualizar estado del lead a VISITING
  await prisma.lead.update({
    where: { id: visit.leadId },
    data: { status: 'VISITING' }
  });

  // Disparar webhook
  await triggerWebhooks(visit.agencyId, 'VISIT_COMPLETED', {
    visitId: visit.id,
    propertyTitle: visit.property.title,
    leadName: visit.lead.name,
    feedback,
    rating
  });

  return visit;
}

/**
 * Cancelar visita
 */
export async function cancelVisit(visitId: string, reason: string | undefined, cancelledBy: string) {
  const visit = await prisma.propertyVisit.update({
    where: { id: visitId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelReason: reason
    },
    include: {
      property: {
        select: { id: true, title: true }
      },
      lead: {
        select: { id: true, name: true, phone: true }
      },
      agent: {
        select: { id: true }
      }
    }
  });

  console.log(`❌ Visita cancelada: ${visitId} por ${cancelledBy}`);

  // Notificar al agente
  if (visit.agent) {
    await notificationService.createNotification({
      userId: visit.agent.id,
      type: 'VISIT_CANCELLED',
      title: 'Visita cancelada',
      message: `La visita de ${visit.lead.name} a ${visit.property.title} ha sido cancelada`,
      data: {
        visitId: visit.id,
        reason
      }
    });
  }

  // Disparar webhook
  await triggerWebhooks(visit.agencyId, 'VISIT_CANCELLED', {
    visitId: visit.id,
    propertyTitle: visit.property.title,
    leadName: visit.lead.name,
    leadPhone: visit.lead.phone,
    reason
  });

  return visit;
}

/**
 * Marcar no show (el cliente no se presentó)
 */
export async function markNoShow(visitId: string, markedBy: string) {
  const visit = await prisma.propertyVisit.update({
    where: { id: visitId },
    data: {
      status: 'NO_SHOW'
    }
  });

  console.log(`⚠️ Visita marcada como no show: ${visitId} por ${markedBy}`);

  return visit;
}

/**
 * Reprogramar visita
 */
export async function rescheduleVisit(visitId: string, newDate: Date, updatedBy: string) {
  const existing = await prisma.propertyVisit.findUnique({
    where: { id: visitId }
  });

  if (!existing) {
    throw new Error('Visita no encontrada');
  }

  const endTime = new Date(new Date(newDate).getTime() + existing.duration * 60000);

  const visit = await prisma.propertyVisit.update({
    where: { id: visitId },
    data: {
      status: 'RESCHEDULED',
      scheduledAt: newDate,
      endTime
    },
    include: {
      property: {
        select: { id: true, title: true }
      },
      lead: {
        select: { id: true, name: true, phone: true }
      }
    }
  });

  console.log(`🔄 Visita reprogramada: ${visitId} para ${newDate} por ${updatedBy}`);

  // Crear nueva visita con la fecha actualizada
  const newVisit = await prisma.propertyVisit.create({
    data: {
      agencyId: existing.agencyId,
      propertyId: existing.propertyId,
      leadId: existing.leadId,
      agentId: existing.agentId,
      scheduledAt: newDate,
      duration: existing.duration,
      endTime,
      notes: existing.notes,
      status: 'SCHEDULED'
    }
  });

  // Disparar webhook
  await triggerWebhooks(visit.agencyId, 'VISIT_RESCHEDULED', {
    oldVisitId: visitId,
    newVisitId: newVisit.id,
    propertyTitle: visit.property.title,
    leadName: visit.lead.name,
    leadPhone: visit.lead.phone,
    oldDate: existing.scheduledAt,
    newDate
  });

  return newVisit;
}

/**
 * Enviar recordatorio de visita
 */
export async function sendVisitReminder(visitId: string) {
  const visit = await prisma.propertyVisit.findUnique({
    where: { id: visitId },
    include: {
      property: {
        select: { id: true, title: true, address: true }
      },
      lead: {
        select: { id: true, name: true, phone: true }
      },
      agent: {
        select: { id: true, name: true }
      }
    }
  });

  if (!visit) {
    throw new Error('Visita no encontrada');
  }

  // Actualizar que se envió recordatorio
  await prisma.propertyVisit.update({
    where: { id: visitId },
    data: {
      reminderSent: true,
      reminderSentAt: new Date()
    }
  });

  console.log(`📧 Recordatorio enviado para visita: ${visitId}`);

  // El mensaje real se enviaría por WhatsApp - aquí solo registramos
  return {
    sent: true,
    visitId,
    leadPhone: visit.lead.phone,
    message: `Recordatorio: Tiene una visita programada para ${visit.property.title} el ${visit.scheduledAt.toLocaleString('es-ES')}`
  };
}

/**
 * Obtener visitas pendientes de hoy
 */
export async function getTodayVisits(agencyId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.propertyVisit.findMany({
    where: {
      agencyId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      scheduledAt: {
        gte: today,
        lt: tomorrow
      }
    },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          address: true,
          images: true
        }
      },
      lead: {
        select: {
          id: true,
          name: true,
          phone: true
        }
      },
      agent: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: { scheduledAt: 'asc' }
  });
}

/**
 * Obtener próximas visitas
 */
export async function getUpcomingVisits(agencyId: string, days: number = 7) {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return prisma.propertyVisit.findMany({
    where: {
      agencyId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      scheduledAt: {
        gte: now,
        lte: futureDate
      }
    },
    include: {
      property: {
        select: {
          id: true,
          title: true,
          address: true,
          city: true,
          images: true
        }
      },
      lead: {
        select: {
          id: true,
          name: true,
          phone: true
        }
      },
      agent: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: { scheduledAt: 'asc' }
  });
}

/**
 * Obtener estadísticas de visitas
 */
export async function getVisitStatistics(agencyId: string, startDate?: Date, endDate?: Date) {
  const where: any = { agencyId };

  if (startDate || endDate) {
    where.scheduledAt = {};
    if (startDate) where.scheduledAt.gte = startDate;
    if (endDate) where.scheduledAt.lte = endDate;
  }

  const [
    total,
    scheduled,
    confirmed,
    completed,
    cancelled,
    noShow,
    byAgent,
    avgRating
  ] = await Promise.all([
    prisma.propertyVisit.count({ where }),
    prisma.propertyVisit.count({ where: { ...where, status: 'SCHEDULED' } }),
    prisma.propertyVisit.count({ where: { ...where, status: 'CONFIRMED' } }),
    prisma.propertyVisit.count({ where: { ...where, status: 'COMPLETED' } }),
    prisma.propertyVisit.count({ where: { ...where, status: 'CANCELLED' } }),
    prisma.propertyVisit.count({ where: { ...where, status: 'NO_SHOW' } }),
    prisma.propertyVisit.groupBy({
      by: ['agentId'],
      where: { ...where, agentId: { not: null } },
      _count: true
    }),
    prisma.propertyVisit.aggregate({
      where: { ...where, status: 'COMPLETED', rating: { not: null } },
      _avg: { rating: true }
    })
  ]);

  const conversionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : '0';
  const cancellationRate = total > 0 ? ((cancelled / total) * 100).toFixed(1) : '0';

  return {
    total,
    byStatus: {
      scheduled,
      confirmed,
      completed,
      cancelled,
      noShow
    },
    byAgent,
    conversionRate: parseFloat(conversionRate),
    cancellationRate: parseFloat(cancellationRate),
    avgRating: avgRating._avg.rating || 0
  };
}

/**
 * Obtener disponibilidad de un agente
 */
export async function getAgentAvailability(agentId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const visits = await prisma.propertyVisit.findMany({
    where: {
      agentId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      scheduledAt: {
        gte: startOfDay,
        lte: endOfDay
      }
    },
    select: {
      scheduledAt: true,
      duration: true,
      endTime: true
    },
    orderBy: { scheduledAt: 'asc' }
  });

  // Horario laboral: 9:00 - 20:00
  const workingHours = {
    start: 9,
    end: 20
  };

  const busySlots = visits.map(v => ({
    start: v.scheduledAt,
    end: v.endTime
  }));

  return {
    date,
    workingHours,
    busySlots,
    visitsCount: visits.length
  };
}
