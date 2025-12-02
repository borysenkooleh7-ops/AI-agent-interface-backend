import { Request, Response } from 'express';
import * as propertyService from '../services/property.service';
import * as agencyAccess from '../utils/gymAccess';

/**
 * Obtener todas las propiedades
 */
export const getAllProperties = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    // Obtener IDs de agencias accesibles
    const accessibleAgencyIds = await agencyAccess.getUserAccessibleGymIds(userId, userRole);

    const filters = {
      agencyId: req.query.agencyId as string || (accessibleAgencyIds.length === 1 ? accessibleAgencyIds[0] : undefined),
      search: req.query.search as string,
      propertyType: req.query.propertyType as string,
      transactionType: req.query.transactionType as string,
      status: req.query.status as string,
      city: req.query.city as string,
      zone: req.query.zone as string,
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
      minSqm: req.query.minSqm ? parseFloat(req.query.minSqm as string) : undefined,
      maxSqm: req.query.maxSqm ? parseFloat(req.query.maxSqm as string) : undefined,
      minBedrooms: req.query.minBedrooms ? parseInt(req.query.minBedrooms as string) : undefined,
      minBathrooms: req.query.minBathrooms ? parseInt(req.query.minBathrooms as string) : undefined,
      hasParking: req.query.hasParking === 'true' ? true : req.query.hasParking === 'false' ? false : undefined,
      hasPool: req.query.hasPool === 'true' ? true : req.query.hasPool === 'false' ? false : undefined,
      hasTerrace: req.query.hasTerrace === 'true' ? true : req.query.hasTerrace === 'false' ? false : undefined,
      hasGarden: req.query.hasGarden === 'true' ? true : req.query.hasGarden === 'false' ? false : undefined,
      featured: req.query.featured === 'true' ? true : undefined,
      showDeleted: req.query.showDeleted === 'true',
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
      sortBy: req.query.sortBy as string || 'createdAt',
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
    };

    // Si no es admin, filtrar solo por agencias accesibles
    if (userRole !== 'ADMIN' && !filters.agencyId) {
      if (accessibleAgencyIds.length === 0) {
        res.status(200).json({ success: true, data: { properties: [], total: 0, hasMore: false } });
        return;
      }
    }

    const result = await propertyService.getAllProperties(filters);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Obtener propiedad por ID
 */
export const getPropertyById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const propertyId = req.params.id;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    const property = await propertyService.getPropertyById(propertyId);

    // Verificar acceso a la agencia
    const hasAccess = await agencyAccess.hasGymAccess(userId, userRole, property.agencyId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Acceso denegado a esta propiedad' });
      return;
    }

    res.status(200).json({ success: true, data: property });
  } catch (error: any) {
    const statusCode = error.message === 'Propiedad no encontrada' ? 404 : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

/**
 * Crear propiedad
 */
export const createProperty = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const { agencyId } = req.body;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    // Verificar acceso a la agencia
    const hasAccess = await agencyAccess.hasGymAccess(userId, userRole, agencyId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Acceso denegado a esta agencia' });
      return;
    }

    const property = await propertyService.createProperty(req.body, userId);
    res.status(201).json({ success: true, message: 'Propiedad creada correctamente', data: property });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Actualizar propiedad
 */
export const updateProperty = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const propertyId = req.params.id;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    // Obtener propiedad para verificar acceso
    const existing = await propertyService.getPropertyById(propertyId);
    const hasAccess = await agencyAccess.hasGymAccess(userId, userRole, existing.agencyId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Acceso denegado a esta propiedad' });
      return;
    }

    const property = await propertyService.updateProperty(propertyId, req.body, userId);
    res.status(200).json({ success: true, message: 'Propiedad actualizada correctamente', data: property });
  } catch (error: any) {
    const statusCode = error.message === 'Propiedad no encontrada' ? 404 : 400;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

/**
 * Eliminar propiedad
 */
export const deleteProperty = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const propertyId = req.params.id;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    // Verificar acceso
    const existing = await propertyService.getPropertyById(propertyId);
    const hasAccess = await agencyAccess.hasGymAccess(userId, userRole, existing.agencyId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Acceso denegado a esta propiedad' });
      return;
    }

    await propertyService.deleteProperty(propertyId, userId);
    res.status(200).json({ success: true, message: 'Propiedad eliminada correctamente' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Publicar propiedad
 */
export const publishProperty = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const propertyId = req.params.id;

    if (!userId) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    const property = await propertyService.publishProperty(propertyId, userId);
    res.status(200).json({ success: true, message: 'Propiedad publicada correctamente', data: property });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Actualizar estado de propiedad
 */
export const updatePropertyStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const propertyId = req.params.id;
    const { status } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    const property = await propertyService.updatePropertyStatus(propertyId, status, userId);
    res.status(200).json({ success: true, message: 'Estado actualizado correctamente', data: property });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Obtener propiedades similares
 */
export const getSimilarProperties = async (req: Request, res: Response): Promise<void> => {
  try {
    const propertyId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 4;

    const properties = await propertyService.getSimilarProperties(propertyId, limit);
    res.status(200).json({ success: true, data: properties });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Obtener propiedades que coincidan con un lead
 */
export const matchPropertiesForLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const leadId = req.params.leadId;
    const limit = parseInt(req.query.limit as string) || 10;

    const properties = await propertyService.matchPropertiesForLead(leadId, limit);
    res.status(200).json({ success: true, data: properties });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Obtener estadísticas de propiedades
 */
export const getPropertyStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const agencyId = req.params.agencyId || req.query.agencyId as string;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'No autorizado' });
      return;
    }

    if (!agencyId) {
      res.status(400).json({ success: false, message: 'Se requiere agencyId' });
      return;
    }

    // Verificar acceso
    const hasAccess = await agencyAccess.hasGymAccess(userId, userRole, agencyId);
    if (!hasAccess) {
      res.status(403).json({ success: false, message: 'Acceso denegado' });
      return;
    }

    const statistics = await propertyService.getPropertyStatistics(agencyId);
    res.status(200).json({ success: true, data: statistics });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Agregar imagen a propiedad
 */
export const addPropertyImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const propertyId = req.params.id;
    const { imageUrl } = req.body;

    if (!imageUrl) {
      res.status(400).json({ success: false, message: 'Se requiere imageUrl' });
      return;
    }

    const property = await propertyService.addPropertyImage(propertyId, imageUrl);
    res.status(200).json({ success: true, message: 'Imagen agregada', data: property });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Eliminar imagen de propiedad
 */
export const removePropertyImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const propertyId = req.params.id;
    const { imageUrl } = req.body;

    if (!imageUrl) {
      res.status(400).json({ success: false, message: 'Se requiere imageUrl' });
      return;
    }

    const property = await propertyService.removePropertyImage(propertyId, imageUrl);
    res.status(200).json({ success: true, message: 'Imagen eliminada', data: property });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Reordenar imágenes de propiedad
 */
export const reorderPropertyImages = async (req: Request, res: Response): Promise<void> => {
  try {
    const propertyId = req.params.id;
    const { images } = req.body;

    if (!images || !Array.isArray(images)) {
      res.status(400).json({ success: false, message: 'Se requiere array de images' });
      return;
    }

    const property = await propertyService.reorderPropertyImages(propertyId, images);
    res.status(200).json({ success: true, message: 'Imágenes reordenadas', data: property });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
