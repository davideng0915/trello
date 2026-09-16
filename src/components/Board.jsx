import { useEffect, useRef, useState } from 'react'
import Column from './Column'
import TableView from './TableView'
import './Board.css'

export default function Board({
  columns,
  onAddColumn,
  onDeleteColumn,
  onAddTicket,
  onUpdateTicket,
  onDeleteTicket,
  onAddComment,
  onMoveColumn,
  onMoveTicket,
}) {
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [isAddingColumn, setIsAddingColumn] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeView, setActiveView] = useState('board')
  const [dragOverColumnId, setDragOverColumnId] = useState(null)
  const lastColumnHoverRef = useRef(null)
  const menuRef = useRef(null)
  const views = [
    ['table', '▦', 'Table'],
    ['board', '▤', 'Board'],
    ['calendar', '□', 'Calendar'],
    ['timeline', '━', 'Timeline'],
    ['dashboard', '◫', 'Dashboard'],
    ['map', '⌖', 'Map'],
  ]

  useEffect(() => {
    function closeMenu(event) {
      if (!menuRef.current?.contains(event.target)) setIsMenuOpen(false)
    }

    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [])

  function handleAddColumn(event) {
    event.preventDefault()
    onAddColumn(newColumnTitle)
    setNewColumnTitle('')
    setIsAddingColumn(false)
  }

  function handleColumnDragOver(event, columnId) {
    event.preventDefault()
    const types = Array.from(event.dataTransfer.types)
    const type = types.includes('application/x-column')
      ? 'column'
      : types.includes('application/x-ticket')
        ? 'ticket'
        : null

    if (!type) return
    event.dataTransfer.dropEffect = 'move'
    setDragOverColumnId(columnId)

    if (type === 'column') {
      const draggedColumnId = event.dataTransfer.getData('application/x-column')
      const bounds = event.currentTarget.getBoundingClientRect()
      const placement = event.clientX < bounds.left + bounds.width / 2 ? 'before' : 'after'
      const hoverKey = `${columnId}:${placement}`
      if (
        draggedColumnId &&
        draggedColumnId !== columnId &&
        lastColumnHoverRef.current !== hoverKey
      ) {
        onMoveColumn(draggedColumnId, columnId, placement)
        lastColumnHoverRef.current = hoverKey
      }
    }
  }

  function handleColumnDrop(event, targetColumnId) {
    event.preventDefault()
    setDragOverColumnId(null)

    const columnPayload = event.dataTransfer.getData('application/x-column')
    if (columnPayload) {
      const bounds = event.currentTarget.getBoundingClientRect()
      const placement = event.clientX < bounds.left + bounds.width / 2 ? 'before' : 'after'
      const hoverKey = `${targetColumnId}:${placement}`
      if (lastColumnHoverRef.current !== hoverKey) {
        onMoveColumn(columnPayload, targetColumnId, placement)
      }
      lastColumnHoverRef.current = null
      return
    }

    const ticketPayload = event.dataTransfer.getData('application/x-ticket')
    if (!ticketPayload) return

    const { fromColumnId, ticketId } = JSON.parse(ticketPayload)
    const target = columns.find((column) => column.id === targetColumnId)
    onMoveTicket(fromColumnId, ticketId, targetColumnId, target ? target.tickets.length : 0)
  }

  function handleColumnDragEnd() {
    lastColumnHoverRef.current = null
    setDragOverColumnId(null)
  }

  return (
    <section className="board">
      <div className="board-header">
        <h2 className="board-title">My trello board</h2>
        <div className="board-menu" ref={menuRef}>
          <button
            type="button"
            className="board-menu-button"
            aria-label="Open board menu"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <span aria-hidden="true">⋮</span>
          </button>
          {isMenuOpen ? (
            <div className="board-menu-dropdown" role="menu">
              {views.map(([view, icon, label]) => (
                <button
                  key={view}
                  type="button"
                  role="menuitemradio"
                  aria-checked={activeView === view}
                  className={activeView === view ? 'is-active' : ''}
                  onClick={() => {
                    setActiveView(view)
                    setIsMenuOpen(false)
                  }}
                >
                  <span className="board-menu-icon" aria-hidden="true">{icon}</span>
                  {label}
                  {activeView === view ? <span className="board-menu-check" aria-hidden="true">✓</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {activeView === 'table' ? <TableView columns={columns} /> : (
        <div className="board-scroll">
          <div className="board-columns">
          {columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              isDragOver={dragOverColumnId === column.id}
              onAddTicket={onAddTicket}
              onUpdateTicket={onUpdateTicket}
              onDeleteTicket={onDeleteTicket}
              onAddComment={onAddComment}
              onDeleteColumn={onDeleteColumn}
              onMoveTicket={onMoveTicket}
              onColumnDragOver={handleColumnDragOver}
              onColumnDrop={handleColumnDrop}
              onColumnDragEnd={handleColumnDragEnd}
              onColumnDragLeave={() => setDragOverColumnId(null)}
            />
          ))}

          <div className="add-column">
            {isAddingColumn ? (
              <form className="add-column-form" onSubmit={handleAddColumn}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Enter column title"
                  value={newColumnTitle}
                  onChange={(event) => setNewColumnTitle(event.target.value)}
                />
                <div className="add-column-actions">
                  <button type="submit">Add column</button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setIsAddingColumn(false)
                      setNewColumnTitle('')
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="add-column-trigger"
                onClick={() => setIsAddingColumn(true)}
              >
                + Add another column
              </button>
            )}
          </div>
          </div>
        </div>
      )}
    </section>
  )
}
