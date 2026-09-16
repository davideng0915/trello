# Trello PostgreSQL backend

## 1. Create the database

Make sure PostgreSQL is installed and running, then create a database:

```bash
createdb trello
```

Apply the schema and seed the initial board:

```bash
psql trello < schema.sql
```

## 2. Configure the connection

Copy `.env.example` to `.env` and update the PostgreSQL username/password:

```bash
cp .env.example .env
```

## 3. Install and run

```bash
cd server
npm install
npm run dev
```

The API runs at `http://localhost:3001`.

Check the database connection at `http://localhost:3001/api/health`.

For production-like frontend access, set `FRONTEND_ORIGIN` to the deployed frontend origin.

## Endpoints

- `GET /api/health`
- `GET /api/board`
- `POST /api/columns`
- `PATCH /api/columns/:columnId`
- `DELETE /api/columns/:columnId`
- `POST /api/columns/:columnId/tickets`
- `PATCH /api/tickets/:ticketId`
- `DELETE /api/tickets/:ticketId`
- `POST /api/tickets/:ticketId/comments`

All board data is persisted in PostgreSQL.
