'use client'

import { useEffect, useState } from 'react'

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export default function PWAInstallPrompt() {
  const [show, setShow] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    // No mostrar si ya está instalada o si ya se mostró en esta sesión
    if (isInStandaloneMode()) return
    if (sessionStorage.getItem('pwa-prompt-shown')) return

    const ios = isIOS()
    setIsIos(ios)

    if (ios) {
      // En iOS no hay beforeinstallprompt, mostramos instrucciones manuales
      setShow(true)
      sessionStorage.setItem('pwa-prompt-shown', '1')
      return
    }

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
      sessionStorage.setItem('pwa-prompt-shown', '1')
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setDeferredPrompt(null)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700/60 rounded-2xl p-6 shadow-2xl">
        {/* Icono */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gold-500/20 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 8.25h3m-3 3h3m-6 3h.008v.008H6.75V15z" />
            </svg>
          </div>
          <div>
            <h2 className="text-zinc-100 font-bold text-base leading-tight">Instala Flex</h2>
            <p className="text-zinc-500 text-xs mt-0.5">Acceso rápido desde tu pantalla de inicio</p>
          </div>
        </div>

        {isIos ? (
          <div className="space-y-3 mb-5">
            <p className="text-zinc-400 text-sm">Para instalar en tu iPhone o iPad:</p>
            <ol className="space-y-2 text-sm text-zinc-300">
              <li className="flex items-start gap-2">
                <span className="text-gold-400 font-bold shrink-0">1.</span>
                <span>Toca el botón de compartir <span className="inline-block align-middle text-gold-400">⬆</span> en Safari</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold-400 font-bold shrink-0">2.</span>
                <span>Selecciona <strong className="text-zinc-100">"Agregar a inicio"</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold-400 font-bold shrink-0">3.</span>
                <span>Pulsa <strong className="text-zinc-100">Agregar</strong> en la esquina superior</span>
              </li>
            </ol>
          </div>
        ) : (
          <p className="text-zinc-400 text-sm mb-5">
            Añade Flex a tu pantalla de inicio para una experiencia más rápida, sin necesidad del navegador.
          </p>
        )}

        <div className="flex gap-3">
          {!isIos && (
            <button
              onClick={handleInstall}
              className="flex-1 py-2.5 bg-gold-500 hover:bg-gold-600 text-zinc-950 font-bold text-sm rounded-xl transition-colors"
            >
              Instalar
            </button>
          )}
          <button
            onClick={() => setShow(false)}
            className={`${isIos ? 'flex-1' : ''} py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl transition-colors`}
          >
            {isIos ? 'Entendido' : 'Ahora no'}
          </button>
        </div>
      </div>
    </div>
  )
}
