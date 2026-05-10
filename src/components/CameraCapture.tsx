import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, X, Upload, Check, Loader2, RefreshCw, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CameraCaptureProps {
  onCapture: (url: string) => void;
  isOpen: boolean;
  onClose: () => void;
  shareToken?: string;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, isOpen, onClose, shareToken }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = useCallback(async () => {
    // Parar stream anterior se existir
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode },
        audio: true 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("Erro ao acessar a câmera. Verifique as permissões.");
    }
  }, [facingMode]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, facingMode]); // Reinicia quando o modo de câmera muda

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      await uploadPhoto(blob);
    }, 'image/jpeg', 0.8);
  };

  const uploadPhoto = async (blob: Blob) => {
    setIsUploading(true);
    try {
      let userId: string | null = null;
      
      if (shareToken) {
        // Se houver shareToken, pegamos o owner_id do link
        const { data: linkData, error: linkError } = await supabase
          .from('shared_links')
          .select('owner_id')
          .eq('token', shareToken)
          .single();
        
        if (linkError || !linkData) throw new Error("Link compartilhado inválido.");
        userId = linkData.owner_id;
      } else {
        // Caso contrário, usamos o usuário logado
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Você precisa estar logado para capturar fotos.");
        userId = user.id;
      }

      const fileName = `${shareToken ? 'public/' + shareToken : userId}/${Date.now()}.jpg`;
      const { data, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('photos')
        .insert({
          user_id: userId,
          image_url: publicUrl,
          caption: shareToken ? "Captura Pública" : "Captura Direta",
          share_token: shareToken || null,
          guest_name: shareToken ? "Convidado (Câmera)" : null
        });

      if (dbError) throw dbError;

      toast.success("Momento capturado!");
      onCapture(publicUrl);
      onClose();
    } catch (err: any) {
      toast.error("Erro ao salvar foto: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <button
                onClick={toggleCamera}
                className="rounded-full bg-black/20 p-2 text-white transition-colors hover:bg-black/40 backdrop-blur-md"
                title="Trocar Câmera"
              >
                <RefreshCw size={20} />
              </button>
              <button
                onClick={onClose}
                className="rounded-full bg-black/20 p-2 text-white transition-colors hover:bg-black/40 backdrop-blur-md"
              >
                <X size={20} />
              </button>
            </div>

            <div className="relative aspect-[3/4] w-full bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {isUploading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                  <Loader2 className="h-10 w-10 animate-spin text-white" />
                  <p className="mt-2 font-medium text-white">Enviando seu momento...</p>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center justify-center p-8 bg-white gap-4">
              {isRecording && (
                <div className="flex items-center gap-2 text-red-500 font-bold animate-pulse">
                  <Circle size={12} fill="currentColor" />
                  <span>GRAVANDO...</span>
                </div>
              )}
              
              <button
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                disabled={isUploading}
                className="group relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-gray-100 p-1 transition-all hover:border-black/5 active:scale-90 disabled:opacity-50"
              >
                <div className={`h-full w-full rounded-full ${isRecording ? 'bg-red-500 scale-90' : 'bg-black'} group-hover:bg-gray-800 transition-all flex items-center justify-center shadow-xl`}>
                  {isRecording ? (
                    <div className="h-8 w-8 rounded-sm bg-white" />
                  ) : (
                    <Camera className="text-white" size={36} />
                  )}
                </div>
                
                {/* Progress Ring for recording hint */}
                {!isRecording && !isUploading && (
                  <svg className="absolute inset-0 h-full w-full -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="44"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-gray-100"
                    />
                  </svg>
                )}
              </button>
              
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {isRecording ? "Solte para parar" : "Toque para foto • Segure para vídeo"}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
