import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './Ticket.css'

export default function Ticket({ ticket, columnId, onUpdate, onDelete, onAddComment }) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(ticket.title)
  const [details, setDetails] = useState(ticket.details)
  const [completed, setCompleted] = useState(Boolean(ticket.completed))
  const [activeTab, setActiveTab] = useState('add')
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState(ticket.comments || [])
  const [isDragging, setIsDragging] = useState(false)
  const didDragRef = useRef(false)
  const modalRef = useRef(null)

  function handleSave(event) {
    event.preventDefault()
    const nextTitle = title.trim()
    if (!nextTitle) return

    onUpdate({ title: nextTitle, details: details.trim(), completed })
    setIsEditing(false)
  }

  function handleCancel() {
    setTitle(ticket.title)
    setDetails(ticket.details)
    setCompleted(Boolean(ticket.completed))
    setIsEditing(false)
  }

  function addComment(event) {
    event.preventDefault()
    const trimmedComment = comment.trim()
    if (!trimmedComment) return
    onAddComment(trimmedComment)
      .then((savedComment) => {
        setComments((currentComments) => [...currentComments, savedComment])
        setComment('')
      })
      .catch(() => {})
  }

  function handleDragStart(event) {
    event.stopPropagation()
    didDragRef.current = false
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(
      'application/x-ticket',
      JSON.stringify({ fromColumnId: columnId, ticketId: ticket.id }),
    )
    event.dataTransfer.setData('text/plain', ticket.title)
    setIsDragging(true)
  }

  function handleDragEnd(event) {
    event.stopPropagation()
    setIsDragging(false)
    didDragRef.current = true
    window.setTimeout(() => {
      didDragRef.current = false
    }, 0)
  }

  function handleOpen() {
    if (didDragRef.current) return
    setIsEditing(true)
  }

  async function handleDelete() {
    const deleted = await onDelete()
    if (deleted) setIsEditing(false)
  }

  useEffect(() => {
    if (!isEditing) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') handleCancel()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, ticket.title, ticket.details])

  useEffect(() => {
    if (isEditing) modalRef.current?.querySelector('input[type="text"]')?.focus()
  }, [isEditing])

  return (
    <>
      <div
        className={`ticket${isDragging ? ' is-dragging' : ''}${ticket.completed ? ' is-completed' : ''}`}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handleOpen()
          }
        }}
      >
        <div className="ticket-top">
          <input
            className="ticket-complete-checkbox"
            type="checkbox"
            checked={Boolean(ticket.completed)}
            onChange={(event) => {
              event.stopPropagation()
              onUpdate({ completed: event.target.checked })
            }}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Mark ${ticket.title} as ${ticket.completed ? 'incomplete' : 'complete'}`}
          />
          <strong className="ticket-title">{ticket.title}</strong>
          <button
            type="button"
            className="icon-button"
            aria-label={`Delete ticket ${ticket.title}`}
            title="Delete ticket"
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            ×
          </button>
        </div>
        {ticket.details ? <p className="ticket-details">{ticket.details}</p> : null}
      </div>

      {isEditing ? createPortal(
        <div
          className="ticket-modal-backdrop"
          role="presentation"
          draggable={false}
          onDragStart={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) handleCancel()
          }}
        >
          <form
            className="ticket-modal"
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            draggable={false}
            aria-labelledby={`ticket-modal-title-${ticket.id}`}
            onSubmit={handleSave}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="ticket-modal-header">
              <div className="ticket-modal-title-row">
                <input
                  className="ticket-complete-checkbox"
                  type="checkbox"
                  checked={completed}
                  onChange={(event) => setCompleted(event.target.checked)}
                  aria-label="Mark ticket as completed"
                />
                <h2
                  id={`ticket-modal-title-${ticket.id}`}
                  className={completed ? 'is-completed' : ''}
                >
                  {title || 'Untitled ticket'}
                </h2>
              </div>
              <button type="button" className="modal-close" onClick={handleCancel} aria-label="Close ticket editor">
                ×
              </button>
            </div>
            <div className="ticket-modal-layout">
              <div className="ticket-modal-main">
                <label className="ticket-title-field">
                  Title
                  <input
                    autoFocus
                    type="text"
                    maxLength={200}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </label>
                <div className="ticket-modal-tabs" role="tablist" aria-label="Ticket actions">
                  {[
                    ['add', '+'],
                    ['labels', '#'],
                    ['date', '□'],
                    ['checklist', '✓'],
                    ['attachment', '⌕'],
                  ].map(([tab, icon]) => (
                    <button
                      key={tab}
                      type="button"
                      className={activeTab === tab ? 'is-active' : ''}
                      onClick={() => setActiveTab(tab)}
                      role="tab"
                      aria-selected={activeTab === tab}
                    >
                      <span className="ticket-tab-icon" aria-hidden="true">{icon}</span>
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="ticket-tab-panel">
                  {activeTab === 'add' && <span>Add details and tools to this ticket.</span>}
                  {activeTab === 'labels' && <input type="text" placeholder="Add a label" />}
                  {activeTab === 'date' && <input type="date" aria-label="Ticket date" />}
                  {activeTab === 'checklist' && <input type="text" placeholder="Checklist item" />}
                  {activeTab === 'attachment' && <input type="file" aria-label="Attach a file" />}
                </div>
                <label className="ticket-description-field">
                  Description
                  <textarea
                    rows={7}
                    maxLength={10000}
                    value={details}
                    onChange={(event) => setDetails(event.target.value)}
                    placeholder="Add a more detailed description..."
                  />
                </label>
              </div>
              <aside className="ticket-comments">
                <h3>Comments</h3>
                <div className="ticket-comment-list">
                  {comments.length === 0 ? <p className="empty-comments">No comments yet.</p> : null}
                  {comments.map((item, index) => <p key={`${item.id || item.text}-${index}`}>{item.text || item}</p>)}
                </div>
                <form className="comment-form" onSubmit={addComment}>
                  <textarea
                    rows={5}
                    maxLength={5000}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Write a comment..."
                  />
                  <button type="submit">Add comment</button>
                </form>
              </aside>
            </div>
            <div className="ticket-actions">
              <button type="submit">Save changes</button>
              <button type="button" className="ghost" onClick={handleCancel}>Cancel</button>
              <button type="button" className="danger" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </form>
        </div>,
        document.body,
      ) : null}
    </>
  )
}
