// ══════════════════════════════════════════
// FLOAT — boot.js
// ══════════════════════════════════════════
const bootSteps = [
  { pct: 10,  msg: 'loading kernel modules...' },
  { pct: 24,  msg: 'mounting file system...' },
  { pct: 40,  msg: 'starting network bridge...' },
  { pct: 56,  msg: 'initializing termux api...' },
  { pct: 72,  msg: 'loading float shell...' },
  { pct: 88,  msg: 'preparing desktop...' },
  { pct: 100, msg: 'ready.' },
]

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function runBoot() {
  const fill   = document.getElementById('boot-fill')
  const status = document.getElementById('boot-status')

  for (const step of bootSteps) {
    fill.style.width = step.pct + '%'
    status.textContent = step.msg
    await sleep(300 + Math.random() * 280)
  }

  await sleep(360)
  document.getElementById('boot-screen').classList.add('out')
  await sleep(750)
  document.getElementById('boot-screen').style.display = 'none'

  // Check saved session
  if (sessionStorage.getItem('float_authed')) {
    showDesktop()
  } else {
    showLogin()
  }
}

window.addEventListener('load', runBoot)
