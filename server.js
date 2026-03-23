const express = require('express')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')
const multer = require('multer')

const app = express()
const PORT = 8080

// ══════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════
const FLOAT_USER = 'float'
const FLOAT_PASS = 'float123'

// ══════════════════════════════════════════
// MIDDLEWARE
// ══════════════════════════════════════════
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json())

// Serve manifest and sw from root
app.use(express.static(__dirname))

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
const shell = (cmd) => new Promise((resolve, reject) => {
  exec(cmd, { timeout: 15000, cwd: process.env.HOME }, (err, stdout, stderr) => {
    if (err) reject(new Error(stderr || err.message))
    else resolve(stdout.trim())
  })
})

const formatBytes = (bytes) => {
  if (bytes < 1024)       return bytes + ' B'
  if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB'
  return (bytes / 1073741824).toFixed(1) + ' GB'
}

const safePath = (p) => {
  const resolved = path.resolve(p)
  const allowed = ['/sdcard', '/storage', process.env.HOME]
  return allowed.some(a => resolved.startsWith(a))
}

// ══════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════
app.post('/api/login', (req, res) => {
  const { username, password } = req.body
  if (username === FLOAT_USER && password === FLOAT_PASS) {
    res.json({ ok: true })
  } else {
    res.status(401).json({ error: 'Invalid credentials' })
  }
})

// ══════════════════════════════════════════
// SYSTEM
// ══════════════════════════════════════════
app.get('/api/battery', async (req, res) => {
  try { res.json(JSON.parse(await shell('termux-battery-status'))) }
  catch (e) { res.json({ error: e.message }) }
})

app.get('/api/wifi', async (req, res) => {
  try { res.json(JSON.parse(await shell('termux-wifi-connectioninfo'))) }
  catch (e) { res.json({ error: e.message }) }
})

app.get('/api/memory', async (req, res) => {
  try { res.send(await shell('free -h')) }
  catch (e) { res.status(500).send(e.message) }
})

app.get('/api/storage', async (req, res) => {
  try { res.send(await shell('df -h')) }
  catch (e) { res.status(500).send(e.message) }
})

app.get('/api/status', async (req, res) => {
  try {
    const [bat, wifi, mem] = await Promise.all([
      shell('termux-battery-status').then(JSON.parse).catch(() => ({})),
      shell('termux-wifi-connectioninfo').then(JSON.parse).catch(() => ({})),
      shell('free -h').catch(() => ''),
    ])
    const memLine = mem.split('\n').find(l => l.includes('Mem:')) || ''
    const mp = memLine.trim().split(/\s+/)
    res.json({
      battery: bat.percentage ?? null,
      charging: bat.status ?? null,
      ip: wifi.ip ?? null,
      ssid: wifi.ssid ?? null,
      memUsed: mp[2] ?? null,
      memTotal: mp[1] ?? null,
      uptime: process.uptime(),
      version: '1.1.0',
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ══════════════════════════════════════════
// SHELL — no auth (local network only)
// ══════════════════════════════════════════
app.get('/api/shell', async (req, res) => {
  const cmd = req.query.cmd
  if (!cmd) return res.status(400).json({ error: 'No command' })
  try {
    const out = await shell(cmd)
    res.json({ out, err: null })
  } catch (e) {
    res.json({ out: null, err: e.message })
  }
})

// ══════════════════════════════════════════
// FILES
// ══════════════════════════════════════════
app.get('/api/files', (req, res) => {
  const dirPath = req.query.path || '/sdcard'
  fs.readdir(dirPath, { withFileTypes: true }, (err, entries) => {
    if (err) return res.json({ error: err.message, items: [] })
    const items = entries
      .map(e => {
        let size = '', modified = ''
        try {
          const stat = fs.statSync(path.join(dirPath, e.name))
          size = e.isDirectory() ? '' : formatBytes(stat.size)
          modified = stat.mtime.toLocaleDateString()
        } catch {}
        return { name: e.name, isDir: e.isDirectory(), size, modified }
      })
      .sort((a, b) => {
        if (a.isDir && !b.isDir) return -1
        if (!a.isDir && b.isDir) return 1
        return a.name.localeCompare(b.name)
      })
    res.json({ items })
  })
})

// File read
app.get('/api/file', (req, res) => {
  const filePath = req.query.path
  if (!filePath || !safePath(filePath)) return res.status(403).send('Forbidden')
  const ext = path.extname(filePath).toLowerCase()
  const mimeMap = {
    '.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png',
    '.gif':'image/gif','.webp':'image/webp','.bmp':'image/bmp',
    '.mp4':'video/mp4','.webm':'video/webm','.mov':'video/quicktime',
    '.txt':'text/plain','.md':'text/plain','.json':'application/json',
    '.js':'text/javascript','.html':'text/html','.css':'text/css',
    '.sh':'text/plain','.py':'text/plain','.log':'text/plain',
  }
  const ct = mimeMap[ext] || 'application/octet-stream'
  fs.stat(filePath, (err, stat) => {
    if (err) return res.status(404).send('Not found')
    const range = req.headers.range
    if (range && ct.startsWith('video')) {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': (end - start) + 1,
        'Content-Type': ct,
      })
      fs.createReadStream(filePath, { start, end }).pipe(res)
    } else {
      res.setHeader('Content-Type', ct)
      res.setHeader('Content-Length', stat.size)
      fs.createReadStream(filePath).pipe(res)
    }
  })
})

// File write (text files)
app.post('/api/file', express.text({ limit: '10mb' }), (req, res) => {
  const filePath = req.query.path
  if (!filePath || !safePath(filePath)) return res.status(403).json({ error: 'Forbidden' })
  fs.writeFile(filePath, req.body, 'utf8', (err) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ ok: true })
  })
})

