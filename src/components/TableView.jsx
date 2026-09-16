import './TableView.css'

export default function TableView({ columns }) {
  const tickets = columns.flatMap((column) => column.tickets.map((ticket) => ({
    ...ticket,
    columnTitle: column.title,
  })))

  return (
    <div className="table-view">
      <div className="table-view-heading">
        <div>
          <p className="table-view-eyebrow">Overview</p>
          <h3>All tickets</h3>
        </div>
        <span className="table-view-count">{tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Task</th>
              <th scope="col">Column</th>
              <th scope="col">Status</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr>
                <td colSpan="4" className="table-empty">No tickets on this board yet.</td>
              </tr>
            ) : tickets.map((ticket) => (
              <tr key={ticket.id}>
                <th scope="row">{ticket.title}</th>
                <td><span className="table-column-pill">{ticket.columnTitle}</span></td>
                <td>
                  <span className={`table-status${ticket.completed ? ' is-complete' : ''}`}>
                    {ticket.completed ? 'Complete' : 'Open'}
                  </span>
                </td>
                <td className="table-details">{ticket.details || 'No details added'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
