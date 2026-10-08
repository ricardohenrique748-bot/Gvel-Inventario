import type { AnguloFoto } from '@/lib/fotos'

// Silhueta de cavalo mecânico mostrando de que ângulo tirar cada foto do
// checklist da frota pesada. Usa currentColor, então segue a cor do botão
// (cinza parado, cor primária no hover) nos temas claro e escuro.
// Lado esquerdo = frente do caminhão à esquerda da foto (quem fotografa está
// do lado do motorista); lado direito é o espelho.

function Lateral() {
  return (
    <>
      {/* cabine + janela */}
      <rect x="6" y="8" width="20" height="20" rx="2" />
      <rect x="9" y="11" width="8" height="6" rx="1" />
      <path d="M4 28h2" />
      {/* escapamento */}
      <path d="M28 6v18" />
      {/* chassi + quinta roda */}
      <path d="M26 26h32" />
      <rect x="40" y="22" width="10" height="4" rx="1" />
      {/* rodas */}
      <circle cx="14" cy="31" r="4" />
      <circle cx="42" cy="31" r="4" />
      <circle cx="52" cy="31" r="4" />
    </>
  )
}

const DESENHOS: Record<AnguloFoto, React.ReactNode> = {
  frente: (
    <>
      <path d="M12 12h4M48 12h4" />
      <rect x="16" y="6" width="32" height="24" rx="3" />
      <rect x="20" y="9" width="24" height="9" rx="1.5" />
      <path d="M26 21h12M26 24h12" />
      <rect x="18" y="22" width="4" height="3" rx="0.5" />
      <rect x="42" y="22" width="4" height="3" rx="0.5" />
      <rect x="14" y="30" width="36" height="3" rx="1" />
      <rect x="17" y="33" width="6" height="5" rx="1" />
      <rect x="41" y="33" width="6" height="5" rx="1" />
    </>
  ),
  ladoEsquerdo: <Lateral />,
  ladoDireito: (
    <g transform="matrix(-1 0 0 1 64 0)">
      <Lateral />
    </g>
  ),
  traseira: (
    <>
      <rect x="18" y="4" width="28" height="15" rx="2" />
      <ellipse cx="32" cy="21" rx="7" ry="2" />
      <rect x="22" y="23" width="20" height="4" rx="1" />
      <rect x="9" y="22" width="11" height="13" rx="2" />
      <rect x="44" y="22" width="11" height="13" rx="2" />
      <path d="M14.5 22v13M49.5 22v13" />
      <rect x="25" y="29" width="3" height="2" rx="0.5" />
      <rect x="36" y="29" width="3" height="2" rx="0.5" />
    </>
  ),
  painel: (
    <>
      {/* painel com dois mostradores + volante */}
      <path d="M4 14Q32 2 60 14" />
      <circle cx="17" cy="13" r="4" />
      <circle cx="47" cy="13" r="4" />
      <path d="M17 13l2-2M47 13l-2-2" />
      <circle cx="32" cy="27" r="11" />
      <circle cx="32" cy="27" r="2.5" />
      <path d="M21 27h8.5M34.5 27H43M32 29.5V38" />
    </>
  ),
}

// ---------- Carreta (semirreboque) ----------
export type AnguloCarreta = 'frente' | 'ladoEsquerdo' | 'traseira' | 'ladoDireito'

export const FOTOS_CARRETA: { angulo: AnguloCarreta; rotulo: string }[] = [
  { angulo: 'frente', rotulo: 'FRENTE' },
  { angulo: 'ladoEsquerdo', rotulo: 'LADO ESQ.' },
  { angulo: 'traseira', rotulo: 'TRASEIRA' },
  { angulo: 'ladoDireito', rotulo: 'LADO DIR.' },
]

function LateralCarreta() {
  return (
    <>
      {/* baú, pino-rei à esquerda (frente), pé de apoio e três eixos atrás */}
      <rect x="4" y="6" width="56" height="20" rx="1.5" />
      <path d="M8 26v3M8 29h6M16 26v6M14 32h4" />
      <circle cx="40" cy="31" r="4" />
      <circle cx="49" cy="31" r="4" />
      <circle cx="58" cy="31" r="4" />
    </>
  )
}

const DESENHOS_CARRETA: Record<AnguloCarreta, React.ReactNode> = {
  frente: (
    <>
      <rect x="12" y="4" width="40" height="24" rx="1.5" />
      <path d="M12 22h40" />
      <circle cx="32" cy="31" r="2" />
      <path d="M18 28v8M46 28v8M15 36h6M43 36h6" />
    </>
  ),
  ladoEsquerdo: <LateralCarreta />,
  ladoDireito: (
    <g transform="matrix(-1 0 0 1 64 0)">
      <LateralCarreta />
    </g>
  ),
  traseira: (
    <>
      <rect x="12" y="3" width="40" height="25" rx="1.5" />
      <path d="M32 3v25M28 12v6M36 12v6" />
      <rect x="14" y="24" width="3" height="2" rx="0.5" />
      <rect x="47" y="24" width="3" height="2" rx="0.5" />
      <rect x="10" y="29" width="11" height="9" rx="2" />
      <rect x="43" y="29" width="11" height="9" rx="2" />
    </>
  ),
}

export function GuiaFotoCarreta({ angulo, className }: { angulo: AnguloCarreta; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 40"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {DESENHOS_CARRETA[angulo]}
    </svg>
  )
}

export function GuiaFotoCavalo({ angulo, className }: { angulo: AnguloFoto; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 40"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {DESENHOS[angulo]}
    </svg>
  )
}
