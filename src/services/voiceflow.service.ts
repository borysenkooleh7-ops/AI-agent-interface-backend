import prisma from '../config/database';
import { triggerWebhooks } from './webhook.service';
import * as leadService from './lead.service';
import * as propertyService from './property.service';
import * as propertyVisitService from './propertyVisit.service';

export interface VoiceflowRequest {
  sessionId: string;
  agencyId: string;
  phone?: string;
  request?: {
    type: string;
    payload?: any;
  };
}

export interface VoiceflowResponse {
  sessionId: string;
  response: any[];
  leadId?: string;
  matchedProperties?: any[];
  appointmentCreated?: boolean;
}

export interface ExtractedEntities {
  propertyType?: string;
  transactionType?: string;
  budgetMin?: number;
  budgetMax?: number;
  zones?: string[];
  sqm?: number;
  bedrooms?: number;
  bathrooms?: number;
  appointmentDate?: Date;
  appointmentRequested?: boolean;
}

/**
 * Mapeo de tipos de propiedad en español a enum
 */
const propertyTypeMap: Record<string, string> = {
  'piso': 'APARTMENT',
  'apartamento': 'APARTMENT',
  'casa': 'HOUSE',
  'chalet': 'VILLA',
  'villa': 'VILLA',
  'ático': 'PENTHOUSE',
  'atico': 'PENTHOUSE',
  'dúplex': 'DUPLEX',
  'duplex': 'DUPLEX',
  'estudio': 'STUDIO',
  'loft': 'LOFT',
  'adosado': 'TOWNHOUSE',
  'casa rural': 'COUNTRY_HOUSE',
  'local': 'COMMERCIAL',
  'local comercial': 'COMMERCIAL',
  'oficina': 'OFFICE',
  'nave': 'WAREHOUSE',
  'nave industrial': 'WAREHOUSE',
  'terreno': 'LAND',
  'parcela': 'LAND',
  'garaje': 'PARKING',
  'parking': 'PARKING',
  'trastero': 'STORAGE'
};

/**
 * Mapeo de tipos de transacción en español
 */
const transactionTypeMap: Record<string, string> = {
  'comprar': 'SALE',
  'compra': 'SALE',
  'venta': 'SALE',
  'alquilar': 'RENT',
  'alquiler': 'RENT',
  'arrendar': 'RENT',
  'traspaso': 'TRANSFER'
};

/**
 * Iniciar o continuar sesión de voz
 */
