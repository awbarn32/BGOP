'use client'

import { useEffect, useRef } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }

    return () => {
      if (dialog.open) dialog.close()
    }
  }, [open])

  const sizeClass = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size]

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={`w-full ${sizeClass} rounded-xl bg-gray-900 border border-gray-700 shadow-2xl p-0 backdrop:bg-black/60`}
      onClick={(e) => { if (e.target === dialogRef.current) onClose() }}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors text-lg leading-none"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </dialog>
  )
}
