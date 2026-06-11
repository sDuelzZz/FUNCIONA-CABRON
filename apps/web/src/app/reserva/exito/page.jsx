import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function PaginaExitoReserva({ searchParams }) {
  const { reserva_id: reservaId } = await searchParams
  const supabase = await createClient()

  const { data: reserva } = await supabase
    .from('reservas')
    .select('*, salas_vip(nombre)')
    .eq('id', reservaId)
    .single()

  if (!reserva || reserva.estado_pago !== 'pagado') {
    return (
      <div className="p-8 text-center text-zinc-400">
        <p>Reserva no encontrada o pago aún no confirmado.</p>
        <p className="text-zinc-600 text-sm mt-2">Si acabas de pagar, espera unos segundos y recarga la página.</p>
      </div>
    )
  }

  return (
    <div className="p-8 flex flex-col items-center justify-center min-h-full gap-6 text-center">
      <h1 className="text-2xl font-bold text-zinc-100">¡Reserva confirmada!</h1>
      <div className="text-zinc-400 space-y-1">
        <p>Sala: {reserva.salas_vip.nombre}</p>
        <p>Inicio: {new Date(reserva.inicio).toLocaleString('es-ES')}</p>
        <p className="text-gold-400 font-bold text-xl">{reserva.total} € pagados</p>
      </div>
      <p className="text-zinc-500 text-sm">Tu entrada con código QR ya está disponible en tu perfil.</p>
      <Link href="/mi-area?tab=zonas" className="px-6 py-2.5 bg-gold-500 hover:bg-gold-600 text-zinc-950 font-bold rounded-xl text-sm">
        Ver mis reservas
      </Link>
    </div>
  )
}
