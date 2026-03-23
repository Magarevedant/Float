// ══════════════════════════════════════════
// FLOAT — files.js
// ══════════════════════════════════════════
let currentPath  = Store.get('lastPath', '/sdcard')
let ctxTarget    = null   // { path, name, isDir }
let renameTarget = null

const fileIcons = {
  mp3:'🎵', wav:'🎵', flac:'🎵', ogg:'🎵', aac:'🎵',
  mp4:'🎬', mkv:'🎬', avi:'🎬', webm:'🎬', mov:'🎬',
  jpg:'🖼️', jpeg:'🖼️', png:'🖼️', gif:'🖼️', webp:'🖼️', bmp:'🖼️',
  pdf:'📄', doc:'📝', docx:'📝', txt:'📄', md:'📄', log:'📄',
  zip:'🗜️', rar:'🗜️', tar:'🗜️', gz:'🗜️',
  apk:'📦', json:'📋', js:'📋', html:'🌐', css:'🎨',
  sh:'⚡', py:'🐍', xml:'📋',
}
const getIcon = name => fileIcons[name.split('.').pop().toLowerCase()] || '📄'
const textExts = new Set(['txt','md','json','js','html','css','sh','py','log','xml','csv','ts','jsx'])
const isText   = name => textExts.has(name.split('.').pop().toLowerCase())
const isImage  = name => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name)
const isVideo  = name => /\.(mp4|webm|mov|mkv|avi)$/i.test(name)

// ── PATH CRUMBS ──
function buildCrumbs(p) {
  const bar = document.getElementById('files-pathbar')
  bar.innerHTML = ''
  const add = (label, path) => {
    const s = document.createElement('span')
    s.className = 'path-crumb'
    s.textContent = label
    s.onclick = () => loadFiles(path)
    bar.appendChild(s)
  }
  const sep = () => {
    const s = document.createElement('span')
    s.className = 'path-sep'; s.textContent = ' / '; bar.appendChild(s)
  }
  add('~', '/sdcard')
  let built = ''
  const parts = p.split('/').filter(Boolean)
  parts.forEach((part, i) => {
    built += '/' + part; sep()
    const s = document.createElement('span')
    s.className = 'path-crumb' + (i === parts.length - 1 ? ' active' : '')
    s.textContent = part
    const cap = built
    s.onclick = () => loadFiles(cap)
    bar.appendChild(s)
  })
}

// ── LOAD DIRECTORY ──
async function loadFiles(p) {
  currentPath = p
  Store.set('lastPath', p)
  buildCrumbs(p)

  const loading = document.getElementById('files-loading')
  const grid    = document.getElementById('file-grid')
  loading.style.display = 'block'
  loading.textContent   = 'Loading...'
  grid.style.display    = 'none'

  try {
    const r = await fetch('/api/files?path=' + encodeURIComponent(p))
    const { items, error } = await r.json()

    if (error) { loading.textContent = 'Error: ' + error; return }

    grid.innerHTML = ''

    // Back button
    if (p !== '/sdcard' && p !== '/') {
      const back = makeFileItem('⬆️', '..', '', true)
      back.onclick = () => loadFiles(p.split('/').slice(0, -1).join('/') || '/')
      grid.appendChild(back)
    }

    items.forEach(item => {
      const icon = item.isDir ? '📁' : getIcon(item.name)
      const el = makeFileItem(icon, item.name, item.size, item.isDir)
      const fullPath = p + '/' + item.name

      el.addEventListener('click', () => {
        if (item.isDir) loadFiles(fullPath)
        else openFile(fullPath, item.name)
      })

      el.addEventListener('contextmenu', e => {
        e.preventDefault(); e.stopPropagation()
        ctxTarget = { path: fullPath, name: item.name, isDir: item.isDir }
        showFileCtx(e.clientX, e.clientY, item.isDir)
      })

      grid.appendChild(el)
    })

    loading.style.display = 'none'
    grid.style.display = 'grid'
  } catch {
    loading.textContent = 'Failed to load.'
  }
}

