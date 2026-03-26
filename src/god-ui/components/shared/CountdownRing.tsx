interface CountdownRingProps {
  duration: number
  remaining: number
  size?: number
  color?: string
}

export function CountdownRing({ duration, remaining, size = 64, color = '#06b6d4' }: CountdownRingProps) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const progress = duration > 0 ? remaining / duration : 0
  const offset = circumference * (1 - progress)
  const isUrgent = remaining <= 5 && remaining > 0
  const displayColor = isUrgent ? '#ef4444' : color

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1f2937" strokeWidth={4} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={displayColor} strokeWidth={4}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-linear"
          style={{ filter: isUrgent ? 'drop-shadow(0 0 6px #ef4444)' : undefined }}
        />
      </svg>
      <span className={`absolute text-sm font-mono font-bold ${isUrgent ? 'text-red-400 animate-pulse' : 'text-white'}`}>
        {remaining}
      </span>
    </div>
  )
}
