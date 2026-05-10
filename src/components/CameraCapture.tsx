import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, X, Upload, Check, Loader2, RefreshCw, Circle, RotateCcw } from 'lucide-react';
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
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'video' | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startCamera = useCallback(async () => {
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
    if (isOpen && !previewUrl) {
      startCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, facingMode, previewUrl]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const uploadMedia = async () => {
    if (!previewBlob || !previewType) return;
    
    setIsUploading(true);
    try {
      let userId: string | null = null;
      
      if (shareToken) {
        const { data: linkData, error: linkError } = await supabase
          .from('shared_links')
          .select('owner_id')
          .eq('token', shareToken)
          .single();
        
        if (linkError || !linkData) throw new Error("Link compartilhado inválido.");
        userId = linkData.owner_id;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Você precisa estar logado para capturar.");
        userId = user.id;
      }

      const ext = previewType === 'image' ? 'jpg' : 'mp4';
      const fileName = `${shareToken ? 'public/' + shareToken : userId}/${Date.now()}.${ext}`;
      
      const { data, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, previewBlob, {
          contentType: previewType === 'image' ? 'image/jpeg' : 'video/mp4'
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('photos')
        .insert({
          user_id: userId,
          image_url: publicUrl,
          caption: shareToken ? `Captura Pública (${previewType === 'image' ? 'Foto' : 'Vídeo'})` : `Captura Direta (${previewType === 'image' ? 'Foto' : 'Vídeo'})`,
          share_token: shareToken || null,
          guest_name: shareToken ? "Convidado (Câmera)" : null
        });

      if (dbError) throw dbError;

      toast.success(previewType === 'image' ? "Foto enviada!" : "Vídeo enviado!");
      onCapture(publicUrl);
      setTimeout(() => {
        window.location.reload();
      }, 500);
      handleClose();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewBlob(null);
    setPreviewType(null);
    onClose();
  };

  const discardPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewBlob(null);
    setPreviewType(null);
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
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewBlob(blob);
      setPreviewType('image');
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    }, 'image/jpeg', 0.8);
  };

  const startRecording = () => {
    if (!stream) return;
    
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewBlob(blob);
      setPreviewType('video');
      
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
    
    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handlePointerDown = () => {
    if (previewUrl) return;
    pressTimerRef.current = setTimeout(() => {
      startRecording();
    }, 500);
  };

  const handlePointerUp = () => {
    if (previewUrl) return;
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }

    if (isRecording) {
      stopRecording();
    } else {
      capturePhoto();
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
              {!previewUrl && (
                <button
                  onClick={toggleCamera}
                  className="rounded-full bg-black/20 p-2 text-white transition-colors hover:bg-black/40 backdrop-blur-md"
                  title="Trocar Câmera"
                >
                  <RefreshCw size={20} />
                </button>
              )}
              <button
                onClick={handleClose}
                className="rounded-full bg-black/20 p-2 text-white transition-colors hover:bg-black/40 backdrop-blur-md"
              >
                <X size={20} />
              </button>
            </div>

            <div className="relative aspect-[3/4] w-full bg-black">
              {!previewUrl ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full">
                  {previewType === 'image' ? (
                    <img src={previewUrl} className="h-full w-full object-cover" alt="Preview" />
                  ) : (
                    <video
                      ref={previewVideoRef}
                      src={previewUrl}
                      autoPlay
                      loop
                      playsInline
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
              
              {isUploading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                  <Loader2 className="h-10 w-10 animate-spin text-white" />
                  <p className="mt-2 font-medium text-white">Enviando seu momento...</p>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center justify-center p-8 bg-white gap-4">
              {!previewUrl ? (
                <>
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
                  <AnimatePresence mode="wait">
                    {isRecording ? (
                      <motion.div 
                        key="stop"
                        initial={{ scale: 0, borderRadius: "2px" }}
                        animate={{ scale: 1, borderRadius: "4px" }}
                        exit={{ scale: 0 }}
                        className="h-8 w-8 bg-white" 
                      />
                    ) : (
                      <motion.div
                        key="camera"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className="flex flex-col items-center justify-center"
                      >
                        <Camera className="text-white" size={32} />
                        <motion.div 
                          animate={{ 
                            opacity: [0.4, 1, 0.4],
                            scale: [0.95, 1.05, 0.95]
                          }}
                          transition={{ 
                            duration: 2, 
                            repeat: Infinity,
                            ease: "easeInOut" 
                          }}
                          className="mt-1 flex items-center gap-1"
                        >
                          <div className="h-1 w-1 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.8)]" />
                          <span className="text-[7px] font-black tracking-widest text-white/60">HOLD</span>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                    
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
                </>
              ) : (
                <div className="flex w-full gap-4">
                  <button
                    onClick={discardPreview}
                    disabled={isUploading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gray-100 py-4 text-sm font-bold text-black transition-all hover:bg-gray-200 active:scale-95 disabled:opacity-50"
                  >
                    <RotateCcw size={18} />
                    <span>Tentar Novamente</span>
                  </button>
                  <button
                    onClick={uploadMedia}
                    disabled={isUploading}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-black py-4 text-sm font-bold text-white shadow-lg shadow-black/10 transition-all hover:bg-gray-800 active:scale-95 disabled:opacity-50"
                  >
                    <Upload size={18} />
                    <span>Enviar Agora</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