export async function handleVoiceSession(data: VoiceflowRequest): Promise<VoiceflowResponse> {
  const { sessionId, agencyId, phone, request } = data;

  // Buscar sesión existente o crear nueva
  let session = await prisma.voiceSession.findUnique({
    where: { sessionId }
  });

  if (!session) {
    session = await prisma.voiceSession.create({
      data: {
        sessionId,
        agencyId,
        phone,
        status: 'ACTIVE',
        intents: [],
        extractedZones: []
      }
    });
    console.log(`🎙️ Nueva sesión de voz iniciada: ${sessionId}`);
  }

  const response: VoiceflowResponse = {
    sessionId,
    response: []
  };

  // Procesar según el tipo de request
  if (request?.type === 'intent') {
    const intent = request.payload?.intent;
    const entities = request.payload?.entities || {};

    // Agregar intent a la lista
    const intents = [...(session.intents || []), intent];

    // Extraer entidades
    const extracted = await extractEntities(entities, session);

    // Actualizar sesión
    session = await prisma.voiceSession.update({
      where: { id: session.id },
      data: {
        intents,
        entities: request.payload?.entities,
        ...extracted
      }
    });

    // Generar respuesta según el intent
    response.response = await generateResponse(intent, extracted, session, agencyId);

    // Si se solicitó cita, intentar crear lead y agendar
    if (extracted.appointmentRequested && phone) {
      const lead = await findOrCreateLead(agencyId, phone, session);
      response.leadId = lead.id;

      if (extracted.appointmentDate) {
        const appointment = await scheduleAppointment(agencyId, lead.id, session, extracted.appointmentDate);
        response.appointmentCreated = !!appointment;
      }
    }

    // Buscar propiedades que coincidan
    if (extracted.propertyType || extracted.transactionType || extracted.budgetMax) {
      const properties = await matchProperties(agencyId, extracted);
      response.matchedProperties = properties.slice(0, 3);
    }
  } else if (request?.type === 'text') {
    // Procesar texto libre
    const text = request.payload?.text || '';
    const extracted = await extractFromText(text);

    if (Object.keys(extracted).length > 0) {
      session = await prisma.voiceSession.update({
        where: { id: session.id },
        data: extracted
      });
    }

    response.response = await generateTextResponse(text, session, agencyId);
  } else if (request?.type === 'launch') {
    // Mensaje de bienvenida
    response.response = [{
      type: 'text',
      payload: {
        message: '¡Hola! Soy el asistente virtual de la inmobiliaria. ¿En qué puedo ayudarte hoy? Puedo informarte sobre propiedades en venta o alquiler, y ayudarte a programar una visita.'
      }
    }];
  } else if (request?.type === 'end') {
    // Finalizar sesión
    await prisma.voiceSession.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        endedAt: new Date()
      }
    });

    response.response = [{
      type: 'text',
      payload: {
        message: '¡Gracias por contactarnos! Si necesitas más información, no dudes en llamar de nuevo. ¡Hasta pronto!'
      }
    }];

    // Disparar webhook
    await triggerWebhooks(agencyId, 'VOICE_SESSION_COMPLETED', {
      sessionId,
      phone,
      intents: session.intents,
      propertyType: session.extractedPropertyType,
      transactionType: session.extractedTransactionType,
      budgetMin: session.extractedBudgetMin,
      budgetMax: session.extractedBudgetMax,
      zones: session.extractedZones,
      appointmentRequested: session.appointmentRequested
    });
  }

  return response;
}

/**
 * Extraer entidades de la solicitud
 */
async function extractEntities(entities: any, session: any): Promise<Partial<ExtractedEntities>> {
  const extracted: Partial<ExtractedEntities> = {};

  // Tipo de propiedad
  if (entities.property_type) {
    const type = entities.property_type.toLowerCase();
    extracted.propertyType = propertyTypeMap[type] || type.toUpperCase();
  }

  // Tipo de transacción
  if (entities.transaction_type) {
    const type = entities.transaction_type.toLowerCase();
    extracted.transactionType = transactionTypeMap[type] || 'SALE';
  }

  // Presupuesto
  if (entities.budget || entities.price) {
    const budget = parseFloat(entities.budget || entities.price);
    if (!isNaN(budget)) {
      extracted.budgetMax = budget;
      extracted.budgetMin = budget * 0.8; // 20% menos como mínimo
    }
  }

  if (entities.budget_min) {
    extracted.budgetMin = parseFloat(entities.budget_min);
  }

  if (entities.budget_max) {
    extracted.budgetMax = parseFloat(entities.budget_max);
  }

  // Zonas
  if (entities.zone || entities.location || entities.neighborhood) {
    const zone = entities.zone || entities.location || entities.neighborhood;
    extracted.zones = Array.isArray(zone) ? zone : [zone];
  }

  // Metros cuadrados
  if (entities.sqm || entities.meters || entities.size) {
    extracted.sqm = parseFloat(entities.sqm || entities.meters || entities.size);
  }

  // Habitaciones
  if (entities.bedrooms || entities.rooms) {
    extracted.bedrooms = parseInt(entities.bedrooms || entities.rooms);
  }

  // Baños
  if (entities.bathrooms) {
    extracted.bathrooms = parseInt(entities.bathrooms);
  }

  // Fecha de cita
  if (entities.appointment_date || entities.date) {
    const dateStr = entities.appointment_date || entities.date;
    extracted.appointmentDate = new Date(dateStr);
    extracted.appointmentRequested = true;
  }

  // Intent de agendar visita
  if (entities.schedule_visit || entities.appointment) {
    extracted.appointmentRequested = true;
  }

  return extracted;
}

/**
 * Extraer información de texto libre
 */
