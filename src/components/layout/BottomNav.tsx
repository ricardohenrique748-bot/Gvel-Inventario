import { NavLink } from 'react-router-dom'
import { navItems } from './nav'
import { cn } from '@/lib/cn'

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex border-t border-white/5 bg-surface pb-[env(safe-area-inset-bottom)]">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={'end' in item ? item.end : false}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
              isActive ? 'text-primary' : 'text-secondary',
            )
          }
        >
          <item.icon className="h-5 w-5" />
          <span className="truncate px-1">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
