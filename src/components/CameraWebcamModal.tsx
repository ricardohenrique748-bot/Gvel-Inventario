import { useEffect, useRef, useState } from 'react'
import { Camera, X, RefreshCw, AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface CameraWebcamModalProps {
  titulo?: string
  subtitulo?: string
  onCapture: (file: File, url: string) => void
  onClose: () => void
}

export function CameraWebcamModal({
  titulo = 'Câmera',
  subtitulo = 'Posicione a pessoa ou item no centro e clique em Capturar Foto',
  onCapture,
  onClose,
}: CameraWebcamModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [iniciando, setIniciando] = useState(true)
  const [dispositivos, setDispositivos] = useState<MediaDeviceInfo[]>([])
  const [dispositivoIdAtual, setDispositivoIdAtual] = useState<string>('')
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [previewCapturado, setPreviewCapturado] = useState<string | null>(null)
  const [blobCapturado, setBlobCapturado] = useState<Blob | null>(null)

  // Lista todos os dispositivos de vídeo conectados
  const carregarDispositivos = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devs = await navigator.mediaDevices.enumerateDevices()
        const videoDevs = devs.filter((d) => d.kind === 'videoinput')
        setDispositivos(videoDevs)
      }
    } catch (e) {
      console.warn('Erro ao enumerar câmeras:', e)
    }
  }

  // Inicia o stream da câmera
  const iniciarCamera = async (deviceId?: string, modo: 'user' | 'environment' = facingMode) => {
    setIniciando(true)
    setErro(null)

    // Para o stream anterior se existir
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Câmera não suportada neste navegador.')
      }

      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: modo,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
        audio: false,
      }

      let mediaStream: MediaStream
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch {
        // Fallback genérico
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      }

      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play()
      }

      // Atualiza lista de câmeras após permissão concedida
      await carregarDispositivos()
    } catch (err: any) {
      console.error('Erro ao acessar câmera:', err)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErro('Permissão de acesso à câmera negada. Por favor, autorize o uso da câmera no navegador.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErro('Nenhuma câmera foi encontrada conectada neste dispositivo.')
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setErro('A câmera já está sendo usada por outro aplicativo.')
      } else {
        setErro('Não foi possível iniciar a câmera. Verifique as permissões.')
      }
    } finally {
      setIniciando(false)
    }
  }

  useEffect(() => {
    iniciarCamera(dispositivoIdAtual || undefined, facingMode)

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [dispositivoIdAtual, facingMode])

  // Desliga tracks ao desmontar
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [stream])

  const alternarCamera = () => {
    if (dispositivos.length > 1) {
      // Alterna ciclicamente entre todos os dispositivos encontrados
      const currentIndex = dispositivos.findIndex((d) => d.deviceId === dispositivoIdAtual)
      const nextIndex = (currentIndex + 1) % dispositivos.length
      setDispositivoIdAtual(dispositivos[nextIndex].deviceId)
    } else {
      // Alterna entre frontal e traseira no celular
      setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
    }
  }

  const tirarFoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    const width = video.videoWidth || 640
    const height = video.videoHeight || 480

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Se for câmera frontal (user), espelha horizontalmente para visualização natural
    if (facingMode === 'user') {
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
    }

    ctx.drawImage(video, 0, 0, width, height)

    canvas.toBlob(
      (blob) => {
        if (!blob) return
        setBlobCapturado(blob)
        setPreviewCapturado(URL.createObjectURL(blob))
      },
      'image/jpeg',
      0.85
    )
  }

  const confirmarFoto = () => {
    if (!blobCapturado || !previewCapturado) return

    const file = new File([blobCapturado], `webcam_${Date.now()}.jpg`, {
      type: 'image/jpeg',
    })

    // Para o stream da câmera
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }

    onCapture(file, previewCapturado)
    onClose()
  }

  const tirarOutra = () => {
    setPreviewCapturado(null)
    setBlobCapturado(null)
    if (videoRef.current && stream) {
      videoRef.current.play()
    }
  }

  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-border/20 bg-surface shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-border/10 px-5 py-3.5 bg-surface/90">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-foreground uppercase">{titulo}</h2>
              <p className="text-[10px] sm:text-[11px] text-secondary">{subtitulo}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl p-1.5 text-secondary hover:bg-background hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Área Central de Vídeo / Preview */}
        <div className="p-4 flex flex-col items-center justify-center bg-black/90 relative min-h-[320px] overflow-hidden">
          {erro ? (
            <div className="p-6 text-center text-red-400 space-y-3">
              <AlertCircle className="h-10 w-10 mx-auto opacity-80" />
              <p className="text-xs font-bold uppercase">{erro}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => iniciarCamera(facingMode)}
                className="text-xs uppercase font-bold"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Tentar Novamente
              </Button>
            </div>
          ) : previewCapturado ? (
            <div className="relative w-full h-[320px] rounded-xl overflow-hidden border border-primary/40 bg-black flex items-center justify-center">
              <img
                src={previewCapturado}
                alt="Foto Capturada"
                className="max-w-full max-h-full object-contain"
              />
              <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-black text-emerald-400 uppercase">
                ✓ Foto Tirada
              </div>
            </div>
          ) : (
            <div className="relative w-full h-[320px] rounded-xl overflow-hidden border border-border/30 bg-black flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
              />
              {iniciando && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-bold text-white uppercase">
                  Iniciando Câmera do Notebook...
                </div>
              )}
              {/* Moldura de enquadramento */}
              <div className="absolute inset-4 border-2 border-white/20 border-dashed rounded-xl pointer-events-none flex items-center justify-center">
                <span className="text-[10px] font-black text-white/50 bg-black/40 px-2 py-0.5 rounded uppercase">
                  Enquadre o rosto / pessoa aqui
                </span>
              </div>
            </div>
          )}

          {/* Canvas oculto para tirar a foto */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Rodapé e Ações */}
        <div className="p-4 border-t border-border/15 bg-surface flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {!previewCapturado && !erro && (
              <Button
                type="button"
                variant="secondary"
                onClick={alternarCamera}
                title="Alternar Câmera"
                className="!h-10 px-3 text-xs uppercase font-bold"
              >
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Trocar Câmera
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              className="!h-10 px-4 text-xs font-semibold uppercase"
            >
              Cancelar
            </Button>

            {previewCapturado ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={tirarOutra}
                  className="!h-10 px-4 text-xs font-bold uppercase"
                >
                  Tirar Outra
                </Button>
                <Button
                  type="button"
                  onClick={confirmarFoto}
                  className="!h-10 px-5 text-xs font-bold uppercase bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  Usar Esta Foto
                </Button>
              </>
            ) : (
              <Button
                type="button"
                onClick={tirarFoto}
                disabled={iniciando || Boolean(erro)}
                className="!h-10 px-6 text-xs font-bold uppercase bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 flex items-center gap-2"
              >
                <Camera className="h-4 w-4" />
                Capturar Foto
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
