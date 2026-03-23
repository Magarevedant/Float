// ══════════════════════════════════════════
// FLOAT — login.js
// ══════════════════════════════════════════

function showLogin() {
  const ls = document.getElementById('login-screen')
  ls.classList.remove('out')
  ls.classList.add('visible')
  setTimeout(() => document.getElementById('login-user').focus(), 320)
}

async function attemptLogin() {
  const u   = document.getElementById('login-user').value.trim()
  const p   = document.getElementById('login-pass').value
  const err = document.getElementById('login-error')

  if (!u || !p) { err.textContent = 'enter username and password'; return }

  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    })

    if (r.ok) {
      sessionStorage.setItem('float_authed', '1')
      err.textContent = ''
      const ls = document.getElementById('login-screen')
      ls.classList.add('out')
      setTimeout(showDesktop, 480)
    } else {
      err.textContent = 'invalid credentials'
      document.getElementById('login-pass').value = ''
      shakeCard()
    }
  } catch {
    err.textContent = 'server unreachable'
    shakeCard()
  }
}

function shakeCard() {
  const card = document.querySelector('.login-card')
  card.style.transition = 'transform 0.08s ease'
  const steps = [-9, 9, -7, 7, -4, 0]
  let i = 0
  const next = () => {
    if (i >= steps.length) { card.style.transition = ''; return }
    card.style.transform = `translateX(${steps[i++]}px)`
    setTimeout(next, 72)
  }
  next()
  setTimeout(() => document.getElementById('login-pass').focus(), 100)
}

function lockScreen() {
  sessionStorage.removeItem('float_authed')
  const d  = document.getElementById('desktop')
  d.classList.remove('visible')
  setTimeout(() => { d.style.opacity = ''; }, 10)
  const ls = document.getElementById('login-screen')
  ls.classList.remove('out')
  ls.classList.add('visible')
  document.getElementById('login-pass').value = ''
  document.getElementById('login-user').value = ''
  document.getElementById('login-error').textContent = ''
  setTimeout(() => document.getElementById('login-user').focus(), 320)
  toast('Screen locked')
}

// Button & enter key
document.getElementById('login-btn').addEventListener('click', attemptLogin)
document.addEventListener('keydown', e => {
  const ls = document.getElementById('login-screen')
  if (e.key === 'Enter' && ls.classList.contains('visible') && !ls.classList.contains('out')) {
    attemptLogin()
  }
})
document.getElementById('lock-btn').addEventListener('click', lockScreen)
