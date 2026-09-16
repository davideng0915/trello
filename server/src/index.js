import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { randomUUID } from 'node:crypto'
import pg from 'pg'

const { Pool } = pg
const app = express()
const port = Number(process.env.PORT || 3001)
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('DATABASE_URL is required. Configure server/.env before starting the backend.')
  process.exit(1)
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }))
app.use(express.json({ limit: '100kb' }))

const id = () => randomUUID()
const maxTitleLength = 200
const maxDetailsLength = 10_000
const maxCommentLength = 5_000

function textValue(value, field, maxLength) {
  if (typeof value !== 'string') return { error: `${field} must be text.` }
  const text = value.trim()
  if (!text) return { error: `${field} is required.` }
  if (text.length > maxLength) return { error: `${field} must be ${maxLength} characters or fewer.` }
  return { value: text }
}

function optionalTextValue(value, field, maxLength) {
  if (value === undefined) return { value: undefined }
  return textValue(value, field, maxLength)
}

function integerValue(value, field) {
  if (value === undefined) return { value: undefined }
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0) return { error: `${field} must be a non-negative integer.` }
  return { value: number }
}

function booleanValue(value, field) {
  if (value === undefined) return { value: undefined }
  if (typeof value !== 'boolean') return { error: `${field} must be true or false.` }
  return { value }
}

async function getBoard() {
  const boardResult = await pool.query('SELECT id, title FROM boards ORDER BY created_at LIMIT 1')
  const board = boardResult.rows[0]
  if (!board) return null

  const { rows } = await pool.query(`
    SELECT c.id AS column_id, c.title AS column_title, c.position AS column_position,
           t.id AS ticket_id, t.title AS ticket_title, t.details, t.completed, t.position AS ticket_position,
           COALESCE(json_agg(json_build_object('id', cm.id, 'text', cm.text, 'createdAt', cm.created_at)
             ORDER BY cm.created_at) FILTER (WHERE cm.id IS NOT NULL), '[]') AS comments
    FROM columns c
    LEFT JOIN tickets t ON t.column_id = c.id
    LEFT JOIN comments cm ON cm.ticket_id = t.id
    WHERE c.board_id = $1
    GROUP BY c.id, t.id
    ORDER BY c.position, t.position
  `, [board.id])

  const columns = []
  for (const row of rows) {
    let column = columns.find((item) => item.id === row.column_id)
    if (!column) {
      column = { id: row.column_id, title: row.column_title, tickets: [] }
      columns.push(column)
    }
    if (row.ticket_id) column.tickets.push({
      id: row.ticket_id,
      title: row.ticket_title,
      details: row.details,
      completed: row.completed,
      comments: row.comments,
    })
  }
  return { board, columns }
}

function errorResponse(next, error) {
  console.error(error)
  next(error)
}

app.get('/api/health', async (_request, response, next) => {
  try {
    await pool.query('SELECT 1')
    response.json({ status: 'ok', database: 'connected' })
  } catch (error) {
    errorResponse(next, error)
  }
})

app.get('/api/board', async (_request, response, next) => {
  try {
    const board = await getBoard()
    if (!board) return response.status(404).json({ error: 'No board found.' })
    response.json(board)
  } catch (error) {
    errorResponse(next, error)
  }
})

app.post('/api/columns', async (request, response, next) => {
  try {
    const titleResult = textValue(request.body.title, 'Column title', maxTitleLength)
    if (titleResult.error) return response.status(400).json({ error: titleResult.error })
    const title = titleResult.value
    const board = await pool.query('SELECT id FROM boards ORDER BY created_at LIMIT 1')
    if (!board.rows[0]) return response.status(503).json({ error: 'No board is configured.' })
    const position = await pool.query('SELECT COALESCE(MAX(position), -1) + 1 AS value FROM columns WHERE board_id = $1', [board.rows[0].id])
    const result = await pool.query(
      'INSERT INTO columns (id, board_id, title, position) VALUES ($1, $2, $3, $4) RETURNING id, title',
      [id(), board.rows[0].id, title, position.rows[0].value],
    )
    response.status(201).json({ ...result.rows[0], tickets: [] })
  } catch (error) {
    errorResponse(next, error)
  }
})

