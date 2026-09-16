import { useRef, useState } from 'react'
import Ticket from './Ticket'
import './Column.css'

function hasDragType(dataTransfer, type) {
  return Array.from(dataTransfer.types).includes(type)
}

export default function Column({
  column,
  isDragOver,
  onAddTicket,
  onUpdateTicket,
  onDeleteTicket,
  onAddComment,
  onDeleteColumn,
  onMoveTicket,
  onColumnDragOver,
  onColumnDrop,
  onColumnDragEnd,
  onColumnDragLeave,
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const columnRef = useRef(null)

  function handleSubmit(event) {
    event.preventDefault()
    onAddTicket(column.id, title, details)
    setTitle('')
    setDetails('')
    setIsAdding(false)
  }

  function handleColumnDragStart(event) {
    if (event.target.closest('.ticket, button, input, textarea')) {
      event.preventDefault()
      return
    }

    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-column', column.id)
    event.dataTransfer.setData('text/plain', column.title)
    if (columnRef.current) {
      event.dataTransfer.setDragImage(columnRef.current, 40, 20)
    }
    setIsDragging(true)
  }

  function handleColumnDragEnd() {
    setIsDragging(false)
    onColumnDragEnd()
  }

  function handleTicketDragOver(event, index) {
    event.preventDefault()
    event.stopPropagation()
    if (!hasDragType(event.dataTransfer, 'application/x-ticket')) return
    event.dataTransfer.dropEffect = 'move'
  }

  function handleTicketDrop(event, index) {
    event.preventDefault()
    event.stopPropagation()

    const ticketPayload = event.dataTransfer.getData('application/x-ticket')
    if (!ticketPayload) return

    const { fromColumnId, ticketId } = JSON.parse(ticketPayload)
    onMoveTicket(fromColumnId, ticketId, column.id, index)
  }

  return (
    <article
      ref={columnRef}
      className={`column${isDragging ? ' is-dragging' : ''}${isDragOver ? ' is-drag-over' : ''}`}
      draggable
      onDragStart={handleColumnDragStart}
      onDragEnd={handleColumnDragEnd}
      onDragOver={(event) => onColumnDragOver(event, column.id)}
      onDrop={(event) => onColumnDrop(event, column.id)}
      onDragLeave={onColumnDragLeave}
    >
      <header
        className="column-header"
      >
        <span className="column-drag" title="Drag column" aria-hidden="true">
          ⋮⋮
        </span>
        <h3 className="column-title">{column.title}</h3>
        <span className="column-count">{column.tickets.length}</span>
        <button
          type="button"
          className="icon-button"
          aria-label={`Delete column ${column.title}`}
          title="Delete column"
          draggable={false}
          onClick={(event) => {
            event.stopPropagation()
            onDeleteColumn(column.id)
          }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          ×
        </button>
      </header>

      <div className="column-tickets">
        {column.tickets.map((ticket, index) => (
          <div
            key={ticket.id}
            className="ticket-drop-slot"
            onDragOver={(event) => handleTicketDragOver(event, index)}
            onDrop={(event) => handleTicketDrop(event, index)}
          >
            <Ticket
              ticket={ticket}
              columnId={column.id}
              onUpdate={(updates) => onUpdateTicket(column.id, ticket.id, updates)}
              onDelete={() => onDeleteTicket(column.id, ticket.id)}
              onAddComment={(text) => onAddComment(column.id, ticket.id, text)}
            />
          </div>
        ))}

        <div
          className="ticket-drop-slot ticket-drop-end"
          onDragOver={(event) => handleTicketDragOver(event, column.tickets.length)}
          onDrop={(event) => handleTicketDrop(event, column.tickets.length)}
        />
      </div>

      {isAdding ? (
        <form className="add-ticket-form" onSubmit={handleSubmit}>
          <input
            autoFocus
            type="text"
            placeholder="Ticket title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            placeholder="Ticket details"
            rows={3}
            value={details}
            onChange={(event) => setDetails(event.target.value)}
          />
          <div className="add-ticket-actions">
            <button type="submit">Add ticket</button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setIsAdding(false)
                setTitle('')
                setDetails('')
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="add-ticket-trigger"
          onClick={() => setIsAdding(true)}
        >
          + Add a ticket
        </button>
      )}
    </article>
  )
}
