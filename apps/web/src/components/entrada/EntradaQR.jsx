'use client'

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

export default function EntradaQR({ token }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, token, {
      width: 256,
      margin: 2,
      color: { dark: '#09090b', light: '#fafafa' },
    })
  }, [token])

  return <canvas ref={canvasRef} className="rounded-xl" />
}