app.patch('/api/columns/:columnId', async (request, response, next) => {
  try {
    const titleResult = optionalTextValue(request.body.title, 'Column title', maxTitleLength)
    const positionResult = integerValue(request.body.position, 'Column position')
    if (titleResult.error || positionResult.error) {
      return response.status(400).json({ error: titleResult.error || positionResult.error })
    }
    const result = await pool.query(
      'UPDATE columns SET title = COALESCE($1, title), position = COALESCE($2, position) WHERE id = $3 RETURNING id, title',
      [titleResult.value, positionResult.value, request.params.columnId],
    )
    if (!result.rows[0]) return response.status(404).json({ error: 'Column not found.' })
    response.json(result.rows[0])
  } catch (error) {
    errorResponse(next, error)
  }
})

app.delete('/api/columns/:columnId', async (request, response, next) => {
  try {
    const result = await pool.query('DELETE FROM columns WHERE id = $1', [request.params.columnId])
    if (!result.rowCount) return response.status(404).json({ error: 'Column not found.' })
    response.status(204).end()
  } catch (error) {
    errorResponse(next, error)
  }
})

app.post('/api/columns/:columnId/tickets', async (request, response, next) => {
  try {
    const titleResult = textValue(request.body.title, 'Ticket title', maxTitleLength)
    const detailsResult = request.body.details === undefined
      ? { value: '' }
      : optionalTextValue(request.body.details, 'Ticket details', maxDetailsLength)
    if (titleResult.error || detailsResult.error) {
      return response.status(400).json({ error: titleResult.error || detailsResult.error })
    }
    const completedResult = booleanValue(request.body.completed, 'Completed')
    if (completedResult.error) return response.status(400).json({ error: completedResult.error })
    const title = titleResult.value
    const position = await pool.query('SELECT COALESCE(MAX(position), -1) + 1 AS value FROM tickets WHERE column_id = $1', [request.params.columnId])
    const result = await pool.query(
      `INSERT INTO tickets (id, column_id, title, details, completed, position)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, details, completed`,
      [id(), request.params.columnId, title, detailsResult.value, completedResult.value ?? false, position.rows[0].value],
    )
    response.status(201).json({ ...result.rows[0], comments: [] })
  } catch (error) {
    errorResponse(next, error)
  }
})

app.patch('/api/tickets/:ticketId', async (request, response, next) => {
  try {
    const titleResult = optionalTextValue(request.body.title, 'Ticket title', maxTitleLength)
    const detailsResult = optionalTextValue(request.body.details, 'Ticket details', maxDetailsLength)
    const positionResult = integerValue(request.body.position, 'Ticket position')
    const completedResult = booleanValue(request.body.completed, 'Completed')
    const columnId = request.body.columnId === undefined ? undefined : String(request.body.columnId)
    if (titleResult.error || detailsResult.error || positionResult.error || completedResult.error) {
      return response.status(400).json({ error: titleResult.error || detailsResult.error || positionResult.error || completedResult.error })
    }
    const result = await pool.query(
      `UPDATE tickets SET title = COALESCE($1, title), details = COALESCE($2, details),
       completed = COALESCE($3, completed), position = COALESCE($4, position),
       column_id = COALESCE($5, column_id) WHERE id = $6
       RETURNING id, title, details, completed`,
      [titleResult.value, detailsResult.value, completedResult.value, positionResult.value, columnId, request.params.ticketId],
    )
    if (!result.rows[0]) return response.status(404).json({ error: 'Ticket not found.' })
    response.json({ ...result.rows[0], comments: [] })
  } catch (error) {
    errorResponse(next, error)
  }
})

app.delete('/api/tickets/:ticketId', async (request, response, next) => {
  try {
    const result = await pool.query('DELETE FROM tickets WHERE id = $1', [request.params.ticketId])
    if (!result.rowCount) return response.status(404).json({ error: 'Ticket not found.' })
    response.status(204).end()
  } catch (error) {
    errorResponse(next, error)
  }
})

app.post('/api/tickets/:ticketId/comments', async (request, response, next) => {
  try {
    const textResult = textValue(request.body.text, 'Comment text', maxCommentLength)
    if (textResult.error) return response.status(400).json({ error: textResult.error })
    const result = await pool.query(
      'INSERT INTO comments (id, ticket_id, text) VALUES ($1, $2, $3) RETURNING id, text, created_at AS "createdAt"',
      [id(), request.params.ticketId, textResult.value],
    )
    response.status(201).json(result.rows[0])
  } catch (error) {
    errorResponse(next, error)
  }
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: 'Unexpected server error.' })
})

const server = app.listen(port, () => console.log(`Trello backend listening on http://localhost:${port}`))

async function shutdown(signal) {
  console.log(`${signal}: shutting down backend`)
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
