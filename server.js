import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import sqlite3 from 'sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = process.env.PORT || 4000
const dataDir = path.join(__dirname, 'data')
const dbFile = path.join(dataDir, 'bugs.db')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('Unable to open database file:', err)
    process.exit(1)
  }
})

const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) return reject(error)
      resolve({ lastID: this.lastID, changes: this.changes })
    })
  })

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) return reject(error)
      resolve(row)
    })
  })

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) return reject(error)
      resolve(rows)
    })
  })

const randomId = () => `BUG-${Math.floor(1000 + Math.random() * 9000)}`

await run(`
  CREATE TABLE IF NOT EXISTS bugs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    reporter TEXT NOT NULL,
    assignee TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    component TEXT NOT NULL,
    description TEXT,
    created TEXT NOT NULL
  )
`)

const countRes = (await get('SELECT COUNT(1) AS count FROM bugs')) || { count: 0 }
if (countRes.count === 0) {
  const seed = [
    {
      id: 'BUG-1006',
      title: 'Login form crash on submit',
      reporter: 'Ayesha',
      assignee: 'Ravi',
      status: 'Open',
      priority: 'Critical',
      component: 'Auth',
      description: 'App crashes when password is empty and submit is clicked.',
      created: '2026-03-26',
    },
    {
      id: 'BUG-1007',
      title: 'Dashboard counts off by one',
      reporter: 'Karan',
      assignee: 'Meera',
      status: 'In Progress',
      priority: 'High',
      component: 'Analytics',
      description: 'UI shows wrong totals when filter is active.',
      created: '2026-03-24',
    },
    {
      id: 'BUG-1008',
      title: 'Notification badge not clearing',
      reporter: 'Sam',
      assignee: 'Isha',
      status: 'Resolved',
      priority: 'Medium',
      component: 'Notifications',
      description: 'Badge remains visible after reading all messages.',
      created: '2026-03-23',
    },
  ]

  for (const item of seed) {
    await run(
      `INSERT OR IGNORE INTO bugs (id, title, reporter, assignee, status, priority, component, description, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.title,
        item.reporter,
        item.assignee,
        item.status,
        item.priority,
        item.component,
        item.description,
        item.created,
      ]
    )
  }
}

app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

app.get('/api/bugs', async (req, res) => {
  try {
    const rows = await all('SELECT * FROM bugs ORDER BY created DESC, id DESC')
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Could not read bugs' })
  }
})

app.get('/api/bugs/:id', async (req, res) => {
  try {
    const bug = await get('SELECT * FROM bugs WHERE id = ?', [req.params.id])
    if (!bug) return res.status(404).json({ message: 'Bug not found' })
    res.json(bug)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Could not query bug' })
  }
})

app.post('/api/bugs', async (req, res) => {
  try {
    const {title, reporter, assignee, status = 'Open', priority = 'Medium', component, description = ''} = req.body

    if (!title || !reporter || !assignee || !component) {
      return res.status(400).json({ message: 'Title, reporter, assignee, and component are required' })
    }

    const payload = {
      id: randomId(),
      title,
      reporter,
      assignee,
      status,
      priority,
      component,
      description,
      created: new Date().toISOString().slice(0, 10),
    }

    await run(
      `INSERT INTO bugs (id, title, reporter, assignee, status, priority, component, description, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [payload.id, payload.title, payload.reporter, payload.assignee, payload.status, payload.priority, payload.component, payload.description, payload.created]
    )

    res.status(201).json(payload)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Could not create bug' })
  }
})

app.patch('/api/bugs/:id', async (req, res) => {
  try {
    const existing = await get('SELECT * FROM bugs WHERE id = ?', [req.params.id])
    if (!existing) return res.status(404).json({ message: 'Bug not found' })

    const updated = {
      ...existing,
      ...req.body,
    }

    await run(
      `UPDATE bugs SET title = ?, reporter = ?, assignee = ?, status = ?, priority = ?, component = ?, description = ? WHERE id = ?`,
      [updated.title, updated.reporter, updated.assignee, updated.status, updated.priority, updated.component, updated.description, req.params.id]
    )
    res.json(updated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Could not update bug' })
  }
})

app.delete('/api/bugs/:id', async (req, res) => {
  try {
    const existing = await get('SELECT * FROM bugs WHERE id = ?', [req.params.id])
    if (!existing) return res.status(404).json({ message: 'Bug not found' })

    await run('DELETE FROM bugs WHERE id = ?', [req.params.id])
    res.json({ message: 'Deleted' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Could not delete bug' })
  }
})

const distPath = path.join(__dirname, 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(port, () => {
  console.log(`Bug API server running on http://localhost:${port}`)
})
