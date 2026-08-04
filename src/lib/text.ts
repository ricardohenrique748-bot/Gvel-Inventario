export function up(value: string): string
export function up(value: string | null | undefined): string | null
export function up(value?: string | null): string | null {
  if (!value) return value ?? null
  return value.trim().toUpperCase()
}