function makeFileItem(icon, name, size, isDir) {
  const el = document.createElement('div')
  el.className = 'fi'
  el.innerHTML = `<span class="fi-icon">${icon}</span>
    <span class="fi-name">${name.replace(/</g,'&lt;')}</span>
    ${size ? `<span class="fi-size">${size}</span>` : ''}`
  return el
}

// ── FILE CONTEXT MENU ──
function showFileCtx(x, y, isDir) {
  const m = document.getElementById('file-ctx')
  document.getElementById('fctx-open').style.display     = isDir ? 'none' : 'flex'
  document.getElementById('fctx-download').style.display = isDir ? 'none' : 'flex'
  const mx = Math.min(x, window.innerWidth - 175)
  const my = Math.min(y, window.innerHeight - 200)
  m.style.left = mx + 'px'
  m.style.top  = my + 'px'
  m.classList.add('visible')
}

document.getElementById('fctx-open').onclick = () => {
  hideFileCtx()
  if (ctxTarget) openFile(ctxTarget.path, ctxTarget.name)
}
document.getElementById('fctx-download').onclick = () => {
  hideFileCtx()
  if (ctxTarget) downloadFile(ctxTarget.path, ctxTarget.name)
}
document.getElementById('fctx-rename').onclick = () => {
  hideFileCtx()
  if (ctxTarget) openRename(ctxTarget.path, ctxTarget.name)
}
document.getElementById('fctx-copypath').onclick = () => {
  hideFileCtx()
  if (ctxTarget) {
    navigator.clipboard.writeText(ctxTarget.path).then(() => toast('Path copied'))
  }
}
document.getElementById('fctx-delete').onclick = async () => {
  hideFileCtx()
  if (!ctxTarget) return
  if (!confirm(`Delete "${ctxTarget.name}"?`)) return
  try {
    const r = await fetch('/api/file?path=' + encodeURIComponent(ctxTarget.path), { method:'DELETE' })
    const j = await r.json()
    if (j.ok) { toast('Deleted: ' + ctxTarget.name); loadFiles(currentPath) }
    else toast('Error: ' + j.error)
  } catch { toast('Delete failed') }
}

// ── DOWNLOAD ──
function downloadFile(path, name) {
  const a = document.createElement('a')
  a.href = '/api/download?path=' + encodeURIComponent(path)
  a.download = name
  a.click()
  toast('Downloading: ' + name)
}

// ── RENAME ──
function openRename(path, name) {
  renameTarget = { path, name }
  const input = document.getElementById('rename-input')
  input.value = name
  document.getElementById('rename-modal').classList.add('visible')
  setTimeout(() => { input.focus(); input.select() }, 150)
}

document.getElementById('rename-cancel').onclick = () => {
  document.getElementById('rename-modal').classList.remove('visible')
  renameTarget = null
}
document.getElementById('rename-confirm').onclick = doRename
document.getElementById('rename-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') doRename()
  if (e.key === 'Escape') document.getElementById('rename-cancel').click()
})

async function doRename() {
  if (!renameTarget) return
  const newName = document.getElementById('rename-input').value.trim()
  if (!newName || newName === renameTarget.name) {
    document.getElementById('rename-modal').classList.remove('visible')
    return
  }
  try {
    const r = await fetch('/api/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPath: renameTarget.path, newName }),
    })
    const j = await r.json()
    if (j.ok) { toast('Renamed to: ' + newName); loadFiles(currentPath) }
    else toast('Error: ' + j.error)
  } catch { toast('Rename failed') }
  document.getElementById('rename-modal').classList.remove('visible')
  renameTarget = null
}

// ── FILE VIEWER / EDITOR ──
let viewerMode  = 'view'
let viewerPath  = null

