// TWAs (Trusted Web Activity) abrem a página com referrer "android-app://<package>",
// diferente de qualquer navegador ou PWA instalada via "Adicionar à tela inicial".
export function isTWA() {
  return typeof document !== 'undefined' && document.referrer.startsWith('android-app://')
}
