import { useEffect, useRef, useState } from 'react'
import './App.css'
import Sidebar from './components/Sidebar'
import Board from './components/Board'
import {
  createColumn,
  createComment,
  createTicket,
  fetchBoard,
  removeColumn,
  removeTicket,
  updateColumn,
  updateTicket as saveTicket,
} from './api'

const initialColumns = [
  {
    id: 'col-1',
    title: 'To Do',
    tickets: [
      { id: 't-1', title: 'Plan sprint', details: 'Outline goals for the week.' },
      { id: 't-2', title: 'Draft schedule', details: 'List meetings and deadlines.' },
    ],
  },
  {
    id: 'col-2',
    title: 'In Progress',
    tickets: [
      { id: 't-3', title: 'Build board UI', details: 'Columns, tickets, and add forms.' },
    ],
  },
  {
    id: 'col-3',
    title: 'Done',
    tickets: [],
  },
]

const MIN_SIDEBAR = 160
const MAX_SIDEBAR = 480
const DEFAULT_SIDEBAR =
  typeof window !== 'undefined' ? Math.round(window.innerWidth / 6) : 240

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export default function App() {
  const [columns, setColumns] = useState(initialColumns)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR)
  const resizingRef = useRef(false)
  const columnSyncTimerRef = useRef(null)
  const ticketSyncTimerRef = useRef(null)

  async function loadBoard() {
    setLoadError('')
    setIsLoading(true)
    try {
      const data = await fetchBoard()
      setColumns(data.columns)
    } catch (error) {
      setLoadError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadBoard()
    return () => {
      window.clearTimeout(columnSyncTimerRef.current)
      window.clearTimeout(ticketSyncTimerRef.current)
    }
  }, [])

  useEffect(() => {
    function onMouseMove(event) {
      if (!resizingRef.current) return
      setSidebarWidth(clamp(event.clientX, MIN_SIDEBAR, MAX_SIDEBAR))
    }

    function onMouseUp() {
      if (!resizingRef.current) return
      resizingRef.current = false
      document.body.classList.remove('is-resizing')
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  function startResize(event) {
    event.preventDefault()
    resizingRef.current = true
    document.body.classList.add('is-resizing')
  }

  async function addColumn(title) {
    const trimmed = title.trim()
    if (!trimmed) return

    try {
      const column = await createColumn(trimmed)
      setColumns((prev) => [...prev, column])
    } catch (error) {
      setLoadError(error.message)
    }
  }

  async function deleteColumn(columnId) {
    if (!window.confirm('Delete this column and all of its tickets?')) return false
    try {
      await removeColumn(columnId)
      setColumns((prev) => prev.filter((column) => column.id !== columnId))
      return true
    } catch (error) {
      setLoadError(error.message)
      return false
    }
  }

  async function addTicket(columnId, title, details) {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    try {
      const ticket = await createTicket(columnId, trimmedTitle, details.trim())
      setColumns((prev) => prev.map((column) => (
        column.id === columnId ? { ...column, tickets: [...column.tickets, ticket] } : column
      )))
    } catch (error) {
      setLoadError(error.message)
    }
  }

  async function updateTicket(columnId, ticketId, updates) {
    try {
      const savedTicket = await saveTicket(ticketId, updates)
      setColumns((prev) => prev.map((column) => (
        column.id === columnId
          ? { ...column, tickets: column.tickets.map((ticket) => ticket.id === ticketId ? { ...ticket, ...savedTicket, comments: savedTicket.comments ?? ticket.comments } : ticket) }
          : column
      )))
    } catch (error) {
      setLoadError(error.message)
    }
  }

  async function deleteTicket(columnId, ticketId) {
    if (!window.confirm('Delete this ticket?')) return false
    try {
      await removeTicket(ticketId)
      setColumns((prev) => prev.map((column) => (
        column.id === columnId ? { ...column, tickets: column.tickets.filter((ticket) => ticket.id !== ticketId) } : column
      )))
      return true
    } catch (error) {
      setLoadError(error.message)
      return false
    }
  }

  function scheduleColumnSync(nextColumns) {
    window.clearTimeout(columnSyncTimerRef.current)
    columnSyncTimerRef.current = window.setTimeout(() => {
      Promise.all(nextColumns.map((column, index) => updateColumn(column.id, { position: index })))
        .catch((error) => setLoadError(error.message))
    }, 180)
  }

  function scheduleTicketSync(nextColumns) {
    window.clearTimeout(ticketSyncTimerRef.current)
    ticketSyncTimerRef.current = window.setTimeout(() => {
      Promise.all(nextColumns.flatMap((column) => column.tickets.map((ticket, index) => (
        saveTicket(ticket.id, { columnId: column.id, position: index })
      )))).catch((error) => setLoadError(error.message))
    }, 180)
  }

  async function addComment(columnId, ticketId, text) {
    try {
      const comment = await createComment(ticketId, text)
      setColumns((prev) => prev.map((column) => (
        column.id === columnId
          ? { ...column, tickets: column.tickets.map((ticket) => ticket.id === ticketId ? { ...ticket, comments: [...(ticket.comments || []), comment] } : ticket) }
          : column
      )))
      return comment
    } catch (error) {
      setLoadError(error.message)
      throw error
    }
  }

  function moveColumn(fromId, toId, placement = 'after') {
    if (fromId === toId) return

    setColumns((prev) => {
      const fromIndex = prev.findIndex((column) => column.id === fromId)
      const toIndex = prev.findIndex((column) => column.id === toId)
      if (fromIndex < 0 || toIndex < 0) return prev

      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      const targetIndex = next.findIndex((column) => column.id === toId)
      const insertAt = placement === 'before' ? targetIndex : targetIndex + 1
      next.splice(insertAt, 0, moved)
      scheduleColumnSync(next)
      return next
    })
  }

  function moveTicket(fromColumnId, ticketId, toColumnId, toIndex) {
    setColumns((prev) => {
      const sourceColumn = prev.find((column) => column.id === fromColumnId)
      if (!sourceColumn) return prev

      const ticketIndex = sourceColumn.tickets.findIndex((ticket) => ticket.id === ticketId)
      if (ticketIndex < 0) return prev

      const ticket = sourceColumn.tickets[ticketIndex]
      const next = prev.map((column) => ({
        ...column,
        tickets: [...column.tickets],
      }))

      const fromColumn = next.find((column) => column.id === fromColumnId)
      const toColumn = next.find((column) => column.id === toColumnId)
      if (!fromColumn || !toColumn) return prev

      fromColumn.tickets.splice(ticketIndex, 1)

      let insertAt = toIndex
      if (
        fromColumnId === toColumnId &&
        ticketIndex < toIndex
      ) {
        insertAt = toIndex - 1
      }
      insertAt = clamp(insertAt, 0, toColumn.tickets.length)
      toColumn.tickets.splice(insertAt, 0, ticket)
      scheduleTicketSync(next)
      return next
    })
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">trello</h1>
      </header>

      <div className="app-body">
        <div className="sidebar-pane" style={{ width: sidebarWidth }}>
          <Sidebar />
        </div>

        <div
          className="resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize inbox"
          onMouseDown={startResize}
        />

        <main className="board-area">
          {isLoading ? <div className="board-status">Loading board...</div> : null}
          {loadError ? (
            <div className="board-status board-status-error">
              <span>Backend: {loadError}</span>
              <button type="button" onClick={loadBoard}>Retry</button>
            </div>
          ) : null}
          <Board
            columns={columns}
            onAddColumn={addColumn}
            onDeleteColumn={deleteColumn}
            onAddTicket={addTicket}
            onUpdateTicket={updateTicket}
            onDeleteTicket={deleteTicket}
            onAddComment={addComment}
            onMoveColumn={moveColumn}
            onMoveTicket={moveTicket}
          />
        </main>
      </div>
    </div>
  )
}
