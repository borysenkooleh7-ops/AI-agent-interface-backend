import { Router } from 'express';
import * as propertyController from '../controllers/property.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { z } from 'zod';

const router = Router();

// Esquemas de validación
const createPropertySchema = z.object({
  agencyId: z.string().min(1, 'Se requiere agencyId'),
  agentId: z.string().optional(),
  title: z.string().min(2, 'El título debe tener al menos 2 caracteres'),
  description: z.string().optional(),
  reference: z.string().optional(),
  propertyType: z.enum([
    'APARTMENT', 'HOUSE', 'VILLA', 'PENTHOUSE', 'DUPLEX', 'STUDIO', 'LOFT',
    'TOWNHOUSE', 'COUNTRY_HOUSE', 'COMMERCIAL', 'OFFICE', 'WAREHOUSE',
    'LAND', 'PARKING', 'STORAGE', 'BUILDING', 'OTHER'
  ]),
  transactionType: z.enum(['SALE', 'RENT', 'RENT_TO_OWN', 'TRANSFER']),
  address: z.string().optional(),
  city: z.string().optional(),
  zone: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  price: z.number().min(0, 'El precio debe ser mayor o igual a 0'),
  pricePerSqm: z.number().optional(),
  sqmTotal: z.number().optional(),
  sqmBuilt: z.number().optional(),
  sqmUsable: z.number().optional(),
  bedrooms: z.number().int().optional(),
  bathrooms: z.number().int().optional(),
  floors: z.number().int().optional(),
  floor: z.number().int().optional(),
  hasElevator: z.boolean().optional(),
  hasParking: z.boolean().optional(),
  parkingSpaces: z.number().int().optional(),
  hasPool: z.boolean().optional(),
  hasTerrace: z.boolean().optional(),
  hasGarden: z.boolean().optional(),
  hasAC: z.boolean().optional(),
  hasHeating: z.boolean().optional(),
  yearBuilt: z.number().int().optional(),
  energyRating: z.string().optional(),
  features: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
  videoUrl: z.string().url().optional().or(z.literal('')),
  virtualTourUrl: z.string().url().optional().or(z.literal('')),
  status: z.enum(['AVAILABLE', 'RESERVED', 'SOLD', 'RENTED', 'UNAVAILABLE', 'DRAFT']).optional(),
  featured: z.boolean().optional()
});

const updatePropertySchema = createPropertySchema.partial().omit({ agencyId: true });

const updateStatusSchema = z.object({
  status: z.enum(['AVAILABLE', 'RESERVED', 'SOLD', 'RENTED', 'UNAVAILABLE', 'DRAFT'])
});

const imageSchema = z.object({
  imageUrl: z.string().min(1, 'Se requiere imageUrl')
});

const reorderImagesSchema = z.object({
  images: z.array(z.string())
});

// Aplicar autenticación a todas las rutas
router.use(authenticate);

// Rutas de propiedades
router.get('/', authorize(['ADMIN', 'MANAGER', 'AGENT']), propertyController.getAllProperties);
router.get('/statistics/:agencyId', authorize(['ADMIN', 'MANAGER']), propertyController.getPropertyStatistics);
router.get('/match/lead/:leadId', authorize(['ADMIN', 'MANAGER', 'AGENT']), propertyController.matchPropertiesForLead);
router.get('/:id', authorize(['ADMIN', 'MANAGER', 'AGENT']), propertyController.getPropertyById);
router.get('/:id/similar', authorize(['ADMIN', 'MANAGER', 'AGENT']), propertyController.getSimilarProperties);

router.post('/', authorize(['ADMIN', 'MANAGER', 'AGENT']), validate(createPropertySchema), propertyController.createProperty);

router.put('/:id', authorize(['ADMIN', 'MANAGER', 'AGENT']), validate(updatePropertySchema), propertyController.updateProperty);
router.patch('/:id/status', authorize(['ADMIN', 'MANAGER']), validate(updateStatusSchema), propertyController.updatePropertyStatus);
router.patch('/:id/publish', authorize(['ADMIN', 'MANAGER']), propertyController.publishProperty);

// Gestión de imágenes
router.post('/:id/images', authorize(['ADMIN', 'MANAGER', 'AGENT']), validate(imageSchema), propertyController.addPropertyImage);
router.delete('/:id/images', authorize(['ADMIN', 'MANAGER', 'AGENT']), validate(imageSchema), propertyController.removePropertyImage);
router.put('/:id/images/reorder', authorize(['ADMIN', 'MANAGER', 'AGENT']), validate(reorderImagesSchema), propertyController.reorderPropertyImages);

router.delete('/:id', authorize(['ADMIN', 'MANAGER']), propertyController.deleteProperty);

export default router;