async function extractFromText(text: string): Promise<any> {
  const extracted: any = {};
  const lowerText = text.toLowerCase();

  // Detectar tipo de propiedad
  for (const [key, value] of Object.entries(propertyTypeMap)) {
    if (lowerText.includes(key)) {
      extracted.extractedPropertyType = value;
      break;
    }
  }

  // Detectar tipo de transacción
  for (const [key, value] of Object.entries(transactionTypeMap)) {
    if (lowerText.includes(key)) {
      extracted.extractedTransactionType = value;
      break;
    }
  }

  // Detectar presupuesto (patrones como "200000 euros", "200.000€", "200k")
  const priceMatch = text.match(/(\d+[.,]?\d*)\s*(mil|k|euros?|€)?/i);
  if (priceMatch) {
    let price = parseFloat(priceMatch[1].replace(',', '.'));
    if (priceMatch[2] && (priceMatch[2].toLowerCase() === 'mil' || priceMatch[2].toLowerCase() === 'k')) {
      price *= 1000;
    }
    if (price > 1000) { // Asumir que es un precio válido
      extracted.extractedBudgetMax = price;
    }
  }

  // Detectar habitaciones
  const bedroomMatch = text.match(/(\d+)\s*(habitacion|dormitorio|cuarto)/i);
  if (bedroomMatch) {
    extracted.extractedBedrooms = parseInt(bedroomMatch[1]);
  }

  // Detectar metros cuadrados
  const sqmMatch = text.match(/(\d+)\s*(m2|m²|metros)/i);
  if (sqmMatch) {
    extracted.extractedSqm = parseFloat(sqmMatch[1]);
  }

  // Detectar solicitud de cita
  if (lowerText.includes('visita') || lowerText.includes('cita') || lowerText.includes('ver') || lowerText.includes('agendar')) {
    extracted.appointmentRequested = true;
  }

  return extracted;
}

/**
 * Generar respuesta según intent
 */
async function generateResponse(intent: string, extracted: any, session: any, agencyId: string): Promise<any[]> {
  const responses: any[] = [];

  switch (intent) {
    case 'property_inquiry':
    case 'search_property':
      const properties = await matchProperties(agencyId, {
        propertyType: extracted.propertyType || session.extractedPropertyType,
        transactionType: extracted.transactionType || session.extractedTransactionType,
        budgetMax: extracted.budgetMax || session.extractedBudgetMax,
        zones: extracted.zones || session.extractedZones
      });

      if (properties.length > 0) {
        responses.push({
          type: 'text',
          payload: {
            message: `He encontrado ${properties.length} propiedades que podrían interesarte. Te menciono las mejores opciones:`
          }
        });

        properties.slice(0, 3).forEach((prop, index) => {
          responses.push({
            type: 'card',
            payload: {
              title: prop.title,
              description: `${prop.bedrooms || '-'} hab. | ${prop.sqmTotal || '-'} m² | ${prop.city || ''} ${prop.zone || ''}`,
              price: `${prop.price.toLocaleString('es-ES')} €`,
              image: prop.images?.[0],
              propertyId: prop.id
            }
          });
        });

        responses.push({
          type: 'text',
          payload: {
            message: '¿Te gustaría programar una visita a alguna de estas propiedades?'
          }
        });
      } else {
        responses.push({
          type: 'text',
          payload: {
            message: 'En este momento no tengo propiedades que coincidan exactamente con lo que buscas, pero puedo tomar nota de tus preferencias para avisarte cuando tengamos algo. ¿Podrías darme más detalles sobre lo que necesitas?'
          }
        });
      }
      break;

    case 'schedule_visit':
    case 'book_appointment':
      responses.push({
        type: 'text',
        payload: {
          message: 'Perfecto, vamos a programar una visita. ¿Qué día y hora te vendría bien? Tenemos disponibilidad de lunes a viernes de 9:00 a 20:00 y sábados de 10:00 a 14:00.'
        }
      });
      break;

    case 'price_inquiry':
      responses.push({
        type: 'text',
        payload: {
          message: '¿Cuál es tu presupuesto aproximado? Esto me ayudará a mostrarte las opciones más adecuadas para ti.'
        }
      });
      break;

    case 'location_inquiry':
      responses.push({
        type: 'text',
        payload: {
          message: '¿En qué zona o barrio te gustaría buscar? Trabajamos en varias zonas de la ciudad.'
        }
      });
      break;

    case 'features_inquiry':
      responses.push({
        type: 'text',
        payload: {
          message: '¿Qué características son importantes para ti? Por ejemplo: número de habitaciones, ascensor, parking, terraza, piscina...'
        }
      });
      break;

    case 'agent_request':
    case 'human_agent':
      responses.push({
        type: 'text',
        payload: {
          message: 'Entendido, voy a transferirte con uno de nuestros agentes. Un momento por favor.'
        }
      });
      responses.push({
        type: 'action',
        payload: {
          action: 'transfer_to_agent'
        }
      });
      break;

    default:
      responses.push({
        type: 'text',
        payload: {
          message: 'Puedo ayudarte a buscar propiedades en venta o alquiler, darte información sobre precios, zonas disponibles, y programar visitas. ¿Qué te gustaría saber?'
        }
      });
  }

  return responses;
}

