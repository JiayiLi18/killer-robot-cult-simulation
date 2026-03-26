import { QRCodeSVG } from 'qrcode.react'

interface QRJoinProps {
  roomCode: string
  qrUrl: string
}

export function QRJoin({ roomCode, qrUrl }: QRJoinProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="p-4 bg-white rounded-xl">
        <QRCodeSVG value={qrUrl || 'https://example.com'} size={180} />
      </div>
      <div className="text-center">
        <p className="text-gray-400 text-sm mb-1">Room Code</p>
        <p className="text-3xl font-mono font-bold text-accent-cyan tracking-widest">
          {roomCode}
        </p>
      </div>
    </div>
  )
}
