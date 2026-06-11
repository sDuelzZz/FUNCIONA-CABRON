'use client'

import { useState, useTransition, useCallback, useEffect } from 'react'
import { CheckCircle, XCircle, Search, Camera, Keyboard } from 'lucide-react'
import { verificarEntrada, obtenerHistorial } from '@/lib/actions/portero'
import CamaraScanner from '@/components/portero/CamaraScanner'

export default function PaginaPorteros() {
  const [modo, setModo] = useState('camara') // 'camara' | 'manual'
  const [codigo, setCodigo] = useState('')
  const [resultado, setResultado] = useState(null)
  const [historial, setHistorial] = useState([])
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    obtenerHistorial().then(setHistorial)
  }, [])

  function procesar(token) {
    const t = token.trim()
    if (!t) return

    startTransition(async () => {
      const res = await verificarEntrada(t)
      const entrada = {
        id: Date.now(),
        token: t,
        sala: res.sala ?? '—',
        hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        valido: res.valido,
        motivo: res.motivo,
      }
      setResultado(entrada)
      setHistorial(prev => [entrada, ...prev])
      setTimeout(() => setResultado(null), 5000)
      setCodigo('')
    })
  }

  const onScan = useCallback((token) => procesar(token), [])

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">Panel de Porteros</h1>
        <p className="text-zinc-500 text-sm mt-1">Validación de entradas en puerta</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Scanner */}
        <div className="space-y-4">
          {/* Selector de modo */}
          <div className="flex gap-2">
            <button
              onClick={() => setModo('camara')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${modo === 'camara' ? 'bg-gold-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
            >
              <Camera size={14} /> Cámara
            </button>
            <button
              onClick={() => setModo('manual')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${modo === 'manual' ? 'bg-gold-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
            >
              <Keyboard size={14} /> Manual
            </button>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6">
            {modo === 'camara' ? (
              <CamaraScanner onScan={onScan} />
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-zinc-500 text-sm text-center">Pega o escribe el token del QR</p>
                <div className="flex gap-2">
                  <input
                    placeholder="Token de la entrada"
                    value={codigo}
                    onChange={e => setCodigo(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && procesar(codigo)}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-gold-500"
                  />
                  <button
                    onClick={() => procesar(codigo)}
                    disabled={isPending}
                    className="px-4 py-2 bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-zinc-950 text-sm font-semibold rounded-lg"
                  >
                    {isPending ? '…' : <Search size={16} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Resultado */}
          {resultado && (
            <div className={`rounded-2xl border p-6 flex items-center gap-4 ${resultado.valido
              ? 'bg-emerald-500/10 border-emerald-500/40'
              : 'bg-red-500/10 border-red-500/40'
            }`}>
              {resultado.valido
                ? <CheckCircle size={40} className="text-emerald-400 shrink-0" />
                : <XCircle size={40} className="text-red-400 shrink-0" />
              }
              <div>
                <p className={`text-xl font-bold ${resultado.valido ? 'text-emerald-400' : 'text-red-400'}`}>
                  {resultado.valido ? 'ENTRADA VÁLIDA' : 'ENTRADA INVÁLIDA'}
                </p>
                {resultado.valido
                  ? <p className="text-zinc-300 text-sm mt-0.5">{resultado.sala}</p>
                  : <p className="text-zinc-400 text-sm mt-0.5">{resultado.motivo}</p>
                }
                <p className="text-zinc-500 text-xs font-mono mt-0.5">{resultado.token.slice(0, 8)}…</p>
              </div>
            </div>
          )}
        </div>

        {/* Historial */}
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Últimas validaciones</h2>
          {historial.length === 0 && (
            <p className="text-zinc-600 text-sm">Aún no hay validaciones en esta sesión.</p>
          )}
          <div className="space-y-2">
            {historial.map(e => (
              <div key={e.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-4">
                {e.valido
                  ? <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                  : <XCircle size={18} className="text-red-400 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-zinc-100 text-sm font-medium truncate">{e.sala}</p>
                  {!e.valido && <p className="text-zinc-500 text-xs truncate">{e.motivo}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-zinc-500 text-xs font-mono">{e.token.slice(0, 8)}…</p>
                  <p className="text-zinc-600 text-xs">{e.hora}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
