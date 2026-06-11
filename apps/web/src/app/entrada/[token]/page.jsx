import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EntradaQR from '@/components/entrada/EntradaQR'

export default async function PaginaEntrada({ params }) {
  const { token } = await params
  const supabase = await createClient()

  const { data: reserva } = await supabase
    .from('reservas')
    .select('id, inicio, fin, estado_pago, salas_vip ( nombre )')
    .eq('qr_token', token)
    .single()

  if (!reserva || reserva.estado_pago !== 'pagado') notFound()

  const sala = reserva.salas_vip?.nombre ?? 'Sala VIP'
  const fecha = new Date(reserva.inicio).toLocaleString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 flex flex-col items-center gap-6 max-w-sm w-full">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-100">Tu entrada</h1>
          <p className="text-gold-400 font-semibold mt-1">{sala}</p>
          <p className="text-zinc-500 text-sm mt-1 capitalize">{fecha}</p>
        </div>

        <EntradaQR token={token} />

        <p className="text-zinc-600 text-xs text-center">
          Muestra este código al portero en la entrada
        </p>
      </div>
    </div>
  )
}
