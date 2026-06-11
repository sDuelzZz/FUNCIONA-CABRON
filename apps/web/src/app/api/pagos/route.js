import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Cliente "a pelo" con la service_role key: esta ruta no tiene sesión de
// usuario (la llama nuestro propio servidor), así que saltamos las RLS.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(req) {
  try {
    // tipo  → 'reserva' o 'pedido'
    // id    → el ID de la reserva o del pedido en nuestra base de datos
    // items → array de { nombre, precio, cantidad }
    const { tipo, id, items, clienteId, clienteEmail } = await req.json()

    // --- ¿El usuario ya tiene tarjeta guardada? ---
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('stripe_customer_id')
      .eq('id', clienteId)
      .single()

    let stripeCustomerId = perfil?.stripe_customer_id

    if (!stripeCustomerId) {
      // Primera vez: creamos el Customer en Stripe y guardamos su ID
      const customer = await stripe.customers.create({
        email: clienteEmail,
        metadata: { supabase_id: clienteId },
      })
      stripeCustomerId = customer.id

      await supabase
        .from('perfiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', clienteId)
    }
    // ----------------------------------------------

    // Construimos la lista de productos que verá el usuario en Stripe
    const lineItems = items.map((item) => ({
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(item.precio * 100), // Stripe trabaja en céntimos
        product_data: { name: item.nombre },
      },
      quantity: item.cantidad,
    }))

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card', 'klarna'],
      line_items: lineItems,
      mode: 'payment',
      payment_intent_data: {
        setup_future_usage: 'on_session', // guarda la tarjeta para la próxima vez
      },
      // Sin esto, Checkout no ofrece las tarjetas ya guardadas del Customer
      saved_payment_method_options: {
        payment_method_save: 'enabled',
        allow_redisplay_filters: ['always'],
      },
      success_url: tipo === 'reserva'
        ? `${baseUrl}/reserva/exito?reserva_id=${id}`
        : `${baseUrl}/pedido/exito?pedido_id=${id}`,
      cancel_url: `${baseUrl}/${tipo === 'reserva' ? 'vip' : ''}`,
      // Guardamos tipo e ID para saber qué actualizar cuando Stripe nos avise
      metadata: { tipo, id, cliente_id: clienteId },
      expires_at: Math.floor(Date.now() / 1000) + 1800, // caduca en 30 minutos
    })

    // Guardamos el ID de sesión en nuestra base de datos
    const tabla = tipo === 'reserva' ? 'reservas' : 'pedidos'
    await supabase.from(tabla).update({ stripe_session: session.id }).eq('id', id)

    return NextResponse.json({ url: session.url }) // Ahora te vas a Stripe a que el usuario pague

  } catch (err) {
    console.error('Error en checkout:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
