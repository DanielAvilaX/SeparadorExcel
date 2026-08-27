import { useEffect, useRef } from 'react'

// Red de nodos que se conectan entre sí y con el mouse (adaptado del efecto del portafolio
// de Daniel: ahí vivía como una franja horizontal arriba de toda la pantalla; acá se ancla al
// borde DERECHO del panel del formulario, en verde, y solo existe en el login.
export default function LoginNetwork() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches
    const canvas = canvasRef.current
    if (!canvas || reduceMotion) return

    const ctx = canvas.getContext('2d')
    const parent = canvas.parentElement
    let w = 0, h = 0, nodes = []
    let raf = null
    const mouse = { x: -9999, y: -9999 }
    const density = isTouch ? 26000 : 15000
    // Verde Cruz Verde (var(--cv-green) = #00A651) en rgb, para los trazos del canvas.
    const RGB = '0,166,81'

    function resize() {
      const rect = parent.getBoundingClientRect()
      w = Math.round(rect.width)
      h = Math.round(rect.height)
      canvas.width = w
      canvas.height = h
      const count = Math.min(80, Math.floor((w * h) / density))
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
      }))
    }

    function onMove(e) {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    }
    function onLeave() { mouse.x = -9999; mouse.y = -9999 }

    function draw() {
      ctx.clearRect(0, 0, w, h)
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy
        if (n.x < 0 || n.x > w) n.vx *= -1
        if (n.y < 0 || n.y > h) n.vy *= -1
      }
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]
          const dx = a.x - b.x, dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 150) {
            ctx.strokeStyle = `rgba(${RGB},${0.5 * (1 - dist / 150)})`
            ctx.lineWidth = 1.4
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
          }
        }
        const dmx = a.x - mouse.x, dmy = a.y - mouse.y
        const dm = Math.sqrt(dmx * dmx + dmy * dmy)
        if (dm < 170) {
          ctx.strokeStyle = `rgba(${RGB},${0.7 * (1 - dm / 170)})`
          ctx.lineWidth = 1.7
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke()
        }
        ctx.fillStyle = `rgba(${RGB},.85)`
        ctx.beginPath(); ctx.arc(a.x, a.y, 2.2, 0, Math.PI * 2); ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return <canvas ref={canvasRef} className="login-net" aria-hidden="true" />
}
