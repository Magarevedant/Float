// ══════════════════════════════════════════
// FLOAT — terminal.js
// ══════════════════════════════════════════
const termBody  = document.getElementById('term-body')
const cmdInput  = document.getElementById('cmd-input')
let cmdHistory  = Store.get('termHistory', [])
let histIdx     = -1

// ── helpers ──
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')

function termLine(html) {
  const d = document.createElement('div')
  d.innerHTML = html
  termBody.appendChild(d)
  termBody.scrollTop = termBody.scrollHeight
}

function termOut(text, cls = 'tl-out') {
  const d = document.createElement('div')
  d.className = cls
  d.textContent = text
  termBody.appendChild(d)
  termBody.scrollTop = termBody.scrollHeight
}

function termPrompt(cmd) {
  termLine(`<div class="tl">
    <span class="tl-prompt">~</span>
    <span class="tl-path">$</span>
    <span class="tl-cmd">${esc(cmd)}</span>
  </div>`)
}

function clearTerm() {
  termBody.innerHTML = ''
  toast('Terminal cleared')
}

// ── boot message ──
function termWelcome() {
  termOut('Float v1.1.0 — Termux Shell', 'tl-info')
  termOut('Ctrl+1/2/3 switch apps  •  Ctrl+K clear  •  Ctrl+L lock', 'tl-out')
  termOut('─'.repeat(48), 'tl-out')
}

// ── client shortcuts ──
const clientCmds = {
  clear:    () => { clearTerm(); return null },
  lock:     () => { lockScreen(); return null },
  files:    () => { switchApp('files'); return null },
  settings: () => { switchApp('settings'); return null },
  help:     () => 'Client shortcuts:\n  clear / lock / files / settings\nAll other commands run on the tablet.',
}

// ── input handler ──
cmdInput.addEventListener('keydown', async e => {
  if (e.key === 'ArrowUp') {
    if (histIdx < cmdHistory.length - 1) histIdx++
    cmdInput.value = cmdHistory[histIdx] || ''
    e.preventDefault(); return
  }
  if (e.key === 'ArrowDown') {
    if (histIdx > 0) histIdx--
    else { histIdx = -1; cmdInput.value = ''; return }
    cmdInput.value = cmdHistory[histIdx] || ''
    e.preventDefault(); return
  }
  if (e.key !== 'Enter') return

  const raw = cmdInput.value.trim()
  cmdInput.value = ''
  if (!raw) return

  // save history
  cmdHistory.unshift(raw)
  if (cmdHistory.length > 80) cmdHistory.pop()
  histIdx = -1
  Store.set('termHistory', cmdHistory.slice(0, 80))

  termPrompt(raw)

  const base = raw.split(/\s+/)[0].toLowerCase()

  // client-side shortcut?
  if (clientCmds[base]) {
    const result = clientCmds[base]()
    if (result) termOut(result)
    return
  }

  // send to server shell
  try {
    const r = await fetch('/api/shell?cmd=' + encodeURIComponent(raw))
    if (!r.ok) { termOut('server error: ' + r.status, 'tl-err'); return }
    const j = await r.json()
    if (j.out) termOut(j.out)
    if (j.err) termOut(j.err, 'tl-err')
    if (!j.out && !j.err) termOut('(no output)')
  } catch {
    termOut('server unreachable', 'tl-err')
  }
})

// ── titlebar buttons ──
document.getElementById('term-close').addEventListener('click', closeApp)
document.getElementById('term-clear').addEventListener('click', clearTerm)

// ── welcome on desktop ready ──
document.addEventListener('floatReady', termWelcome)
