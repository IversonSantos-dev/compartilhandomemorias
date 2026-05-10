import React, { useState, useRef, useCallback } from 'react';
import { Camera, X, Upload, Check, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CameraCaptureProps {
  onCapture: (url: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, isOpen, onClose }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' },
        audio: false 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      toast.error("Permissão de câmera negada ou câmera não encontrada.");
      onClose();
    }
  }, [onClose]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  React.useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado para postar fotos.");
        setIsUploading(false);
        return;
      }

      const fileName = `${user.id}/${Date.now()}.jpg`;
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
          user_id: user.id,
          image_url: publicUrl,
          caption: ""
        });

      if (dbError) throw dbError;

      toast.success("Momento capturado!");
      onCapture(publicUrl);
      onClose();
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
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
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 rounded-full bg-black/20 p-2 text-white transition-colors hover:bg-black/40"
            >
              <X size={20} />
            </button>

            <div className="relative aspect-[3/4] w-full bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
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

            <div className="flex items-center justify-center p-8">
              <button
                onClick={capturePhoto}
                disabled={isUploading}
                className="group relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-gray-200 p-1 transition-all active:scale-95 disabled:opacity-50"
              >
                <div className="h-full w-full rounded-full bg-black group-hover:scale-110 transition-transform flex items-center justify-center">
                  <Camera className="text-white" size={32} />
                </div>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
