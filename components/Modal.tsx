'use client'

import { Trash2, X } from 'lucide-react'
import { EventMenuEditor } from '@/components/EventMenuEditor'
import { supabase } from '@/lib/supabase'

export function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const eventMatch = title.match(/^Evento #(\d+)/)
  const eventNumber = eventMatch ? Number(eventMatch[1]) : null

  async function deleteEvent() {
    if (eventNumber === null || !supabase) return
    if (!confirm(`Cancellare definitivamente l'evento #${eventNumber}?`)) return

    const { error } = await supabase.from('events').delete().eq('event_number', eventNumber)
    if (error) {
      alert(`Impossibile eliminare l'evento: ${error.message}`)
      return
    }

    onClose()
    window.location.reload()
  }

  return (
    <div className="modalBackdrop" onMouseDown={onClose}>
      <div className={wide ? 'modal modalWide' : 'modal'} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <h2>{title}</h2>
          <button className="iconButton" onClick={onClose} aria-label="Chiudi"><X size={20} /></button>
        </div>
        {children}
        {eventNumber !== null && <EventMenuEditor eventNumber={eventNumber} />}
        {eventNumber !== null && (
          <div className="formActions">
            <button type="button" className="ghost" onClick={deleteEvent}><Trash2 size={16} /> Elimina evento</button>
          </div>
        )}
      </div>
    </div>
  )
}
