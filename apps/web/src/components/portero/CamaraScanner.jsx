'use client'

import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export default function CamaraScanner({ onScan }) {
  const didInit = useRef(false)

  useEffect(() => {
    if (didInit.current) return
    didInit.current = true

    const scanner = new Html5Qrcode('qr-reader')

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      (token) => {
        scanner.stop().then(() => onScan(token)).catch(() => onScan(token))
      },
      () => {},
    ).catch(() => {})

    return () => {
      scanner.stop().catch(() => {})
    }
  }, [onScan])

  return (
    <div
      id="qr-reader"
      className="w-full rounded-xl overflow-hidden [&_video]:rounded-xl"
    />
  )
}
