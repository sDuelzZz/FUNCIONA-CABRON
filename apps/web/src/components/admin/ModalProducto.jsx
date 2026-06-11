'use client'

import { useRef, useState } from 'react'
import { X, ImagePlus } from 'lucide-react'
import Image from 'next/image'

const CATEGORIAS = ['bebida', 'comida', 'pack']

export default function ModalProducto({ formP, setFormP, editandoId, isPending, error, onSubmit, onClose }) {
  const inputRef              = useRef(null)
  const [preview, setPreview] = useState(formP.imagen_url ?? null)

  function handleImagen(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFormP((p) => ({ ...p, imagen: file }))
    setPreview(URL.createObjectURL(file))
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-zinc-100">
            {editandoId ? 'Editar producto' : 'Nuevo producto'}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-100">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">

          {/* Imagen */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full h-32 rounded-xl border-2 border-dashed border-zinc-700 hover:border-gold-500 transition-colors overflow-hidden flex items-center justify-center relative"
          >
            {preview ? (
              <Image width={400} height={400} src={preview} alt="preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-zinc-600">
                <ImagePlus size={24} />
                <span className="text-xs">Añadir imagen</span>
              </div>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImagen}
          />

          <input
            required
            placeholder="Nombre del producto"
            value={formP.nombre}
            onChange={(e) => setFormP((p) => ({ ...p, nombre: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-gold-500"
          />
          <input
            placeholder="Descripción (opcional)"
            value={formP.descripcion}
            onChange={(e) => setFormP((p) => ({ ...p, descripcion: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-gold-500"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              required
              type="number"
              min="0"
              step="0.01"
              placeholder="Precio (€)"
              value={formP.precio}
              onChange={(e) => setFormP((p) => ({ ...p, precio: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-gold-500"
            />
            <select
              value={formP.categoria}
              onChange={(e) => setFormP((p) => ({ ...p, categoria: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-gold-500"
            >
              {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={formP.disponible}
              onChange={(e) => setFormP((p) => ({ ...p, disponible: e.target.checked }))}
              className="rounded"
            />
            Disponible en la carta
          </label>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2 rounded-lg bg-gold-500 hover:bg-gold-600 disabled:opacity-40 text-zinc-950 text-sm font-semibold"
            >
              {isPending ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
