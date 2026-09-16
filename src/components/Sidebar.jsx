import './Sidebar.css'

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <h2 className="sidebar-title">Inbox</h2>
      <p className="sidebar-hint">Incoming items and notes will appear here.</p>
      <ul className="sidebar-list">
        <li>Welcome to your schedule board</li>
        <li>Add columns on the right</li>
        <li>Add tickets inside each column</li>
      </ul>
    </aside>
  )
}
