'use client'

import { X } from 'lucide-react'

export function Modal({ title, children, onClose, wide = false }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modalBackdrop" onMouseDown={onClose}>
      <div className={wide ? 'modal modalWide' : 'modal'} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <h2>{title}</h2>
          <button className="iconButton" onClick={onClose} aria-label="Chiudi"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
