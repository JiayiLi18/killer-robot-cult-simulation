// Pixel-space layout for the ship map.
// Rooms are solid blocks; corridors are drawn from connection data at runtime.

export interface RoomLayout {
  id: string
  x: number         // left edge (world px)
  y: number         // top edge (world px)
  w: number         // width (px)
  h: number         // height (px)
  fillColor:   number
  borderColor: number
  labelColor:  string
}

// Hand-placed positions matching the connection graph:
//
//  [comms]──[bridge]──────────────[hallway]──[engine]
//                                     │
//                                 [medbay]──[lab]
//                                     │
//                                 [cargo]──[airlock]
//
export const ROOM_LAYOUTS: RoomLayout[] = [
  { id: 'bridge',  x: 260, y:  40, w: 200, h: 110, fillColor: 0x1a2060, borderColor: 0x4455cc, labelColor: '#aabbff' },
  { id: 'comms',   x:  40, y:  40, w: 160, h: 110, fillColor: 0x1a3a3a, borderColor: 0x30aaaa, labelColor: '#88eeff' },
  { id: 'hallway', x: 510, y: 175, w: 160, h:  80, fillColor: 0x222233, borderColor: 0x444466, labelColor: '#9999bb' },
  { id: 'engine',  x: 720, y:  40, w: 190, h: 130, fillColor: 0x4e1808, borderColor: 0xcc3318, labelColor: '#ff8855' },
  { id: 'medbay',  x: 510, y: 320, w: 190, h: 130, fillColor: 0x0e4a1e, borderColor: 0x28aa50, labelColor: '#66ee88' },
  { id: 'lab',     x: 750, y: 320, w: 170, h: 130, fillColor: 0x1a3a10, borderColor: 0x44aa20, labelColor: '#aaff66' },
  { id: 'cargo',   x: 510, y: 510, w: 190, h: 130, fillColor: 0x3a2a08, borderColor: 0x997722, labelColor: '#ffcc55' },
  { id: 'airlock', x: 750, y: 510, w: 170, h: 130, fillColor: 0x3a1010, borderColor: 0xaa2222, labelColor: '#ff6644' },
]

export const WORLD_W = 960
export const WORLD_H = 680

export function getRoomLayout(id: string): RoomLayout | undefined {
  return ROOM_LAYOUTS.find(r => r.id === id)
}

/** World-pixel center of a room */
export function roomCenter(id: string): { x: number; y: number } | undefined {
  const r = getRoomLayout(id)
  if (!r) return undefined
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

/** Pixel position for the i-th robot (0-indexed) out of n total in a room */
export function robotSlotPosition(
  slotIndex: number,
  totalInRoom: number,
  room: RoomLayout,
): { x: number; y: number } {
  const margin = 28
  const usable = room.w - margin * 2
  const spread = totalInRoom <= 1 ? 0 : usable / (totalInRoom - 1)
  return {
    x: room.x + margin + slotIndex * spread,
    y: room.y + room.h / 2,
  }
}

/** Compute the corridor rect connecting two adjacent rooms (returns the thinner bridge rect) */
export function corridorRect(aId: string, bId: string): { x: number; y: number; w: number; h: number } | null {
  const a = getRoomLayout(aId)
  const b = getRoomLayout(bId)
  if (!a || !b) return null

  const acx = a.x + a.w / 2, acy = a.y + a.h / 2
  const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2

  const dx = Math.abs(acx - bcx)
  const dy = Math.abs(acy - bcy)
  const CORR = 28   // corridor width (px)

  if (dx >= dy) {
    // Horizontal corridor
    const left  = Math.min(a.x + a.w, b.x + b.w)
    const right = Math.max(a.x, b.x)
    const midY  = (acy + bcy) / 2
    return { x: left, y: midY - CORR / 2, w: Math.abs(right - left), h: CORR }
  } else {
    // Vertical corridor
    const top    = Math.min(a.y + a.h, b.y + b.h)
    const bottom = Math.max(a.y, b.y)
    const midX   = (acx + bcx) / 2
    return { x: midX - CORR / 2, y: top, w: CORR, h: Math.abs(bottom - top) }
  }
}
