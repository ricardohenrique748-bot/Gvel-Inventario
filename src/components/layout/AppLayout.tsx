import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { MobileTopBar } from './Header'

export function AppLayout() {
  return (
    <div className="flex min-h-svh bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main className="flex-1 px-4 py-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:py-8 md:pb-8">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
        <BottomNav />
      </div>
    </div>
  )
}
