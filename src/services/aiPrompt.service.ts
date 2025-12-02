import prisma from '../config/database';

export interface CreateAIPromptData {
  agencyId: string;
  systemPrompt: string;
  greetingMessage?: string;
  qualificationFlow?: any;
  objectionHandling?: any;
  faqs?: any;
  escalationRules?: any;
  propertyInquiryPrompt?: string;
  visitSchedulingPrompt?: string;
  priceNegotiationPrompt?: string;
}

export interface UpdateAIPromptData {
  systemPrompt?: string;
  greetingMessage?: string;
  qualificationFlow?: any;
  objectionHandling?: any;
  faqs?: any;
  escalationRules?: any;
  propertyInquiryPrompt?: string;
  visitSchedulingPrompt?: string;
  priceNegotiationPrompt?: string;
}

/**
 * Get AI prompt for an agency
 */
export async function getAIPrompt(agencyId: string) {
  const prompt = await prisma.aIPrompt.findUnique({
    where: { agencyId },
    include: {
      agency: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  });

  if (!prompt) {
    throw new Error('AI Prompt no encontrado para esta agencia');
  }

  return prompt;
}

/**
 * Create AI prompt for an agency
 */
export async function createAIPrompt(data: CreateAIPromptData, createdBy: string) {
  // Check if agency exists
  const agency = await prisma.agency.findUnique({
    where: { id: data.agencyId }
  });

  if (!agency) {
    throw new Error('Agencia no encontrada');
  }

  // Check if AI prompt already exists for this agency
  const existing = await prisma.aIPrompt.findUnique({
    where: { agencyId: data.agencyId }
  });

  if (existing) {
    throw new Error('Ya existe un AI Prompt para esta agencia');
  }

  const prompt = await prisma.aIPrompt.create({
    data: {
      agencyId: data.agencyId,
      systemPrompt: data.systemPrompt,
      greetingMessage: data.greetingMessage,
      qualificationFlow: data.qualificationFlow || {},
      objectionHandling: data.objectionHandling || {},
      faqs: data.faqs || {},
      escalationRules: data.escalationRules || {},
      propertyInquiryPrompt: data.propertyInquiryPrompt,
      visitSchedulingPrompt: data.visitSchedulingPrompt,
      priceNegotiationPrompt: data.priceNegotiationPrompt
    }
  });

  console.log(`✅ AI Prompt creado para agencia ${agency.name} por ${createdBy}`);
  return prompt;
}

/**
 * Update AI prompt
 */
export async function updateAIPrompt(agencyId: string, data: UpdateAIPromptData, updatedBy: string) {
  const existing = await prisma.aIPrompt.findUnique({
    where: { agencyId }
  });

  if (!existing) {
    throw new Error('AI Prompt no encontrado');
  }

  const prompt = await prisma.aIPrompt.update({
    where: { agencyId },
    data
  });

  console.log(`✅ AI Prompt actualizado para agencia ${agencyId} por ${updatedBy}`);
  return prompt;
}

/**
 * Delete AI prompt
 */
export async function deleteAIPrompt(agencyId: string, deletedBy: string) {
  const prompt = await prisma.aIPrompt.delete({
    where: { agencyId }
  });

  console.log(`🗑️ AI Prompt eliminado para agencia ${agencyId} por ${deletedBy}`);
  return prompt;
}

/**
 * Get default AI prompt template for real estate
 */
export function getDefaultPromptTemplate() {
  return {
    systemPrompt: `Eres un asistente virtual de ventas inmobiliarias para {agency_name}, ubicada en {agency_address}.

Tu Objetivo:
- Proporcionar un servicio al cliente amable y profesional
- Cualificar leads recopilando información sobre sus necesidades inmobiliarias
- Responder preguntas sobre propiedades, precios y ubicaciones
- Manejar objeciones de manera profesional
- Guiar a los clientes hacia la programación de visitas

Tu Tono:
- Profesional pero cercano
- Experto en el sector inmobiliario
- Paciente y servicial
- Usa emojis con moderación (🏠🔑✨)

Información de la Agencia:
- Nombre: {agency_name}
- Ubicación: {agency_address}
- Teléfono: {agency_phone}
- Email: {agency_email}

Horario de Atención:
- Lunes a Viernes: 9:00 - 20:00
- Sábados: 10:00 - 14:00

Información a Recopilar del Cliente:
- Nombre completo
- Teléfono de contacto
- Tipo de operación (compra, alquiler, venta)
- Tipo de inmueble de interés
- Presupuesto aproximado
- Zonas preferidas
- Número de habitaciones deseadas
- Características especiales (parking, terraza, piscina, etc.)
- Urgencia (inmediato, 1-3 meses, sin prisa)

Cuándo Derivar a un Agente Humano:
- Negociaciones de precio complejas
- Consultas legales o fiscales
- Reclamaciones o quejas
- El cliente insiste en hablar con una persona
- Visitas inmediatas o urgentes

Reglas de Respuesta:
- Siempre ofrece opciones de propiedades cuando el cliente da su presupuesto y preferencias
- Menciona siempre la posibilidad de agendar una visita
- Si no tienes propiedades que coincidan, toma nota de sus datos para avisarle cuando haya algo
- Nunca inventes propiedades que no existen`,

    greetingMessage: "🏠 ¡Hola! Bienvenido/a a {agency_name}.\n\n¿En qué puedo ayudarte hoy?\n\n• 🔍 Buscar propiedades en venta o alquiler\n• 📅 Agendar una visita\n• 💰 Consultar precios\n• 📋 Vender o alquilar tu propiedad\n\n¡Cuéntame qué necesitas! 😊",

    propertyInquiryPrompt: `Cuando el cliente pregunte por propiedades:

1. Primero, identifica el tipo de operación (compra/alquiler)
2. Pregunta por el tipo de inmueble preferido
3. Consulta el presupuesto aproximado
4. Pregunta por las zonas de interés
5. Confirma el número de habitaciones y baños deseados
6. Pregunta por características especiales importantes

Una vez tengas esta información, busca propiedades que coincidan y preséntales las mejores opciones.
Siempre ofrece programar una visita después de presentar opciones.`,

    visitSchedulingPrompt: `Para agendar visitas:

1. Confirma la propiedad o propiedades de interés
2. Pregunta por fecha y hora preferida
3. Solicita nombre y teléfono de contacto
4. Confirma los datos de la visita
5. Indica que un agente confirmará la cita

Horarios disponibles para visitas:
- Lunes a Viernes: 9:00 - 20:00
- Sábados: 10:00 - 14:00

Recuerda confirmar la dirección exacta de la propiedad y pedir puntualidad.`,

    priceNegotiationPrompt: `Para consultas de precio:

1. Proporciona el precio actual de la propiedad
2. Menciona si hay margen de negociación (si lo sabes)
3. Ofrece calcular la cuota hipotecaria aproximada (si es venta)
4. Menciona los gastos adicionales típicos (ITP, notaría, etc.)
5. Siempre sugiere una visita para valorar mejor la propiedad

Si el cliente quiere negociar el precio, indica que un agente especializado se pondrá en contacto para estudiar su propuesta.`,

    qualificationFlow: {
      steps: [
        {
          field: "name",
          question: "Para empezar, ¿cuál es tu nombre?",
          required: true
        },
        {
          field: "transactionType",
          question: "¿Buscas comprar o alquilar?",
          required: true,
          options: ["Comprar", "Alquilar", "Vender"]
        },
        {
          field: "propertyType",
          question: "¿Qué tipo de inmueble te interesa? (piso, casa, chalet, local...)",
          required: true
        },
        {
          field: "budget",
          question: "¿Cuál es tu presupuesto aproximado?",
          required: true
        },
        {
          field: "zones",
          question: "¿En qué zonas o barrios te gustaría buscar?",
          required: true
        },
        {
          field: "bedrooms",
          question: "¿Cuántas habitaciones necesitas como mínimo?",
          required: false
        },
        {
          field: "features",
          question: "¿Hay alguna característica especial que sea importante para ti? (parking, terraza, ascensor, etc.)",
          required: false
        },
        {
          field: "timeline",
          question: "¿Para cuándo necesitas el inmueble?",
          required: false,
          options: ["Inmediato", "1-3 meses", "3-6 meses", "Sin prisa"]
        },
        {
          field: "phone",
          question: "¿Me facilitas un teléfono de contacto para enviarte las mejores opciones?",
          required: true,
          validation: "phone"
        }
      ]
    },

    objectionHandling: {
      objections: [
        {
          trigger: "lo tengo que pensar|necesito pensarlo|déjame pensarlo",
          response: "Entiendo perfectamente. Es una decisión importante. ¿Te parece si mientras tanto te envío más información sobre las propiedades que hemos visto? También puedo programarte una visita sin compromiso para que puedas verlas en persona y decidir mejor. ¿Qué te parece?"
        },
        {
          trigger: "es muy caro|está muy caro|fuera de presupuesto|no me lo puedo permitir",
          response: "Entiendo tu preocupación por el precio. Tenemos propiedades en diferentes rangos de precios. ¿Te gustaría que busquemos opciones más ajustadas a tu presupuesto? También podría informarte sobre opciones de financiación. ¿Cuál sería un precio máximo cómodo para ti?"
        },
        {
          trigger: "no tengo tiempo|estoy muy ocupado|ahora no puedo",
          response: "Comprendo que estés ocupado/a. Podemos adaptarnos a tu horario. Tenemos disponibilidad de lunes a sábado, incluyendo visitas a primera hora o a última hora de la tarde. ¿Qué día y hora te vendría mejor?"
        },
        {
          trigger: "ya estoy mirando con otra inmobiliaria|tengo otro agente",
          response: "Me parece genial que compares opciones. Nosotros podríamos ofrecerte propiedades exclusivas que quizás no has visto. ¿Te gustaría que te envíe nuestra cartera de inmuebles? Así puedes comparar sin compromiso."
        },
        {
          trigger: "los precios van a bajar|espero que bajen|mejor espero",
          response: "Es cierto que el mercado es dinámico. Sin embargo, las buenas oportunidades suelen irse rápido. ¿Te gustaría que te avise cuando aparezca algo especialmente interesante en tu zona? Así podrás decidir en el momento sin perder la oportunidad."
        }
      ]
    },

    faqs: {
      questions: [
        {
          question: "¿Cuáles son vuestros honorarios?",
          keywords: ["honorarios|comisión|cuánto cobráis|precio servicios"],
          answer: "Nuestros honorarios dependen del tipo de operación. En ventas, normalmente es un porcentaje del precio de venta (entre 3-5%). En alquileres, suele ser una mensualidad. Te explicamos todos los detalles sin compromiso. ¿Te gustaría que un agente te llame para concretarlo?"
        },
        {
          question: "¿Qué documentos necesito para alquilar?",
          keywords: ["documentos alquiler|papeles|requisitos inquilino"],
          answer: "Para alquilar normalmente necesitas: DNI/NIE, nóminas de los últimos 3 meses, contrato de trabajo y posiblemente aval bancario o depósito. Dependiendo del propietario pueden variar. ¿Ya tienes estos documentos preparados?"
        },
        {
          question: "¿Qué gastos tiene comprar una casa?",
          keywords: ["gastos compra|impuestos|ITP|notaría|gestoría"],
          answer: "Al comprar hay que considerar: ITP (6-10% según comunidad) o IVA (10% obra nueva), notaría (0,5-1%), registro (0,5%), gestoría (300-500€). En total, calcula un 10-12% adicional al precio de compra. ¿Quieres que te hagamos un cálculo detallado?"
        },
        {
          question: "¿Ofrecéis hipotecas?",
          keywords: ["hipoteca|financiación|préstamo|crédito"],
          answer: "Colaboramos con los principales bancos y brokers hipotecarios. Podemos ayudarte a conseguir las mejores condiciones. ¿Te gustaría que un asesor financiero te llame para hacer un estudio sin compromiso?"
        },
        {
          question: "¿Puedo visitar el inmueble?",
          keywords: ["visitar|ver piso|ver casa|cita|enseñar"],
          answer: "¡Por supuesto! Organizamos visitas de lunes a sábado. ¿Qué día y hora te vendría mejor? Recuerda traer tu DNI para el registro de la visita."
        },
        {
          question: "¿Aceptan mascotas?",
          keywords: ["mascotas|perro|gato|animales"],
          answer: "Depende de cada propietario. Tenemos propiedades donde sí se aceptan mascotas. ¿Tienes mascota? Dime qué tipo y tamaño y buscaré opciones adecuadas para ti."
        }
      ]
    },

    escalationRules: {
      keywords: {
        legal: ["demanda", "denuncia", "abogado", "legal", "juicio", "problema legal"],
        pricing: ["negociar precio", "rebaja", "descuento", "última oferta", "contraoferta"],
        complaint: ["queja", "reclamación", "estafa", "engaño", "problema grave"],
        human: ["hablar con persona", "agente humano", "persona real", "no quiero robot", "hablar con alguien"]
      },
      actions: {
        legal: "transfer_to_manager",
        pricing: "transfer_to_agent",
        complaint: "transfer_to_manager",
        human: "transfer_to_agent"
      }
    }
  };
}

/**
 * Get real estate specific prompt additions
 */
export function getRealEstatePromptAdditions() {
  return {
    propertyTypes: {
      APARTMENT: "Piso",
      HOUSE: "Casa",
      VILLA: "Chalet",
      PENTHOUSE: "Ático",
      DUPLEX: "Dúplex",
      STUDIO: "Estudio",
      LOFT: "Loft",
      TOWNHOUSE: "Adosado",
      COUNTRY_HOUSE: "Casa rural",
      COMMERCIAL: "Local comercial",
      OFFICE: "Oficina",
      WAREHOUSE: "Nave industrial",
      LAND: "Terreno",
      PARKING: "Garaje",
      STORAGE: "Trastero"
    },
    transactionTypes: {
      SALE: "Venta",
      RENT: "Alquiler",
      RENT_TO_OWN: "Alquiler con opción a compra",
      TRANSFER: "Traspaso"
    },
    commonFeatures: [
      "Ascensor",
      "Parking",
      "Terraza",
      "Balcón",
      "Piscina",
      "Jardín",
      "Trastero",
      "Aire acondicionado",
      "Calefacción",
      "Amueblado",
      "Portero",
      "Patio",
      "Vistas al mar",
      "Reformado"
    ],
    responseTemplates: {
      propertyFound: "🏠 ¡Perfecto! He encontrado {count} propiedades que podrían interesarte:\n\n{properties}\n\n¿Te gustaría agendar una visita a alguna de ellas?",
      noPropertyFound: "Actualmente no tenemos propiedades que coincidan exactamente con lo que buscas, pero he tomado nota de tus preferencias. Te avisaré en cuanto tengamos algo. Mientras tanto, ¿te gustaría ampliar un poco el rango de búsqueda?",
      visitScheduled: "✅ ¡Visita programada!\n\n📍 Propiedad: {property}\n📅 Fecha: {date}\n⏰ Hora: {time}\n\nUn agente confirmará la cita. Por favor, llega puntual y trae tu DNI.",
      followUp: "👋 ¡Hola! Te escribo para saber si tienes alguna pregunta más sobre las propiedades que viste. ¿Te gustaría programar otra visita?"
    }
  };
}
