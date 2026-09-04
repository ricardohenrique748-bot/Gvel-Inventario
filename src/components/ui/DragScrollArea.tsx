import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface DragScrollAreaProps {
  children: ReactNode
  className?: string
}

export function DragScrollArea({ children, className }: DragScrollAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDownRef = useRef(false)
  const startXRef = useRef(0)
  const scrollLeftRef = useRef(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    isDownRef.current = true
    startXRef.current = e.pageX - containerRef.current.offsetLeft
    scrollLeftRef.current = containerRef.current.scrollLeft
  }

  const stopDragging = () => {
    isDownRef.current = false
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDownRef.current || !containerRef.current) return
    e.preventDefault()
    const x = e.pageX - containerRef.current.offsetLeft
    const walk = (x - startXRef.current) * 1.6
    containerRef.current.scrollLeft = scrollLeftRef.current - walk
  }

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseLeave={stopDragging}
      onMouseUp={stopDragging}
      onMouseMove={handleMouseMove}
      className={cn('overflow-x-auto no-scrollbar select-none cursor-grab active:cursor-grabbing', className)}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {children}
    </div>
  )
}
