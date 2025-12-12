# Lokal

Transit planning and route discovery web application for public bus transportation.

## Features

- **Multi-stop journey planning** - Plan trips with multiple destinations and buffer times at each stop
- **Real-time bus tracking** - View live bus positions with 3D visualization on the map
- **Route exploration** - Browse all available bus routes with stop details and schedules
- **Saved journeys** - Save favorite routes and complex itineraries for quick access
- **Interactive map** - Mapbox-powered map with walking/transit paths and stop markers
- **User authentication** - Account system with JWT-based authentication
- **API documentation** - Swagger/OpenAPI docs and Postman collection

## Tech Stack

### Frontend

- Next.js 15.2 (React 19, App Router)
- Mapbox GL + react-map-gl (3D map visualization)
- Tailwind CSS 4.0
- Radix UI (headless components)
- TanStack Query (data fetching)
- Framer Motion (animations)
- dnd-kit (drag-and-drop)

### Backend

- tRPC (type-safe API)
- Next.js API Routes
- PostgreSQL + Prisma ORM
- Redis (caching)
- JWT authentication

### External Services

- Availtec Bus API (real-time transit data)
- Mapbox Search API (geocoding/place search)
- GTFS (scheduled transit data)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Redis
- Mapbox account (for API token)

### Installation

1. Clone the repository

2. Install dependencies:
   ```bash
   npm install
   # or
   bun install
   ```

3. Copy `.env.example` to `.env` and fill in the required values:
   ```bash
   cp .env.example .env
   ```

4. Start the database (if using the provided script):
   ```bash
   ./scripts/start-database.sh
   ```

5. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

The app will be available at [http://localhost:3001](http://localhost:3001).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox API token |
| `NEXT_PUBLIC_MAPBOX_STYLE_ID` | Mapbox style ID for map rendering |
| `JWT_SECRET` | Secret key for JWT signing |
| `REDIS_URL` | Redis connection URL |
| `ENABLE_FAKE_BUSES` | Set to `true` to use fake bus data for development |

## Project Structure

```
src/
├── app/                # Next.js pages and API routes
│   ├── api/           # REST API endpoints
│   ├── _components/   # Page-specific components
│   ├── docs/          # API documentation page
│   ├── journey/       # Saved journey pages
│   └── route/         # Route detail pages
├── server/            # Backend logic
│   ├── api/           # tRPC routers
│   ├── auth/          # Authentication service
│   ├── routing/       # Journey planning logic
│   └── bus-api.ts     # External API integration
├── components/        # Shared UI components
├── hooks/             # Custom React hooks
├── lib/               # Utilities (cache, redis)
└── types/             # TypeScript type definitions
```

## API Documentation

- **Swagger UI**: Available at `/docs` when running the app