function openFile(path, name) {
  viewerPath = path
  viewerMode = 'view'
  const fv     = document.getElementById('file-viewer')
  const body   = document.getElementById('fv-body')
  const actions = document.getElementById('fv-actions')
  document.getElementById('fv-title').textContent = name
  body.innerHTML  = ''
  actions.innerHTML = ''

  if (isImage(name)) {
    const img = document.createElement('img')
    img.src = '/api/file?path=' + encodeURIComponent(path)
    body.appendChild(img)
    addViewerBtn(actions, 'Download', downloadIcon(), () => downloadFile(path, name))
  } else if (isVideo(name)) {
    const vid = document.createElement('video')
    vid.src = '/api/file?path=' + encodeURIComponent(path)
    vid.controls = true; vid.style.width = '100%'
    body.appendChild(vid)
  } else if (isText(name)) {
    fetch('/api/file?path=' + encodeURIComponent(path))
      .then(r => r.text())
      .then(t => {
        const pre = document.createElement('pre')
        pre.textContent = t
        body.appendChild(pre)
        addViewerBtn(actions, 'Edit', editIcon(), () => enterEditMode(path, name, t), 'primary')
        addViewerBtn(actions, 'Download', downloadIcon(), () => downloadFile(path, name))
      })
  } else {
    body.innerHTML = `<div style="color:var(--text-dim);font-size:12px;font-family:'JetBrains Mono',monospace;text-align:center">Cannot preview<br><br>${name}</div>`
    addViewerBtn(actions, 'Download', downloadIcon(), () => downloadFile(path, name))
  }

  fv.classList.add('visible')
}

function enterEditMode(path, name, content) {
  const body    = document.getElementById('fv-body')
  const actions = document.getElementById('fv-actions')
  viewerMode = 'edit'
  body.innerHTML = ''
  actions.innerHTML = ''
  const ta = document.createElement('textarea')
  ta.className = 'fv-editor'
  ta.value = content
  body.style.padding = '0'
  body.appendChild(ta)
  ta.focus()
  addViewerBtn(actions, 'Save', saveIcon(), () => saveFile(path, name, ta.value), 'primary')
  addViewerBtn(actions, 'Cancel', cancelIcon(), () => openFile(path, name))
}

async function saveFile(path, name, content) {
  try {
    const r = await fetch('/api/file?path=' + encodeURIComponent(path), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: content,
    })
    const j = await r.json()
    if (j.ok) { toast('Saved: ' + name); openFile(path, name) }
    else toast('Save error: ' + j.error)
  } catch { toast('Save failed') }
}

function addViewerBtn(container, label, svgStr, onClick, cls = '') {
  const btn = document.createElement('button')
  btn.className = 'fv-btn' + (cls ? ' ' + cls : '')
  btn.innerHTML = svgStr + label
  btn.onclick = onClick
  container.appendChild(btn)
}

const svgBtn = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">${d}</svg>`
const downloadIcon = () => svgBtn('<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>')
const editIcon     = () => svgBtn('<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>')
const saveIcon     = () => svgBtn('<path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>')
const cancelIcon   = () => svgBtn('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>')

document.getElementById('fv-close').onclick = () => {
  document.getElementById('file-viewer').classList.remove('visible')
  document.getElementById('fv-body').style.padding = ''
  viewerPath = null
}

// ── UPLOAD ──
const fileInput   = document.getElementById('file-input')
const dropOverlay = document.getElementById('drop-overlay')
const filesBody   = document.getElementById('files-body')

document.getElementById('upload-btn').onclick = () => fileInput.click()

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) uploadFiles(Array.from(fileInput.files))
  fileInput.value = ''
})

filesBody.addEventListener('dragover', e => { e.preventDefault(); dropOverlay.classList.add('active') })
filesBody.addEventListener('dragleave', e => { if (!filesBody.contains(e.relatedTarget)) dropOverlay.classList.remove('active') })
filesBody.addEventListener('drop', e => {
  e.preventDefault()
  dropOverlay.classList.remove('active')
  const files = Array.from(e.dataTransfer.files)
  if (files.length) uploadFiles(files)
})

async function uploadFiles(files) {
  const fd = new FormData()
  files.forEach(f => fd.append('files', f))
  toast(`Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`)
  try {
    const r = await fetch('/api/upload?path=' + encodeURIComponent(currentPath), {
      method: 'POST', body: fd,
    })
    const j = await r.json()
    if (j.ok) { toast(`Uploaded ${j.count} file${j.count > 1 ? 's' : ''}`); loadFiles(currentPath) }
    else toast('Upload failed')
  } catch { toast('Upload error') }
}

// ── TITLEBAR BUTTONS ──
document.getElementById('files-close').addEventListener('click', closeApp)
document.getElementById('files-refresh').addEventListener('click', () => loadFiles(currentPath))