/**
 * Generar respuesta para texto libre
 */
async function generateTextResponse(text: string, session: any, agencyId: string): Promise<any[]> {
  const responses: any[] = [];
  const lowerText = text.toLowerCase();

  // Detectar intención del texto
  if (lowerText.includes('visita') || lowerText.includes('cita') || lowerText.includes('agendar') || lowerText.includes('ver')) {
    return generateResponse('schedule_visit', {}, session, agencyId);
  }

  if (lowerText.includes('precio') || lowerText.includes('cuanto') || lowerText.includes('cuesta') || lowerText.includes('presupuesto')) {
    return generateResponse('price_inquiry', {}, session, agencyId);
  }

  if (lowerText.includes('zona') || lowerText.includes('barrio') || lowerText.includes('ubicacion') || lowerText.includes('donde')) {
    return generateResponse('location_inquiry', {}, session, agencyId);
  }

  if (lowerText.includes('habitacion') || lowerText.includes('terraza') || lowerText.includes('parking') || lowerText.includes('piscina')) {
    return generateResponse('features_inquiry', {}, session, agencyId);
  }

  if (lowerText.includes('busco') || lowerText.includes('necesito') || lowerText.includes('quiero') || lowerText.includes('piso') || lowerText.includes('casa')) {
    const extracted = await extractFromText(text);
    return generateResponse('property_inquiry', extracted, session, agencyId);
  }

  if (lowerText.includes('agente') || lowerText.includes('persona') || lowerText.includes('humano')) {
    return generateResponse('agent_request', {}, session, agencyId);
  }

  // Respuesta por defecto
  responses.push({
    type: 'text',
    payload: {
      message: '¿Podrías darme más detalles? Puedo ayudarte a buscar pisos, casas u otros inmuebles en venta o alquiler, y programar visitas.'
    }
  });

  return responses;
}

/**
 * Buscar o crear lead
 */
async function findOrCreateLead(agencyId: string, phone: string, session: any) {
  // Buscar lead existente
  let lead = await prisma.lead.findFirst({
    where: {
      agencyId,
      phone,
      isDeleted: false
    }
  });

  if (!lead) {
    // Crear nuevo lead con información de la sesión
    lead = await prisma.lead.create({
      data: {
        agencyId,
        phone,
        name: `Lead Voz - ${phone}`,
        source: 'VOICEFLOW',
        status: 'NEW',
        transactionInterest: session.extractedTransactionType as any,
        propertyTypeInterest: session.extractedPropertyType ? [session.extractedPropertyType] : [],
        budgetMin: session.extractedBudgetMin,
        budgetMax: session.extractedBudgetMax,
        preferredZones: session.extractedZones || [],
        sqmMin: session.extractedSqm,
        bedroomsMin: session.extractedBedrooms
      }
    });

    console.log(`✅ Lead creado desde Voiceflow: ${lead.id}`);

    // Disparar webhook
    await triggerWebhooks(agencyId, 'LEAD_CREATED', {
      leadId: lead.id,
      phone,
      source: 'VOICEFLOW',
      sessionId: session.sessionId
    });
  }

  return lead;
}

