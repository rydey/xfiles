# Communication Management System

A comprehensive communication management system designed for journalists with admin dashboard and journalist portal capabilities.

## 🚀 Features

### Backend & Database
- **PostgreSQL** - Robust relational database with full-text search capabilities
- **Node.js + Express** - RESTful API with TypeScript
- **Prisma ORM** - Type-safe database operations and migrations
- **JWT Authentication** - Secure role-based access control
- **Rate Limiting** - API protection against abuse

### Frontend
- **React + Vite** - Fast, modern frontend framework
- **Tailwind CSS** - Utility-first styling
- **React Query** - Efficient data fetching and caching
- **React Router** - Client-side routing
- **Responsive Design** - Mobile-friendly interface

### Admin Dashboard
- **Contact Management** - Create, edit, delete contacts with categories
- **Message Management** - View and manage all communications
- **Category Management** - Organize contacts with color-coded categories
- **User Management** - Admin and journalist role management
- **Advanced Filtering** - Search by name, phone, category, type, date range
- **Inline Editing** - Quick contact and message updates

### Journalist Portal
- **Read-Only Access** - Secure view of communications
- **Smart Search** - Search by number, name, or keyword
- **Category Navigation** - Browse contacts by category
- **Message Export** - Download conversations in CSV/JSON format
- **Contact Details** - View full conversation history

## 🛠️ Tech Stack

### Backend
- Node.js 18+
- Express.js
- TypeScript
- PostgreSQL
- Prisma ORM
- JWT Authentication
- bcryptjs
- express-rate-limit
- cors
- helmet

### Frontend
- React 18
- Vite
- TypeScript
- Tailwind CSS
- React Query
- React Router DOM
- React Hook Form
- Lucide React
- date-fns

## 📦 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- npm or yarn

### 1. Clone and Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup

```bash
# Create PostgreSQL database
createdb communication_db

# Copy environment file
cp backend/env.example backend/.env

# Edit backend/.env with your database credentials
DATABASE_URL="postgresql://username:password@localhost:5432/communication_db"
JWT_SECRET="your-super-secret-jwt-key-here"
```

### 3. Database Migration

```bash
cd backend

# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:push

# (Optional) Open Prisma Studio to view data
npm run db:studio
```

### 4. Start Development Servers

```bash
# From root directory - starts both backend and frontend
npm run dev

# Or start individually:
# Backend (port 3001)
cd backend && npm run dev

# Frontend (port 5173)
cd frontend && npm run dev
```

## 🔐 Default Access

After setup, create your first admin user:

```bash
# You can use the API directly or create a user through the admin interface
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123",
    "role": "ADMIN"
  }'
```

## 📁 Project Structure

```
├── backend/
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── middleware/      # Auth middleware
│   │   └── index.ts         # Server entry point
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   └── lib/            # Utilities
│   └── package.json
└── package.json            # Root package.json
```

## 🗄️ Database Schema

### Core Entities
- **Users** - Admin and journalist accounts with username/password
- **Contacts** - Phone numbers with names and types (individual/group)
- **Categories** - Simple name-based contact organization
- **ContactCategories** - Many-to-many relationship between contacts and categories
- **Messages** - SMS, calls, instant messages, calendar events with sender/receiver relationships

### Key Features
- **Full-text search** ready for PostgreSQL
- **Audit trails** with created/updated timestamps
- **Flexible metadata** storage for message attachments
- **Role-based access** control

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login (username/password)
- `POST /api/auth/register` - User registration (admin only)
- `GET /api/auth/me` - Get current user

### Contacts
- `GET /api/contacts` - List contacts with filtering
- `POST /api/contacts` - Create contact (admin only)
- `PUT /api/contacts/:id` - Update contact (admin only)
- `DELETE /api/contacts/:id` - Delete contact (admin only)

### Messages
- `GET /api/messages` - List messages with filtering
- `POST /api/messages` - Create message (admin only)
- `PUT /api/messages/:id` - Update message (admin only)
- `DELETE /api/messages/:id` - Delete message (admin only)
- `GET /api/messages/export/:contactId` - Export messages

### Categories
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category (admin only)
- `PUT /api/categories/:id` - Update category (admin only)
- `DELETE /api/categories/:id` - Delete category (admin only)

### Users
- `GET /api/users` - List users (admin only)
- `PUT /api/users/:id` - Update user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

## 🚀 Deployment

### Production Build

```bash
# Build both backend and frontend
npm run build

# Start production server
npm start
```

### Environment Variables

**Backend (.env)**
```env
DATABASE_URL="postgresql://username:password@localhost:5432/communication_db"
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_EXPIRES_IN="7d"
PORT=3001
NODE_ENV="production"
FRONTEND_URL="https://your-domain.com"
```

### Database Production Setup

```bash
# Run migrations in production
cd backend
npx prisma migrate deploy
```

## 🔍 Search & Performance

### PostgreSQL Full-Text Search
The system is designed to handle 200k+ rows efficiently with:
- Indexed phone numbers and names
- Full-text search on message content
- Category-based filtering
- Date range queries

### Future Enhancements
- **pg_trgm** for fuzzy search
- **Elasticsearch** integration for advanced search
- **Meilisearch** for real-time search

## 🛡️ Security Features

- JWT token authentication
- Role-based access control
- Rate limiting on API endpoints
- Input validation and sanitization
- CORS protection
- Helmet security headers

## 📊 Monitoring & Analytics

- Request logging
- Error tracking
- Performance monitoring ready
- Database query optimization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
1. Check the documentation
2. Review existing issues
3. Create a new issue with detailed information

---

**Built with ❤️ for journalists and communication management**
