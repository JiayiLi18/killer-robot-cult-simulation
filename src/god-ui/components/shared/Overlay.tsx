import type { ReactNode } from 'react'

interface OverlayProps {
  visible: boolean
  onClose?: () => void
  children: ReactNode
}

export function Overlay({ visible, onClose, children }: OverlayProps) {
  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300"
      onClick={(e) => { if (e.target === e.currentTarget && onClose) onClose() }}
    >
      <div className="relative w-full max-w-lg mx-4" style={{ animation: 'fadeIn 0.3s ease-out' }}>
        {children}
      </div>
    </div>
  )
}
