// ══════════════════════════════════════════
// FLOAT — settings.js
// ══════════════════════════════════════════
const bootTime = Date.now()

async function loadSettings() {
  try {
    const [bat, wifi, mem, sto] = await Promise.all([
      fetch('/api/battery').then(r => r.json()).catch(() => ({})),
      fetch('/api/wifi').then(r => r.json()).catch(() => ({})),
      fetch('/api/memory').then(r => r.text()).catch(() => ''),
      fetch('/api/storage').then(r => r.text()).catch(() => ''),
    ])

    // Battery
    const pct  = bat.percentage ?? '—'
    const bEl  = document.getElementById('s-bat')
    bEl.textContent = pct !== '—' ? pct + '%' : '—'
    bEl.className   = 'sc-val ' + (pct > 50 ? 'c-green' : pct > 20 ? 'c-yellow' : 'c-red')
    document.getElementById('s-bstat').textContent = bat.status || '—'

    // Memory
    const mLine = mem.split('\n').find(l => l.includes('Mem:')) || ''
    const mp    = mLine.trim().split(/\s+/)
    document.getElementById('s-mem').textContent = mp[2] || '—'

    // Storage
    const sLine = sto.split('\n').find(l => l.includes('/data') || l.includes('sdcard') || l.includes('/storage')) || ''
    const sp    = sLine.trim().split(/\s+/)
    document.getElementById('s-stor').textContent = sp[3] || '—'

    // Network
    document.getElementById('s-ip').textContent    = wifi.ip    || '—'
    document.getElementById('s-ssid').textContent  = wifi.ssid  || wifi.bssid || '—'
    document.getElementById('s-speed').textContent = wifi.link_speed_mbps ? wifi.link_speed_mbps + ' Mbps' : '—'

    // Uptime
    const up = Math.floor((Date.now() - bootTime) / 1000)
    const m  = Math.floor(up / 60), s = up % 60
    document.getElementById('s-uptime').textContent = `${m}m ${s}s`

  } catch {}
}

// titlebar buttons
document.getElementById('settings-close').addEventListener('click', closeApp)
document.getElementById('settings-refresh').addEventListener('click', () => { loadSettings(); toast('Refreshed') })
