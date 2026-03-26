interface Props {
  message: string
  x: number
  y: number
}

export function ChatBubble({ message, x, y }: Props) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -200%)',
        zIndex: 200,
        maxWidth: 160,
      }}
    >
      <div className="bg-gray-900 bg-opacity-90 border border-gray-600 text-gray-100 text-xs px-2 py-1 rounded-lg shadow-lg whitespace-pre-wrap break-words text-center">
        {message}
      </div>
      {/* Tail */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
        style={{
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '6px solid rgba(17,24,39,0.9)',
          bottom: -6,
        }}
      />
    </div>
  )
}
