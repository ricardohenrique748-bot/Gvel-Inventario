// Animação de entrada dos gráficos de barras (Recharts).
//
// As barras crescem em cascata via CSS (.recharts-bar-rectangle em index.css),
// mas a animação fica pausada até o gráfico aparecer na tela — assim quem rola
// a página até um gráfico lá embaixo ainda vê ele animar. Aqui só marcamos
// cada `.recharts-wrapper` com data-visible quando ele entra na tela.
// A animação nativa do Recharts está desligada nas <Bar> (isAnimationActive={false})
// pra não animar duas vezes.

const SELETOR = '.recharts-wrapper'

export function iniciarRevelacaoGraficos() {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    document.documentElement.classList.add('graficos-sem-observer')
    return
  }

  const io = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting) {
          ;(e.target as HTMLElement).dataset.visible = 'true'
          io.unobserve(e.target)
        }
      }
    },
    { threshold: 0.25 },
  )

  const observar = (raiz: ParentNode) => {
    raiz.querySelectorAll<HTMLElement>(`${SELETOR}:not([data-visible])`).forEach((el) => io.observe(el))
  }

  observar(document)
  new MutationObserver((mudancas) => {
    for (const m of mudancas) {
      m.addedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement)) return
        if (n.matches(SELETOR) && !n.dataset.visible) io.observe(n)
        else observar(n)
      })
    }
  }).observe(document.body, { childList: true, subtree: true })
}