/**
 * Buscar propiedades que coincidan
 */
async function matchProperties(agencyId: string, criteria: any) {
  const where: any = {
    agencyId,
    isDeleted: false,
    status: 'AVAILABLE'
  };

  if (criteria.propertyType) {
    where.propertyType = criteria.propertyType;
  }

  if (criteria.transactionType) {
    where.transactionType = criteria.transactionType;
  }

  if (criteria.budgetMax) {
    where.price = { lte: criteria.budgetMax };
  }

  if (criteria.budgetMin) {
    where.price = { ...where.price, gte: criteria.budgetMin };
  }

  if (criteria.zones && criteria.zones.length > 0) {
    where.OR = criteria.zones.map((zone: string) => ({
      zone: { contains: zone, mode: 'insensitive' }
    }));
  }

  if (criteria.bedrooms) {
    where.bedrooms = { gte: criteria.bedrooms };
  }

  if (criteria.sqm) {
    where.sqmTotal = { gte: criteria.sqm };
  }

  return prisma.property.findMany({
    where,
    select: {
      id: true,
      title: true,
      price: true,
      city: true,
      zone: true,
      bedrooms: true,
      bathrooms: true,
      sqmTotal: true,
      images: true,
      propertyType: true,
      transactionType: true
    },
    orderBy: [
      { featured: 'desc' },
      { createdAt: 'desc' }
    ],
    take: 10
  });
}

/**
 * Programar cita desde sesión de voz
 */
async function scheduleAppointment(agencyId: string, leadId: string, session: any, date: Date) {
  // Buscar la mejor propiedad que coincida
  const properties = await matchProperties(agencyId, {
    propertyType: session.extractedPropertyType,
    transactionType: session.extractedTransactionType,
    budgetMax: session.extractedBudgetMax,
    zones: session.extractedZones
  });

  if (properties.length === 0) {
    return null;
  }

  const property = properties[0];

  try {
    const visit = await propertyVisitService.createVisit({
      agencyId,
      propertyId: property.id,
      leadId,
      scheduledAt: date,
      duration: 30,
      notes: `Visita agendada por asistente de voz. Sesión: ${session.sessionId}`
    }, 'voiceflow');

    // Actualizar sesión
    await prisma.voiceSession.update({
      where: { id: session.id },
      data: {
        appointmentRequested: true,
        appointmentDate: date
      }
    });

    return visit;
  } catch (error) {
    console.error('Error al agendar visita desde Voiceflow:', error);
    return null;
  }
}

/**
 * Obtener sesión por ID
 */
export async function getSession(sessionId: string) {
  return prisma.voiceSession.findUnique({
    where: { sessionId },
    include: {
      agency: {
        select: { id: true, name: true }
      }
    }
  });
}

/**
 * Obtener sesiones de una agencia
 */
export async function getAgencySessions(agencyId: string, limit: number = 50) {
  return prisma.voiceSession.findMany({
    where: { agencyId },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}

/**
 * Obtener estadísticas de sesiones de voz
 */
export async function getVoiceStatistics(agencyId: string, startDate?: Date, endDate?: Date) {
  const where: any = { agencyId };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [
    total,
    completed,
    abandoned,
    withAppointment,
    byIntent
  ] = await Promise.all([
    prisma.voiceSession.count({ where }),
    prisma.voiceSession.count({ where: { ...where, status: 'COMPLETED' } }),
    prisma.voiceSession.count({ where: { ...where, status: 'ABANDONED' } }),
    prisma.voiceSession.count({ where: { ...where, appointmentRequested: true } }),
    prisma.voiceSession.findMany({
      where,
      select: { intents: true }
    })
  ]);

  // Contar intents
  const intentCounts: Record<string, number> = {};
  byIntent.forEach(session => {
    (session.intents || []).forEach(intent => {
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    });
  });

  return {
    total,
    completed,
    abandoned,
    withAppointment,
    completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : '0',
    appointmentRate: total > 0 ? ((withAppointment / total) * 100).toFixed(1) : '0',
    topIntents: Object.entries(intentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([intent, count]) => ({ intent, count }))
  };
}
