import logoIcon from '@/assets/logo-icon.png'

export const BOOT_SPLASH_MS = 1300

export function BootSplash() {
  return (
    <div className="relative min-h-svh flex items-center justify-center bg-background overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-primary/30 blur-3xl animate-blob" />
        <div
          className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-blob"
          style={{ animationDelay: '2s' }}
        />
      </div>
      <div className="relative flex h-32 w-32 items-center justify-center animate-fade-in">
        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
        <img src={logoIcon} alt="Gvel Diesel" className="relative h-14 w-14 object-contain animate-scale-in" />
      </div>
    </div>
  )
}
