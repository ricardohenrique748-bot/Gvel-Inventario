import { LayoutDashboard, ArrowLeftRight, ClipboardCheck, Users, FileBarChart } from 'lucide-react'
import logoIcon from '@/assets/logo-icon.png'

export const ORBIT_SPLASH_MS = 1600

const ORBIT_ICONS = [
  { Icon: LayoutDashboard, top: 8, left: 128 },
  { Icon: ArrowLeftRight, top: 90, left: 240 },
  { Icon: ClipboardCheck, top: 224, left: 197 },
  { Icon: Users, top: 224, left: 59 },
  { Icon: FileBarChart, top: 90, left: 16 },
]

export function OrbitSplash() {
  return (
    <div className="relative min-h-svh flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary/85 via-primary-hover/85 to-[#1c1c1c]/85">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 -left-10 h-64 w-64 rounded-full bg-black/20 blur-3xl" />
      </div>

      <div className="relative h-64 w-64">
        <div className="absolute inset-0 rounded-full border border-white/20 animate-spin-slow" />
        <div className="absolute inset-8 rounded-full border border-dashed border-white/15 animate-spin-slow-reverse" />

        <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-lg flex items-center justify-center">
          <span className="absolute inset-0 rounded-2xl bg-white/40 animate-ping" />
          <img src={logoIcon} alt="Gvel Diesel" className="relative h-9 w-9 object-contain" />
        </div>

        {ORBIT_ICONS.map(({ Icon, top, left }, i) => (
          <div
            key={i}
            className="absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-md flex items-center justify-center animate-float"
            style={{ top, left, animationDelay: `${i * 0.4}s` }}
          >
            <Icon className="h-[18px] w-[18px] text-primary" />
          </div>
        ))}
      </div>
    </div>
  )
}
