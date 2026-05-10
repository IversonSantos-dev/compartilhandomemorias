import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Upload as UploadIcon, Image as ImageIcon, Loader2, CheckCircle2, ArrowLeft, X as CloseIcon, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'sonner';
import confetti from 'canvas-confetti';
import { CameraCapture } from '@/components/CameraCapture';

interface Photo {
  id: string;
  image_url: string;
  created_at: string;
  caption: string | null;
}

export const Route = createFileRoute("/share/$token")({
  component: PublicUpload,
});

function PublicUpload() {
  const { token } = useParams({ from: '/share/$token' });
  const [loading, setLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [ownerInfo, setOwnerInfo] = useState<any>(null);

  useEffect(() => {
    const validateToken = async () => {
      try {
        const { data, error } = await supabase
          .from('shared_links')
          .select('*, owner:profiles(display_name)')
          .eq('token', token)
          .eq('is_active', true)
          .maybeSingle();

        if (error || !data) {
          setIsValid(false);
        } else {
          setIsValid(true);
          setOwnerInfo(data.owner);
        }
      } catch (err) {
        setIsValid(false);
      } finally {
        setLoading(false);
      }
    };
    validateToken();
  }, [token]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setIsUploading(true);
    setUploadProgress(10);
    try {
      const fileName = `public/${token}/${Date.now()}-${file.name}`;
      
      const { data, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;
      
      setUploadProgress(60);

      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      const { data: ownerData, error: ownerError } = await supabase
        .from('shared_links')
        .select('owner_id')
        .eq('token', token)
        .single();

      if (ownerError || !ownerData) throw new Error("Owner not found");

      const { error: dbError } = await supabase
        .from('photos')
        .insert({
          user_id: ownerData.owner_id,
          image_url: publicUrl,
          caption: "Public Upload",
          share_token: token
        });

      if (dbError) throw dbError;

      setUploadProgress(100);
      toast.success("Foto enviada com sucesso!");
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
      
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 1000);
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F9F9]">
        <Loader2 className="animate-spin text-black" size={40} />
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9F9F9] p-6 text-center">
        <div className="mb-6 rounded-full bg-red-50 p-6 text-red-500">
          <CloseIcon size={48} />
        </div>
        <h1 className="text-2xl font-black tracking-tighter text-black">Link Inválido ou Expirado</h1>
        <p className="mt-2 text-gray-500">Este link de compartilhamento não está mais ativo.</p>
        <Link to="/" className="mt-8 font-bold text-black underline underline-offset-4">
          Voltar para Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] font-sans pb-12">
      <Toaster position="top-center" richColors />
      
      <header className="px-6 py-8">
        <Link to="/" className="flex items-center gap-2 text-sm font-bold text-gray-400 transition-colors hover:text-black">
          <ArrowLeft size={16} />
          <span>Início</span>
        </Link>
      </header>

      <main className="mx-auto max-w-lg px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl font-black tracking-tighter text-black">
            Contribuir com a Galeria
          </h1>
          <p className="mt-4 text-lg font-medium text-gray-500">
            Envie suas fotos para a pasta compartilhada.
          </p>
        </motion.div>

        <div className="mt-12 flex flex-col items-center gap-6">
          <button
            onClick={() => setIsCameraOpen(true)}
            disabled={isUploading}
            className="group flex w-full items-center justify-center gap-4 rounded-[2.5rem] bg-black py-8 text-2xl font-black text-white shadow-2xl shadow-black/20 transition-all hover:bg-gray-800 active:scale-95 disabled:opacity-50"
          >
            <Camera className="transition-transform group-hover:rotate-12" size={32} />
            Capturar Foto
          </button>

          <label className="flex w-full cursor-pointer items-center justify-center gap-4 rounded-[2.5rem] bg-white py-6 text-xl font-bold text-black ring-1 ring-black/5 shadow-xl transition-all hover:bg-gray-50 active:scale-95">
            <UploadIcon size={24} />
            Escolher Arquivo
            <input 
              type="file" 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </label>

          <AnimatePresence>
            {isUploading && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="w-full space-y-4 rounded-[2rem] bg-white p-6 shadow-xl ring-1 ring-black/5"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-black">
                    <Loader2 className="animate-spin" size={16} />
                    Enviando Momento
                  </span>
                  <span className="text-sm font-bold text-black">{uploadProgress}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                  <motion.div 
                    className="h-full bg-black"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ type: "spring", stiffness: 50, damping: 20 }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-16 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
            <CheckCircle2 size={16} />
            <span>Link Seguro Ativado</span>
          </div>
          <p className="mt-4 text-xs font-medium text-gray-400 leading-relaxed px-4">
            Suas fotos serão enviadas diretamente para a galeria do organizador. 
            Nenhuma conta é necessária.
          </p>
        </div>
      </main>

      <CameraCapture 
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(url) => {
          confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 }
          });
        }}
      />
    </div>
  );
};