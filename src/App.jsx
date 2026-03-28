import { useEffect, useMemo, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

const statusOptions = ['Open', 'In Progress', 'Resolved', 'Closed', 'Done']

const statusClasses = {
  Open: 'bg-rose-100 text-rose-800',
  'In Progress': 'bg-amber-100 text-amber-800',
  Resolved: 'bg-emerald-100 text-emerald-800',
  Closed: 'bg-slate-100 text-slate-500',
  Done: 'bg-emerald-100 text-emerald-900',
}

const priorityClasses = {
  Critical: 'bg-red-100 text-red-800',
  High: 'bg-orange-100 text-orange-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Low: 'bg-emerald-100 text-emerald-800',
}

function App() {
  const [bugs, setBugs] = useState([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [isCreating, setIsCreating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState('')
  const [newBug, setNewBug] = useState({
    title: '',
    reporter: '',
    assignee: '',
    status: 'Open',
    priority: 'Medium',
    component: '',
    description: '',
  })

  const fetchBugs = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/bugs`)
      if (!response.ok) throw new Error('Failed to fetch bugs')
      const data = await response.json()
      setBugs(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBugs()
  }, [])

  const addBug = async (event) => {
    event.preventDefault()
    setError(null)
    setSuccess('')

    if (!newBug.title || !newBug.reporter || !newBug.assignee || !newBug.component) {
      setError('Please complete required fields')
      return
    }

    const payload = {
      ...newBug,
      created: new Date().toISOString().slice(0, 10),
    }

    try {
      const response = await fetch(`${API_URL}/bugs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message || 'Could not create bug')
      }

      const created = await response.json()
      setBugs((prev) => [created, ...prev])
      setSuccess('Bug created successfully.')
    } catch (err) {
      // fallback local create when server is down
      const fallback = {
        ...payload,
        id: `LOCAL-${Math.floor(1000 + Math.random() * 9000)}`,
        status: payload.status || 'Open',
        priority: payload.priority || 'Medium',
      }
      setBugs((prev) => [fallback, ...prev])
      setSuccess('Bug saved locally (server unavailable).')
      setError(`Server unavailable, offline mode: ${err.message}`)
    } finally {
      setNewBug({
        title: '',
        reporter: '',
        assignee: '',
        status: 'Open',
        priority: 'Medium',
        component: '',
        description: '',
      })
      setIsCreating(false)
    }
  }

  const setBugStatus = async (bugId, nextStatus) => {
    try {
      const response = await fetch(`${API_URL}/bugs/${bugId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!response.ok) throw new Error('Failed to update status')
      const updated = await response.json()
      setBugs((prev) => prev.map((bug) => (bug.id === bugId ? updated : bug)))
    } catch (err) {
      setError(err.message)
    }
  }

  const stats = useMemo(() => {
    const totals = {
      Open: 0,
      'In Progress': 0,
      Resolved: 0,
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0,
      Done: 0,
    }

    for (const bug of bugs) {
      if (totals[bug.status] !== undefined) totals[bug.status]++
      if (totals[bug.priority] !== undefined) totals[bug.priority]++
    }
    return totals
  }, [bugs])

  const visible = useMemo(() => {
    const lowerq = query.trim().toLowerCase()
    return bugs.filter((bug) => {
      const matchesText =
        lowerq === '' ||
        [bug.id, bug.title, bug.reporter, bug.assignee, bug.component]
          .join(' ')
          .toLowerCase()
          .includes(lowerq)
      const matchesStatus = statusFilter === 'All' || bug.status === statusFilter
      const matchesPriority =
        priorityFilter === 'All' || bug.priority === priorityFilter
      return matchesText && matchesStatus && matchesPriority
    })
  }, [bugs, query, statusFilter, priorityFilter])

  const updateField = (field, value) =>
    setNewBug((prev) => ({ ...prev, [field]: value }))

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Bug Reporter Dashboard</h1>
            <p className="text-slate-600">Monitor issue state, assign work, and ship with confidence.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-500"
          >
            + New Bug Report
          </button>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{success}</div>
        )}

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard title="Open" count={stats.Open} tone="text-rose-700" />
          <SummaryCard title="In Progress" count={stats['In Progress']} tone="text-amber-700" />
          <SummaryCard title="Resolved" count={stats.Resolved} tone="text-emerald-700" />
          <SummaryCard title="Done" count={stats.Done} tone="text-indigo-700" />
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr,0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <input
                aria-label="Search bugs"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 md:w-60"
                placeholder="Search by id/title/reporter/component"
              />
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option>All</option>
                {statusOptions.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
              <select
                aria-label="Filter by priority"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option>All</option>
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
              <button
                type="button"
                onClick={fetchBugs}
                className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
              >
                Refresh
              </button>
            </div>

            {isLoading ? (
              <p className="p-8 text-center text-slate-500">Loading bugs…</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">Title</th>
                      <th className="px-3 py-2">Assignee</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Priority</th>
                      <th className="px-3 py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-3 py-6 text-center text-slate-500">
                          No bugs match the filters.
                        </td>
                      </tr>
                    ) : (
                      visible.map((bug) => (
                        <tr key={bug.id} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-3 font-medium text-slate-600">{bug.id}</td>
                          <td className="px-3 py-3 text-slate-700">{bug.title}</td>
                          <td className="px-3 py-3 text-slate-700">{bug.assignee}</td>
                          <td className="px-3 py-3">
                            <select
                              aria-label={`Change status for ${bug.id}`}
                              value={bug.status}
                              onChange={(e) => setBugStatus(bug.id, e.target.value)}
                              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            >
                              {statusOptions.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${priorityClasses[bug.priority] ?? 'bg-slate-100 text-slate-700'}`}>
                              {bug.priority}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-slate-600">{bug.created}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="mb-3 text-lg font-semibold">Quick Insights</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <dt>Open bugs</dt>
                <dd className="font-medium">{stats.Open}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <dt>In progress</dt>
                <dd className="font-medium">{stats['In Progress']}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <dt>Resolved</dt>
                <dd className="font-medium">{stats.Resolved}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <dt>Done</dt>
                <dd className="font-medium">{stats.Done}</dd>
              </div>
            </dl>
          </aside>
        </section>
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={addBug}
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Create New Bug report</h2>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                required
                value={newBug.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Bug title"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              <input
                required
                value={newBug.reporter}
                onChange={(e) => updateField('reporter', e.target.value)}
                placeholder="Reporter"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              <input
                required
                value={newBug.assignee}
                onChange={(e) => updateField('assignee', e.target.value)}
                placeholder="Assignee"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              <input
                required
                value={newBug.component}
                onChange={(e) => updateField('component', e.target.value)}
                placeholder="Component"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
              <select
                value={newBug.status}
                onChange={(e) => updateField('status', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              >
                {statusOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select
                value={newBug.priority}
                onChange={(e) => updateField('priority', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              >
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
            <textarea
              value={newBug.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Description and steps to reproduce"
              rows={3}
              className="mt-3 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ title, count, tone }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
      <p className="text-xs uppercase tracking-wider text-slate-500">{title}</p>
      <p className={`mt-2 text-3xl font-bold ${tone}`}>{count}</p>
    </article>
  )
}

export default App