// File download
app.get('/api/download', (req, res) => {
  const filePath = req.query.path
  if (!filePath || !safePath(filePath)) return res.status(403).send('Forbidden')
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found')
  res.download(filePath)
})

// File rename
app.post('/api/rename', (req, res) => {
  const { oldPath, newName } = req.body
  if (!oldPath || !newName) return res.status(400).json({ error: 'Missing params' })
  if (!safePath(oldPath)) return res.status(403).json({ error: 'Forbidden' })
  const newPath = path.join(path.dirname(oldPath), newName)
  fs.rename(oldPath, newPath, (err) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ ok: true })
  })
})

// File delete
app.delete('/api/file', (req, res) => {
  const filePath = req.query.path
  if (!filePath || !safePath(filePath)) return res.status(403).json({ error: 'Forbidden' })
  fs.stat(filePath, (err, stat) => {
    if (err) return res.status(404).json({ error: 'Not found' })
    if (stat.isDirectory()) {
      fs.rmdir(filePath, { recursive: true }, e => {
        if (e) return res.status(500).json({ error: e.message })
        res.json({ ok: true })
      })
    } else {
      fs.unlink(filePath, e => {
        if (e) return res.status(500).json({ error: e.message })
        res.json({ ok: true })
      })
    }
  })
})

// File upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = req.query.path || '/sdcard'
    cb(null, dest)
  },
  filename: (req, file, cb) => cb(null, file.originalname)
})
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } })

app.post('/api/upload', upload.array('files'), (req, res) => {
  res.json({ ok: true, count: req.files.length })
})

// ══════════════════════════════════════════
// START
// ══════════════════════════════════════════
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n ███████╗██╗      ██████╗  █████╗ ████████╗')
  console.log(' ██╔════╝██║     ██╔═══██╗██╔══██╗╚══██╔══╝')
  console.log(' █████╗  ██║     ██║   ██║███████║   ██║   ')
  console.log(' ██╔══╝  ██║     ██║   ██║██╔══██║   ██║   ')
  console.log(' ██║     ███████╗╚██████╔╝██║  ██║   ██║   ')
  console.log(' ╚═╝     ╚══════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ')
  console.log(`\n  v1.1.0 — port ${PORT}`)
  exec('termux-wifi-connectioninfo', (err, stdout) => {
    try {
      const w = JSON.parse(stdout)
      console.log(`  http://${w.ip}:${PORT}`)
      console.log(`  user: ${FLOAT_USER} / pass: ${FLOAT_PASS}\n`)
    } catch { console.log('  run ifconfig for IP\n') }
  })
})
