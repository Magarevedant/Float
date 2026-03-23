// ══════════════════════════════════════════
// FLOAT — app.js  (core utilities & state)
// ══════════════════════════════════════════

// ── PERSISTENCE ──
const Store = {
  get: (k, def = null) => {
    try { const v = localStorage.getItem('float:' + k); return v !== null ? JSON.parse(v) : def } catch { return def }
  },
  set: (k, v) => { try { localStorage.setItem('float:' + k, JSON.stringify(v)) } catch {} },
}

// ── TOAST ──
function toast(msg, dur = 2500) {
  const wrap = document.getElementById('toast-wrap')
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = msg
  wrap.appendChild(el)
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')))
  setTimeout(() => {
    el.classList.remove('show')
    setTimeout(() => el.remove(), 280)
  }, dur)
}

// ── CLOCK ──
function startClock() {
  const tick = () => {
    const n = new Date()
    document.getElementById('dc-time').textContent = n.toLocaleTimeString('en-US', { hour12: false })
    document.getElementById('dc-date').textContent = n.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })
  }
  tick()
  setInterval(tick, 1000)
}

// ── APP SWITCHING ──
let currentApp = 'terminal'

function switchApp(name) {
  hideCtxMenu()
  hideFileCtx()
  document.querySelectorAll('.app-win').forEach(w => w.classList.remove('active'))
  document.querySelectorAll('.dock-btn').forEach(b => b.classList.remove('dock-active'))
  document.getElementById('app-' + name).classList.add('active')
  document.getElementById('dock-' + name).classList.add('dock-active')
  currentApp = name
  Store.set('lastApp', name)
  if (name === 'terminal') setTimeout(() => document.getElementById('cmd-input').focus(), 340)
  if (name === 'files')    window.loadFiles && loadFiles(currentPath || '/sdcard')
  if (name === 'settings') window.loadSettings && loadSettings()
}

function closeApp() {
  document.querySelectorAll('.app-win').forEach(w => w.classList.remove('active'))
  document.querySelectorAll('.dock-btn').forEach(b => b.classList.remove('dock-active'))
  currentApp = null
}

// ── DESKTOP CONTEXT MENU ──
document.addEventListener('contextmenu', e => {
  if (e.target.closest('.app-win') || e.target.closest('#dock') ||
      e.target.closest('#ctx-menu') || e.target.closest('#file-ctx') ||
      e.target.closest('#login-screen') || e.target.closest('#boot-screen') ||
      e.target.closest('#file-viewer') || e.target.closest('#rename-modal')) {
    e.preventDefault(); return
  }
  e.preventDefault()
  const m = document.getElementById('ctx-menu')
  const x = Math.min(e.clientX, window.innerWidth - 190)
  const y = Math.min(e.clientY, window.innerHeight - 210)
  m.style.left = x + 'px'
  m.style.top  = y + 'px'
  m.classList.add('visible')
})

document.addEventListener('click', () => { hideCtxMenu(); hideFileCtx() })

function hideCtxMenu() { document.getElementById('ctx-menu').classList.remove('visible') }
function hideFileCtx() { document.getElementById('file-ctx').classList.remove('visible') }

// context menu actions
document.getElementById('ctx-wallpaper').onclick = () => {
  hideCtxMenu(); switchApp('settings')
  setTimeout(() => document.getElementById('settings-body').scrollTo({ top:9999, behavior:'smooth' }), 380)
}
document.getElementById('ctx-settings').onclick  = () => { hideCtxMenu(); switchApp('settings') }
document.getElementById('ctx-terminal').onclick  = () => { hideCtxMenu(); switchApp('terminal') }
document.getElementById('ctx-files').onclick     = () => { hideCtxMenu(); switchApp('files') }
document.getElementById('ctx-lock').onclick      = () => { hideCtxMenu(); window.lockScreen && lockScreen() }

// ── KEYBOARD SHORTCUTS ──
document.addEventListener('keydown', e => {
  if (!document.getElementById('desktop').classList.contains('visible')) return
  if (e.ctrlKey) {
    if (e.key === '1') { e.preventDefault(); switchApp('terminal') }
    if (e.key === '2') { e.preventDefault(); switchApp('files') }
    if (e.key === '3') { e.preventDefault(); switchApp('settings') }
    if (e.key === 'l') { e.preventDefault(); window.lockScreen && lockScreen() }
    if (e.key === 'k') { e.preventDefault(); window.clearTerm && clearTerm() }
  }
})

// ── WALLPAPER ──
const wallpapers = [
  { label:'Nebula',  bg:'radial-gradient(ellipse 70% 55% at 15% 25%,rgba(60,20,130,.75) 0%,transparent 65%),radial-gradient(ellipse 55% 70% at 85% 75%,rgba(8,55,110,.65) 0%,transparent 65%),#05050f' },
  { label:'Aurora',  bg:'radial-gradient(ellipse 80% 60% at 20% 80%,rgba(0,100,80,.7) 0%,transparent 60%),radial-gradient(ellipse 60% 80% at 80% 20%,rgba(0,50,120,.6) 0%,transparent 60%),#030a0a' },
  { label:'Ember',   bg:'radial-gradient(ellipse 70% 60% at 25% 30%,rgba(120,30,0,.8) 0%,transparent 65%),radial-gradient(ellipse 50% 70% at 80% 80%,rgba(80,10,60,.6) 0%,transparent 60%),#0a0305' },
  { label:'Ocean',   bg:'radial-gradient(ellipse 80% 55% at 50% 0%,rgba(0,60,130,.8) 0%,transparent 65%),radial-gradient(ellipse 60% 70% at 30% 100%,rgba(0,80,100,.5) 0%,transparent 60%),#020810' },
  { label:'Void',    bg:'radial-gradient(ellipse 60% 60% at 50% 50%,rgba(20,20,40,.5) 0%,transparent 80%),#000000' },
]

function applyWallpaper(bg, save = true) {
  document.getElementById('wallpaper').style.background = bg
  if (save) Store.set('wallpaper', bg)
}

function initWallpaperPicker() {
  const grid = document.getElementById('wp-grid')
  const saved = Store.get('wallpaper')
  wallpapers.forEach((wp, i) => {
    const el = document.createElement('div')
    el.className = 'wp-swatch' + ((!saved && i === 0) || saved === wp.bg ? ' selected' : '')
    el.style.background = wp.bg
    el.title = wp.label
    el.onclick = () => {
      document.querySelectorAll('.wp-swatch').forEach(s => s.classList.remove('selected'))
      el.classList.add('selected')
      applyWallpaper(wp.bg)
      toast('Wallpaper: ' + wp.label)
    }
    grid.appendChild(el)
  })

  document.getElementById('wp-apply-btn').onclick = () => {
    const url = document.getElementById('wp-url').value.trim()
    if (!url) return
    applyWallpaper(`url('${url}') center/cover no-repeat`)
    document.querySelectorAll('.wp-swatch').forEach(s => s.classList.remove('selected'))
    toast('Custom wallpaper applied')
  }

  // Restore saved wallpaper
  if (saved) applyWallpaper(saved, false)
}

// ── PWA SERVICE WORKER ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// ── SHOW DESKTOP (called from login.js) ──
function showDesktop() {
  const d = document.getElementById('desktop')
  d.classList.add('visible')
  startClock()
  initWallpaperPicker()
  // Restore last open app
  const last = Store.get('lastApp', 'terminal')
  switchApp(last)
  // Signal other modules
  setTimeout(() => document.dispatchEvent(new Event('floatReady')), 500)
}
