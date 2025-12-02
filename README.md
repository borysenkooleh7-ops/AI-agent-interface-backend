# 🏋️ DuxFit CRM Backend

Backend API for DuxFit Intelligent WhatsApp Sales and Service System.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment Variables
```bash
cp .env.example .env
# Edit .env with your actual values
```

### 3. Setup Database
```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Seed database
npm run prisma:seed
```

### 4. Run Development Server
```bash
npm run dev
```

Server will start at: `http://localhost:5000`

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files (database, env, etc.)
│   ├── controllers/     # Route controllers (business logic)
│   ├── middleware/      # Express middleware (auth, validation, etc.)
│   ├── models/          # Data models and types
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic services
│   │   ├── ai.service.ts        # OpenAI integration
│   │   ├── whatsapp.service.ts  # WhatsApp API
│   │   ├── evo.service.ts       # EVO integration
│   │   └── ...
│   ├── utils/           # Helper functions and utilities
│   ├── types/           # TypeScript type definitions
│   └── server.ts        # Main application entry point
├── prisma/
│   ├── schema.prisma    # Database schema
│   ├── seed.ts          # Database seeding script
│   └── migrations/      # Database migrations
├── .env                 # Environment variables (not in git)
├── .env.example         # Example environment variables
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

---

## 📋 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:studio` | Open Prisma Studio (DB GUI) |
| `npm run prisma:seed` | Seed database with test data |

---

## 🔧 Environment Variables

### Required Variables
```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:5173
```

### Optional Integration Variables
```env
# WhatsApp Business API
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...

# OpenAI API
OPENAI_API_KEY=...

# EVO System
EVO_API_URL=...
EVO_API_KEY=...
```

See `.env.example` for complete list.

---

## 🗄️ Database

### Prisma Commands
```bash
# Generate Prisma Client after schema changes
npx prisma generate

# Create a new migration
npx prisma migrate dev --name migration_name

# Apply migrations to production
npx prisma migrate deploy

# Open Prisma Studio (Database GUI)
npx prisma studio

# Reset database (⚠️ deletes all data)
npx prisma migrate reset
```

### Database Schema
See `prisma/schema.prisma` for complete schema definition.

**Main Entities:**
- Users (admin, manager, agent)
- Gyms (multi-tenant)
- Leads (customers)
- Conversations & Messages
- Follow-ups
- AI Prompts
- WhatsApp Accounts
- Notifications
- Activity Logs

---

## 🌐 API Endpoints

### Authentication
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
```

### Users
```
GET    /api/users
GET    /api/users/:id
PUT    /api/users/:id
DELETE /api/users/:id
```

### Gyms
```
GET    /api/gyms
GET    /api/gyms/:id
POST   /api/gyms
PUT    /api/gyms/:id
DELETE /api/gyms/:id
```

### Leads
```
GET    /api/leads
GET    /api/leads/:id
POST   /api/leads
PUT    /api/leads/:id
DELETE /api/leads/:id
PATCH  /api/leads/:id/status
```

### Conversations
```
GET    /api/conversations
GET    /api/conversations/:id
POST   /api/conversations
GET    /api/conversations/:id/messages
POST   /api/conversations/:id/messages
```

### Follow-ups
```
GET    /api/followups
POST   /api/followups
PUT    /api/followups/:id
DELETE /api/followups/:id
PATCH  /api/followups/:id/complete
```

### WhatsApp Webhook
```
GET    /api/webhooks/whatsapp (verification)
POST   /api/webhooks/whatsapp (incoming messages)
```

---

## 🔐 Authentication

Uses JWT (JSON Web Tokens) for authentication.

### Protected Routes
Add authentication middleware to protect routes:

```typescript
import { authenticate } from './middleware/auth';

router.get('/protected', authenticate, controller);
```

### Role-based Access
```typescript
import { authorize } from './middleware/auth';

router.post('/admin-only', 
  authenticate, 
  authorize(['ADMIN']), 
  controller
);
```

---

## 🤖 AI Integration (OpenAI)

### Service Location
`src/services/ai.service.ts`

### Usage
```typescript
import AIService from './services/ai.service';

const response = await AIService.generateResponse(
  message,
  conversationContext,
  gymConfig
);
```

---

## 💬 WhatsApp Integration

### Service Location
`src/services/whatsapp.service.ts`

### Webhook Setup
1. Get Meta App credentials
2. Setup webhook URL: `https://your-domain.com/api/webhooks/whatsapp`
3. Set verify token in `.env`
4. Verify webhook in Meta dashboard

---

## 🧪 Testing

```bash
npm test
```

---

## 📦 Deployment

### Build for Production
```bash
npm run build
```

### Start Production Server
```bash
npm start
```

### Recommended Platforms
- **Railway.app** - Easy PostgreSQL + Node.js hosting
- **Render.com** - Free tier available
- **Heroku** - Classic option
- **DigitalOcean** - More control
- **AWS** - Enterprise option

---

## 🐛 Debugging

### Development Mode
- Logs are in `dev` format (detailed)
- Error stack traces included
- Hot reload enabled

### Check Server Health
```bash
curl http://localhost:5000/health
```

---

## 📚 Documentation

- API docs: Coming soon (Swagger)
- Database schema: `prisma/schema.prisma`
- Architecture: `PROJECT_ROADMAP.md`

---

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Submit for review

---

## 📄 License

MIT License - DuxFit Team

---

## 🆘 Support

For issues or questions:
- Check `PROJECT_ROADMAP.md`
- Check `QUICK_CHECKLIST.md`
- Review API documentation
- Contact development team

---

**Happy Coding! 🚀**

