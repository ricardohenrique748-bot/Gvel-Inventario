import logoIcon from '@/assets/logo-icon.png'

export const BRAND_SPLASH_MS = 1300

export function BrandSplash() {
  return (
    <div className="relative min-h-svh flex items-center justify-center bg-background overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-primary/30 blur-3xl animate-blob" />
        <div
          className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-blob"
          style={{ animationDelay: '2s' }}
        />
      </div>
      <div className="relative flex flex-col items-center gap-5 animate-scale-in">
        <div className="relative flex items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
          <span className="absolute -inset-3 rounded-full bg-primary/10 animate-ping" style={{ animationDelay: '0.3s' }} />
          <img src={logoIcon} alt="Gvel Diesel" className="relative h-24 w-24 object-contain" />
        </div>
      </div>
    </div>
  )
}
