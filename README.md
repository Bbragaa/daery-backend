<div align="center">

<img src="https://img.shields.io/badge/status-em%20desenvolvimento-yellow?style=for-the-badge" />
<img src="https://img.shields.io/badge/node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white" />
<img src="https://img.shields.io/badge/typescript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" />

<br/>
<br/>

# Daery — Backend

**Backend service for Daery — a platform for tracking and visualizing disease outbreak data across regions.**

[Getting Started](#-getting-started) · [Architecture](#-architecture) · [API Docs](#-api-docs) · [Contributing](#-contributing)

</div>

---

## About

Daery is an epidemiological surveillance platform that centralizes medical records and diagnostic data to support public health decision-making. This repository contains the REST API that powers the platform, responsible for authentication, business logic, and data management.

The system is designed for health professionals, public managers, researchers, and the general public who need reliable, structured information about disease incidence across geographic regions.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20.x |
| Language | TypeScript 5.x |
| Framework | Express |
| ORM | Prisma |
| Database | PostgreSQL |
| Cache / Sessions | Redis |
| Authentication | JWT + bcryptjs |
| Validation | Zod |
| Testing | Jest + ts-jest |
| API Docs | Swagger (OpenAPI) |

---

## Architecture

The backend follows the **MVCS pattern** (Model, View, Controller, Service), keeping business logic isolated and the codebase easy to maintain and test.

```
src/
├── controllers/     # Receives HTTP requests, delegates to services
├── services/        # Business logic
├── models/          # Database entities managed by Prisma
├── routes/          # API endpoints (View layer)
├── middlewares/     # Auth, validation, error handling
├── config/          # Environment and app configuration
└── tests/           # Unit and integration tests
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- Redis
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/daery-backend.git
cd daery-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your local credentials
```

### Database setup

```bash
# Run migrations
npx prisma migrate dev

# (Optional) Seed the database
npx prisma db seed
```

### Running

```bash
# Development (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

### Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

---

## Environment Variables

See [`.env.example`](.env.example) for all required variables. The main ones are:

```env
DATABASE_URL=        # PostgreSQL connection string
REDIS_URL=           # Redis connection string
JWT_SECRET=          # Secret key for signing tokens
JWT_EXPIRES_IN=      # Token expiration (e.g. 7d)
PORT=                # Server port (default: 3000)
CORS_ORIGIN=         # Allowed frontend origin
```

---

## API Docs

Once the server is running, interactive API documentation is available at:

```
http://localhost:3000/api/docs
```

The Swagger spec follows the OpenAPI 3.0 standard. 
---

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

In short:
- Branch off from `main` and open a PR — direct commits to `main` are not allowed
- Follow the [Conventional Commits](https://www.conventionalcommits.org/) standard (`feat`, `fix`, `docs`, `chore`, `test`, `refactor`)
- Write or update tests for any changed logic

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">
  <sub>Developed as a capstone project (TCC) — Computer Science</sub>
</div>
