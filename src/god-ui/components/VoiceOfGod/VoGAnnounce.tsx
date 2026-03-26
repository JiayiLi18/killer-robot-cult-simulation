import { useEffect, useState, useRef } from 'react'
import { Overlay } from '../shared/Overlay'

interface VoGAnnounceProps {
  announcement: string
}

export function VoGAnnounce({ announcement }: VoGAnnounceProps) {
  const words = announcement.split(' ')
  const [visibleWords, setVisibleWords] = useState(0)
  const audioRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    setVisibleWords(0)
    const timers: ReturnType<typeof setTimeout>[] = []
    words.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleWords(i + 1), (i + 1) * 500))
    })

    try {
      const ctx = new AudioContext()
      audioRef.current = ctx
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(220, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 1)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 2)
      osc.start()
      osc.stop(ctx.currentTime + 2)
    } catch { /* Audio may not be available */ }

    return () => {
      timers.forEach(clearTimeout)
      audioRef.current?.close()
      audioRef.current = null
    }
  }, [announcement]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Overlay visible={true}>
      <div className="text-center py-12">
        <p className="text-accent-purple/60 font-mono text-xs uppercase tracking-[0.3em] mb-8">
          The Gods Have Spoken
        </p>
        <div className="flex items-center justify-center gap-4 min-h-[80px]">
          {words.map((word, i) => (
            <span
              key={i}
              className={`text-4xl md:text-5xl font-bold font-mono text-white transition-all duration-500 ${
                i < visibleWords ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
              }`}
              style={{
                textShadow: i < visibleWords
                  ? '0 0 20px rgba(139,92,246,0.5), 0 0 40px rgba(139,92,246,0.2)'
                  : 'none',
              }}
            >
              {word}
            </span>
          ))}
        </div>
      </div>
    </Overlay>
  )
}
