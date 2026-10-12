// The WhipMarks mace (spiked ball on a segmented handle, as in the app icon), drawn as glowing
// violet glass for the dashboard's centrepiece.
export function MaceArt({ className }: { className?: string }) {
  const cx = 230, cy = 150, r = 78
  const spikes = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2
    const long = i % 2 === 0
    const tip = r + (long ? 62 : 42)
    const half = long ? 0.13 : 0.1
    const pt = (rad: number, ang: number) => `${(cx + Math.cos(ang) * rad).toFixed(1)},${(cy + Math.sin(ang) * rad).toFixed(1)}`
    return `${pt(r - 4, a - half)} ${pt(tip, a)} ${pt(r - 4, a + half)}`
  })
  const studs = Array.from({ length: 9 }, (_, i) => {
    const a = -Math.PI * 0.95 + (i / 8) * Math.PI * 0.9
    return [cx + Math.cos(a) * (r - 7), cy + Math.sin(a) * (r - 7)]
  })
  // Handle runs from the bottom-left of the ball down to the pommel
  const hx1 = cx - 34, hy1 = cy + 70, hx2 = 118, hy2 = 352

  return (
    <svg viewBox="0 0 420 420" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="mace-ball" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#ddd6fe" stopOpacity="0.9" />
          <stop offset="0.35" stopColor="#8b5cf6" stopOpacity="0.55" />
          <stop offset="0.8" stopColor="#4c1d95" stopOpacity="0.35" />
          <stop offset="1" stopColor="#1e1035" stopOpacity="0.5" />
        </radialGradient>
        <linearGradient id="mace-spike" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c4b5fd" stopOpacity="0.75" />
          <stop offset="1" stopColor="#6d28d9" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="mace-handle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a78bfa" stopOpacity="0.9" />
          <stop offset="1" stopColor="#6d28d9" stopOpacity="0.5" />
        </linearGradient>
        <filter id="mace-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="mace-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="28" /></filter>
      </defs>

      {/* Ambient glow behind the head */}
      <circle cx={cx} cy={cy} r={r + 40} fill="#8b5cf6" opacity="0.28" filter="url(#mace-soft)" />

      <g filter="url(#mace-glow)">
        {/* Handle: segmented shaft and pommel */}
        <line x1={hx1} y1={hy1} x2={hx2} y2={hy2} stroke="url(#mace-handle)" strokeWidth="13" strokeLinecap="round" />
        <line x1={hx1} y1={hy1} x2={hx2} y2={hy2} stroke="#0b0716" strokeWidth="13" strokeDasharray="3 15" strokeOpacity="0.85" />
        <line x1={hx1 - 3} y1={hy1} x2={hx2 - 3} y2={hy2} stroke="#ede9fe" strokeWidth="1.5" strokeOpacity="0.5" />
        <circle cx={hx2 - 8} cy={hy2 + 16} r="17" fill="url(#mace-ball)" stroke="#a78bfa" strokeWidth="1.5" />
        <ellipse cx={hx2 - 13} cy={hy2 + 10} rx="6" ry="4" fill="#f5f3ff" opacity="0.6" />

        {/* Spikes */}
        {spikes.map((points, i) => (
          <polygon key={i} points={points} fill="url(#mace-spike)" stroke="#a78bfa" strokeWidth="1.2" strokeLinejoin="round" />
        ))}

        {/* Head */}
        <circle cx={cx} cy={cy} r={r} fill="url(#mace-ball)" stroke="#c4b5fd" strokeWidth="2" />
        <path d={`M ${cx - r + 10} ${cy - 8} Q ${cx} ${cy - 30} ${cx + r - 8} ${cy - 2}`} stroke="#ede9fe" strokeOpacity="0.35" strokeWidth="2" fill="none" />
        <path d={`M ${cx - r + 14} ${cy + 18} Q ${cx} ${cy - 2} ${cx + r - 6} ${cy + 24}`} stroke="#ede9fe" strokeOpacity="0.2" strokeWidth="1.5" fill="none" />
        {studs.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" fill="#ede9fe" opacity="0.7" />)}
        <ellipse cx={cx - 26} cy={cy - 38} rx="26" ry="15" fill="#f5f3ff" opacity="0.35" transform={`rotate(-20 ${cx - 26} ${cy - 38})`} />
      </g>
    </svg>
  )
}
