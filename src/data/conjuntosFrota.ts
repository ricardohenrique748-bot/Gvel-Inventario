// Conjuntos rodotrem da frota: cavalo → carreta 1, dolly, carreta 2.
// O checklist do cavalo pede as fotos de cada implemento com a placa dele.
// Placas sem traço e em maiúsculas.
export interface ConjuntoRodotrem {
  carreta1: string
  dolly: string
  carreta2: string
}

export const CONJUNTOS_RODOTREM: Record<string, ConjuntoRodotrem> = {
  CUL2E24: { carreta1: 'GCF8A72', dolly: 'GKG0G83', carreta2: 'GAQ5D96' },
  EDJ8C00: { carreta1: 'RHS3J46', dolly: 'RHS3J47', carreta2: 'RHS3J48' },
  GDT0I02: { carreta1: 'FKC7A53', dolly: 'GFG8A53', carreta2: 'FOY5J14' },
  GDT0H04: { carreta1: 'GGJ7J35', dolly: 'FVW6G41', carreta2: 'EGY7A61' },
  // Ordem não informada: o dolly é a placa cadastrada como REBOQUE (GBY0H76).
  ERA9G01: { carreta1: 'GBF4E16', dolly: 'GBY0H76', carreta2: 'GBL1D31' },
  FXM9D74: { carreta1: 'ECI8C91', dolly: 'FPM8J61', carreta2: 'GFT7H72' },
  GDT0I01: { carreta1: 'GJV9F04', dolly: 'GEI6D74', carreta2: 'FDR9J73' },
  GDT0I03: { carreta1: 'RYQ6H35', dolly: 'RYQ6G35', carreta2: 'RYQ7C95' },
}

export function conjuntoDoCavalo(placa: string | undefined): ConjuntoRodotrem | undefined {
  return CONJUNTOS_RODOTREM[(placa ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')]
}

const DOLLYS_DOS_CONJUNTOS = new Set(Object.values(CONJUNTOS_RODOTREM).map((c) => c.dolly))

/** Dollys cadastrados como "REBOQUE" só são reconhecidos pela lista de conjuntos. */
export function ehDollyDeConjunto(placa: string | undefined): boolean {
  return DOLLYS_DOS_CONJUNTOS.has((placa ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''))
}
