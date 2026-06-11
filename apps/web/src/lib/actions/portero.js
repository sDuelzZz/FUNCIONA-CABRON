'use server'

import { createClient } from '@/lib/supabase/server'

export async function verificarEntrada(token) {
  const supabase = await createClient()

  const { data: reserva } = await supabase
    .from('reservas')
    .select('id, inicio, fin, estado_pago, usado_at, salas_vip ( nombre )')
    .eq('qr_token', token)
    .single()

  if (!reserva) return { valido: false, motivo: 'Entrada no encontrada' }
  if (reserva.estado_pago !== 'pagado') return { valido: false, motivo: 'Pago pendiente o cancelado' }
  if (reserva.usado_at) return { valido: false, motivo: 'Entrada ya utilizada' }

  const ahora = Date.now()
  const inicio = new Date(reserva.inicio).getTime()
  const fin = new Date(reserva.fin).getTime()
  const margen = 15 * 60 * 1000

  if (ahora < inicio - margen) return { valido: false, motivo: 'Aún no es la hora del evento' }
  if (ahora > fin + margen) return { valido: false, motivo: 'El evento ya ha terminado' }

  await supabase
    .from('reservas')
    .update({ usado_at: new Date().toISOString() })
    .eq('id', reserva.id)

  return {
    valido: true,
    sala: reserva.salas_vip?.nombre ?? 'Sala VIP',
    inicio: reserva.inicio,
  }
}

export async function obtenerHistorial() {
  const supabase = await createClient()

  const ahora = new Date()
  const margen = new Date(ahora.getTime() + 15 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from('reservas')
    .select('id, qr_token, usado_at, fin, salas_vip ( nombre )')
    .not('usado_at', 'is', null)
    .gte('fin', margen)
    .order('usado_at', { ascending: false })
    .limit(50)

  return (data ?? []).map(r => ({
    id: r.id,
    token: r.qr_token,
    sala: r.salas_vip?.nombre ?? 'Sala VIP',
    hora: new Date(r.usado_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    valido: true,
  }))
}
