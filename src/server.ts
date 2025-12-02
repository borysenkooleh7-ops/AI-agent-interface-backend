import express, { Application, Request, Response, NextFunction } from 'express';
import http from 'http';
import dotenv from 'dotenv';
import cors, { CorsOptions } from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import authRoutes from './routes/auth.routes';
import registrationRoutes from './routes/registration.routes';
import passwordResetRoutes from './routes/passwordReset.routes';
import userRoutes from './routes/user.routes';
import userManagementRoutes from './routes/userManagement.routes';
import gymRoutes from './routes/gym.routes';
import aiPromptRoutes from './routes/aiPrompt.routes';
import leadRoutes from './routes/lead.routes';
import followUpRoutes from './routes/followUp.routes';
import notificationRoutes from './routes/notification.routes';
import dashboardRoutes from './routes/dashboard.routes';
import analyticsRoutes from './routes/analytics.routes';
import reportsRoutes from './routes/reports.routes';
import conversationRoutes from './routes/conversation.routes';
import integrationRoutes from './routes/integration.routes';
import activityLogRoutes from './routes/activityLog.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import whatsappConfigRoutes from './routes/whatsappConfig.routes';
import webhooksRoutes from './routes/webhooks.routes';
import planRoutes from './routes/plan.routes';
import memberRoutes from './routes/member.routes';
import propertyRoutes from './routes/property.routes';
import propertyVisitRoutes from './routes/propertyVisit.routes';
import voiceflowRoutes from './routes/voiceflow.routes';
import { setupSocket } from './config/socket';
import { setSocketInstance } from './utils/socketManager';

// Load environment variables
dotenv.config();

console.log('🚀 Server starting...');

// Create Express app
const app: Application = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://duxfit-production.up.railway.app', // Railway frontend URL
  'http://localhost:8082', // Vite dev server alternative port
  'http://localhost:3000', // Common React dev port
  'http://localhost:8080', // Common dev port
  'http://localhost:5000'  // Backend dev server
];

// Add Netlify and Vercel domains dynamically
if (process.env.NODE_ENV === 'production') {
  allowedOrigins.push(
    'https://*.netlify.app',
    'https://*.vercel.app'
  );
}

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    console.log('CORS request from origin:', origin);

    if (!origin) {
      console.log('CORS: Allowing request with no origin');
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      console.log('CORS: Origin allowed from allowedOrigins list');
      return callback(null, true);
    }

    if (origin.match(/^https:\/\/.*\.netlify\.app$/)) {
      console.log('CORS: Origin allowed - Netlify domain');
      return callback(null, true);
    }

    if (origin.match(/^https:\/\/.*\.vercel\.app$/)) {
      console.log('CORS: Origin allowed - Vercel domain');
      return callback(null, true);
    }

    if (origin.match(/^https:\/\/.*\.up\.railway\.app$/)) {
      console.log('CORS: Origin allowed - Railway domain');
      return callback(null, true);
    }

    console.log('CORS: Origin not allowed:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
const isDev = process.env.NODE_ENV === 'development';
const disableRateLimit = (process.env.DISABLE_RATE_LIMIT || '').toLowerCase() === 'true';

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// More lenient limiter for frequently called endpoints like auth/me in production
const softLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_SOFT_WINDOW_MS || '60000'), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_SOFT_MAX_REQUESTS || '300'),
  standardHeaders: true,
  legacyHeaders: false,
});

if (disableRateLimit || isDev) {
  console.log('Rate limiting disabled for this environment.');
} else {
  // Apply the default limiter to all API routes
  app.use('/api/', limiter);
  // Loosen rate limit on auth session checks to avoid noisy 429s
  app.use('/api/auth/me', softLimiter);
  app.use('/api/auth/login', softLimiter);
}

// Serve static files (uploads)
// app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/uploads', (req, res, next) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:8082',
    'http://localhost:3000',
    'http://localhost:8080',
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
  next();
}, express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    message: 'Real Estate AI CRM Backend is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '2.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/register', registrationRoutes);
app.use('/api/auth', passwordResetRoutes);
app.use('/api/users', userRoutes);
app.use('/api/user-management', userManagementRoutes);
app.use('/api/gyms', gymRoutes);
app.use('/api/ai-prompts', aiPromptRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/followups', followUpRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/whatsapp', whatsappConfigRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/visits', propertyVisitRoutes);
app.use('/api/voiceflow', voiceflowRoutes);

// Alias para compatibilidad: /api/agencies apunta a /api/gyms
app.use('/api/agencies', gymRoutes);

console.log('✅ Follow-up routes registered at /api/followups');
console.log('✅ Notification routes registered at /api/notifications');
console.log('✅ Dashboard routes registered at /api/dashboard');
console.log('✅ Analytics routes registered at /api/analytics');
console.log('✅ Reports routes registered at /api/reports');
console.log('✅ Conversation routes registered at /api/conversations');
console.log('✅ Integration routes registered at /api/integrations');
console.log('✅ Activity log routes registered at /api/activity-logs');
console.log('✅ WhatsApp routes registered at /api/whatsapp');
console.log('✅ Webhooks routes registered at /api/webhooks');
console.log('✅ Plan routes registered at /api/plans');
console.log('✅ Member routes registered at /api/members');
console.log('✅ Property routes registered at /api/properties');
console.log('✅ Visit routes registered at /api/visits');
console.log('✅ Voiceflow routes registered at /api/voiceflow');
console.log('✅ Agencies alias registered at /api/agencies');

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Create HTTP server
const httpServer = http.createServer(app);

// Setup Socket.IO
const io = setupSocket(httpServer);
setSocketInstance(io);

// Make io accessible in routes
app.set('io', io);

// Start server
// Bind to 0.0.0.0 to accept connections from all interfaces (required for Railway/Docker)
const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🏠 Real Estate AI CRM - Backend Server             ║
║                                                       ║
║   Status: Running ✓                                   ║
║   Host: ${HOST}                                         ║
║   Port: ${PORT}                                        ║
║   Environment: ${process.env.NODE_ENV || 'development'}              ║
║   API: http://${HOST}:${PORT}/api                    ║
║   Health: http://${HOST}:${PORT}/health              ║
║   Socket.IO: ✓ Ready                                  ║
║   Voiceflow: ✓ Ready                                  ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Handle server errors
httpServer.on('error', (error: NodeJS.ErrnoException) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

  switch (error.code) {
    case 'EACCES':
      console.error(`❌ ${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`❌ ${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

export default app;

