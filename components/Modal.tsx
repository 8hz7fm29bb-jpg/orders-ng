'use client'

import { X } from 'lucide-react'
import { EventMenuEditor } from '@/components/EventMenuEditor'

export function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const eventMatch = title.match(/^Evento #(\d+)/)
  const eventNumber = eventMatch ? Number(eventMatch[1]) : null

  return (
    <div className="modalBackdrop" onMouseDown={onClose}>
      <div className={wide ? 'modal modalWide' : 'modal'} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <h2>{title}</h2>
          <button className="iconButton" onClick={onClose} aria-label="Chiudi"><X size={20} /></button>
        </div>
        {children}
        {eventNumber !== null && <EventMenuEditor eventNumber={eventNumber} />}
      </div>
    </div>
  )
}
