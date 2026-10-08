'use client'

import { useEffect, useRef, useState } from 'react'
import { ImagePlus, Maximize2, RefreshCw, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export const RECIPE_PHOTO_BUCKET = 'recipe-photos'

async function preparePhoto(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Scegli una foto JPG, PNG o WebP.')
  if (file.size > 25 * 1024 * 1024) throw new Error('La foto deve essere inferiore a 25 MB.')
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Impossibile preparare la foto.')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Impossibile preparare la foto.')), 'image/jpeg', .85))
    return new File([blob], 'ricetta.jpg', { type: 'image/jpeg' })
  } finally { bitmap.close() }
}

export function RecipePhoto({ path, change, onChange, onPreparing, readOnly = false, disabled = false }: {
  path?: string | null
  change?: File | null
  onChange?: (file: File | null) => void
  onPreparing?: (busy: boolean) => void
  readOnly?: boolean
  disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const expandButton = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const busy = disabled || preparing
  useEffect(() => {
    let active = true
    let objectUrl = ''
    setUrl(''); setError(''); setLoading(false)
    if (change instanceof File) {
      objectUrl = URL.createObjectURL(change)
      setUrl(objectUrl)
    } else if (change === undefined && path) {
      setLoading(true)
      supabase!.storage.from(RECIPE_PHOTO_BUCKET).createSignedUrl(path, 3600).then(({ data, error }) => {
        if (!active) return
        setLoading(false)
        if (error) setError('Impossibile caricare la foto. Riapri la ricetta per riprovare.')
        else setUrl(data.signedUrl)
      })
    }
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [path, change])
  useEffect(() => {
    if (!expanded) return
    const previous = document.activeElement as HTMLElement | null
    closeButton.current?.focus()
    return () => previous?.focus()
  }, [expanded])
  async function select(file?: File) {
    if (!file || !onChange) return
    setPreparing(true); onPreparing?.(true); setError('')
    try { onChange(await preparePhoto(file)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Impossibile caricare la foto.') }
    finally { setPreparing(false); onPreparing?.(false); if (input.current) input.current.value = '' }
  }
  if (readOnly && !path) return null
  return <section className="recipePhotoPanel" aria-label="Foto del piatto">
    {!readOnly && <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={e => void select(e.target.files?.[0])}/>}
    {url ? <button ref={expandButton} type="button" className="recipePhotoFrame hasPhoto" onClick={() => setExpanded(true)} aria-label="Ingrandisci foto del piatto"><img src={url} alt="Foto del piatto"/><span className="recipePhotoZoom"><Maximize2 size={15}/> Ingrandisci</span></button> : <button type="button" className="recipePhotoFrame" onClick={() => input.current?.click()} disabled={busy || readOnly || loading}><ImagePlus size={32}/><strong>{preparing ? 'Preparazione foto…' : loading ? 'Caricamento foto…' : 'Carica foto'}</strong><span>Una foto per raccontare il piatto</span></button>}
    {!readOnly && (url || path) && <div className="recipePhotoActions"><button type="button" className="recipePhotoReplace" disabled={busy} onClick={() => input.current?.click()}><RefreshCw size={15}/> Sostituisci</button><button type="button" className="recipePhotoDelete" disabled={busy} onClick={() => onChange?.(null)}><Trash2 size={15}/> Elimina</button></div>}
    {change !== undefined && <p className="recipePhotoStatus">{change === null ? 'Foto rimossa. Salva le modifiche per confermare.' : 'Foto pronta. Salva le modifiche per confermare.'}</p>}
    {error && <p className="recipePhotoError" role="alert">{error}</p>}
    {expanded && <div className="recipePhotoLightbox" role="dialog" aria-modal="true" aria-label="Foto del piatto ingrandita" onMouseDown={e => { e.stopPropagation(); if (e.target === e.currentTarget) setExpanded(false) }} onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setExpanded(false) } if(e.key === 'Tab') { e.preventDefault(); closeButton.current?.focus() } }}><button ref={closeButton} type="button" className="recipePhotoClose" aria-label="Chiudi foto" onClick={() => setExpanded(false)}><X size={22}/></button><img src={url} alt="Foto del piatto ingrandita"/></div>}
  </section>
}
