'use client'

import { useEffect, useRef, useState } from 'react'
import { Header } from '@/components/layout/Header'

export default function IntakeQRPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [intakeUrl, setIntakeUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    // Build the full URL to /request
    const base = window.location.origin
    const url = `${base}/request`
    setIntakeUrl(url)

    // Generate QR code using a public QR API (no auth, safe for production)
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&bgcolor=111827&color=E5E7EB&margin=20`

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      canvas.width = 460
      canvas.height = 580

      // Background
      ctx.fillStyle = '#111827'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Border
      ctx.strokeStyle = '#374151'
      ctx.lineWidth = 1
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2)

      // Butler Garage header
      ctx.fillStyle = '#F9FAFB'
      ctx.font = 'bold 22px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Butler Garage', canvas.width / 2, 46)

      ctx.fillStyle = '#9CA3AF'
      ctx.font = '14px sans-serif'
      ctx.fillText('Bangkok, Thailand', canvas.width / 2, 68)

      // Divider
      ctx.strokeStyle = '#374151'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(30, 84)
      ctx.lineTo(canvas.width - 30, 84)
      ctx.stroke()

      // QR code image
      ctx.drawImage(img, 30, 94, 400, 400)

      // Thai prompt
      ctx.fillStyle = '#F9FAFB'
      ctx.font = 'bold 16px sans-serif'
      ctx.fillText('สแกนเพื่อจองบริการ', canvas.width / 2, 516)

      // English prompt
      ctx.fillStyle = '#9CA3AF'
      ctx.font = '13px sans-serif'
      ctx.fillText('Scan to book a service', canvas.width / 2, 537)

      // URL at bottom
      ctx.fillStyle = '#6B7280'
      ctx.font = '11px monospace'
      ctx.fillText(url, canvas.width / 2, 562)
    }
    img.src = qrApiUrl
  }, [])

  function handleCopyLink() {
    navigator.clipboard.writeText(intakeUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handlePrint() {
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head><title>Butler Garage — Intake QR</title><style>
          body { margin: 0; background: #111827; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
          img { max-width: 460px; }
        </style></head>
        <body><img src="${dataUrl}" onload="window.print(); window.close()" /></body>
      </html>
    `)
    win.document.close()
  }

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'butler-garage-intake-qr.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Header title="Intake QR Code" />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-white">Customer Intake Form</h1>
          <p className="text-sm text-gray-400 mt-1">
            Print this QR code and place it at the counter so customers can book online.
          </p>
        </div>

        {/* QR Canvas */}
        <div className="flex justify-center mb-6">
          <canvas
            ref={canvasRef}
            className="rounded-2xl shadow-2xl"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </div>

        {/* URL display */}
        <div className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 mb-6">
          <code className="flex-1 text-sm text-indigo-300 truncate">{intakeUrl}</code>
          <button
            onClick={handleCopyLink}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-700 hover:bg-indigo-600 text-white transition-colors"
          >
            {copied ? '✓ Copied!' : 'Copy Link'}
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-xl font-medium text-sm bg-gray-800 hover:bg-gray-700 text-white border border-gray-600 transition-colors"
          >
            🖨️ Print
          </button>
          <button
            onClick={handleDownload}
            className="px-5 py-2.5 rounded-xl font-medium text-sm bg-indigo-700 hover:bg-indigo-600 text-white transition-colors"
          >
            ⬇️ Download PNG
          </button>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-gray-900/50 border border-gray-800 rounded-2xl p-5 text-sm text-gray-400 space-y-2">
          <p className="font-medium text-gray-300">How it works</p>
          <ul className="space-y-1 list-disc list-inside text-xs">
            <li>Customer scans the QR code with their phone camera</li>
            <li>They fill in their contact info, bike details, and service request</li>
            <li>A new job card appears in <strong className="text-gray-200">New Requests</strong> on the Kanban board</li>
            <li>If the customer has an existing profile, it matches by phone number</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
