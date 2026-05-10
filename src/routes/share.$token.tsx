import { createFileRoute, Link, useParams } from '@tanstack/react-router';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Upload as UploadIcon, Image as ImageIcon, Loader2, CheckCircle2, ArrowLeft, X as CloseIcon, Clock, Filter, Calendar, User as UserIcon, Type } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'sonner';
import confetti from 'canvas-confetti';
import { CameraCapture } from '@/components/CameraCapture';

interface Photo {
  id: string;
  image_url: string;
  created_at: string;
  caption: string | null;
  guest_name?: string | null;
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
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('all');
  const [guestNameInput, setGuestNameInput] = useState('');
  const [captionInput, setCaptionInput] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<Photo | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      try {
        const { data: linkData, error: linkError } = await supabase
          .from('shared_links')
          .select('*')
          .eq('token', token)
          .eq('is_active', true)
          .maybeSingle();

        if (linkError || !linkData) {
          setIsValid(false);
        } else {
          setIsValid(true);
          // Fetch owner info separately to avoid complex join issues
          const { data: profileData } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', linkData.owner_id)
            .maybeSingle();
          
          setOwnerInfo(profileData);
        }
      } catch (err) {
        setIsValid(false);
      } finally {
        setLoading(false);
      }
    };
    validateToken();
  }, [token]);

  const fetchSharedPhotos = async () => {
    if (!token) return;
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPhotos(data || []);
    } catch (err) {
      console.error("Error fetching shared photos:", err);
    } finally {
      setLoadingPhotos(false);
    }
  };

  useEffect(() => {
    if (isValid) {
      fetchSharedPhotos();

      // Real-time updates for the shared gallery
      const channel = supabase
        .channel(`public-photos-${token}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'photos',
          filter: `share_token=eq.${token}` 
        }, () => {
          fetchSharedPhotos();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isValid, token]);

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
          caption: captionInput || "Public Upload",
          share_token: token,
          guest_name: guestNameInput || "Convidado"
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
        window.location.reload();
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

        <div className="mt-8 space-y-4">
          <div className="flex flex-col gap-3 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={guestNameInput}
                onChange={(e) => setGuestNameInput(e.target.value)}
                placeholder="Seu nome (opcional)"
                className="w-full rounded-2xl bg-gray-50 py-3 pl-12 pr-4 text-sm font-medium text-black ring-1 ring-black/5 transition-all focus:bg-white focus:outline-none focus:ring-black/10"
              />
            </div>
            <div className="relative">
              <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={captionInput}
                onChange={(e) => setCaptionInput(e.target.value)}
                placeholder="Legenda da foto"
                className="w-full rounded-2xl bg-gray-50 py-3 pl-12 pr-4 text-sm font-medium text-black ring-1 ring-black/5 transition-all focus:bg-white focus:outline-none focus:ring-black/10"
              />
            </div>
          </div>

          <div className="flex flex-col items-center gap-6">
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
        </div>

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

        {/* Shared Gallery Section */}
        <section className="mt-20">
          <div className="mb-8 flex flex-col gap-6">
            <div className="flex items-center justify-center gap-3">
              <ImageIcon className="text-black" size={24} />
              <h3 className="text-xl font-black tracking-tight">Memórias dos Convidados</h3>
            </div>

            {/* Filtros e Contadores */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {[
                { id: 'all', label: 'Tudo', icon: Filter, count: photos.length },
                { id: 'today', label: 'Hoje', icon: Clock, count: photos.filter(p => new Date(p.created_at).toDateString() === new Date().toDateString()).length },
                { id: 'week', label: 'Semana', icon: Calendar, count: photos.filter(p => {
                  const date = new Date(p.created_at);
                  const now = new Date();
                  const diff = now.getTime() - date.getTime();
                  return diff <= 7 * 24 * 60 * 60 * 1000;
                }).length }
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setFilter(btn.id as any)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all active:scale-95 ${
                    filter === btn.id 
                      ? 'bg-black text-white shadow-lg shadow-black/10' 
                      : 'bg-white text-gray-500 ring-1 ring-black/5 hover:bg-gray-50'
                  }`}
                >
                  <btn.icon size={14} />
                  <span>{btn.label}</span>
                  <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${
                    filter === btn.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {btn.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {loadingPhotos ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-square animate-pulse rounded-3xl bg-gray-200" />
              ))}
            </div>
          ) : photos.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              <AnimatePresence>
                {photos
                  .filter(photo => {
                    if (filter === 'all') return true;
                    const date = new Date(photo.created_at);
                    if (filter === 'today') return date.toDateString() === new Date().toDateString();
                    if (filter === 'week') {
                      const now = new Date();
                      const diff = now.getTime() - date.getTime();
                      return diff <= 7 * 24 * 60 * 60 * 1000;
                    }
                    return true;
                  })
                  .map((photo) => (
                  <motion.div
                    key={photo.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => setSelectedMedia(photo)}
                    className="group relative aspect-square cursor-pointer overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5"
                  >
                    {photo.image_url.toLowerCase().endsWith('.mp4') ? (
                      <video
                        src={photo.image_url}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    ) : (
                      <img
                        src={photo.image_url}
                        alt="Shared moment"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                    )}
                    <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      {photo.caption && (
                        <p className="mb-1 text-xs font-bold text-white line-clamp-2">{photo.caption}</p>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <UserIcon size={10} className="text-white/70" />
                          <span className="truncate text-[10px] font-black uppercase tracking-tighter text-white">
                            {photo.guest_name || 'Convidado'}
                          </span>
                        </div>
                        <span className="shrink-0 text-[10px] font-medium text-white/60">
                          {new Date(photo.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1 backdrop-blur-md group-hover:hidden">
                      <Clock size={10} className="text-white/80" />
                      <span className="text-[9px] font-bold text-white uppercase tracking-tighter">
                        {new Date(photo.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-gray-200 py-12 text-center">
              <p className="text-sm font-medium text-gray-400">Nenhuma foto ainda. Seja o primeiro!</p>
            </div>
          )}
        </section>

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
        shareToken={token}
        onCapture={(url) => {
          confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 }
          });
          // A atualização da galeria já é tratada pelo canal em tempo real
        }}
      />

      {/* Media Modal - View full image/video */}
      <AnimatePresence>
        {selectedMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl"
            onClick={() => setSelectedMedia(null)}
          >
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute right-6 top-6 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
              onClick={() => setSelectedMedia(null)}
            >
              <CloseIcon size={24} />
            </motion.button>

            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-3xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedMedia.image_url.toLowerCase().endsWith('.mp4') ? (
                <video
                  src={selectedMedia.image_url}
                  className="max-h-[70vh] w-full object-contain"
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <img
                  src={selectedMedia.image_url}
                  alt="Full moment"
                  className="max-h-[70vh] w-full object-contain"
                />
              )}

              <div className="bg-black/40 p-6 backdrop-blur-md">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    {selectedMedia.caption && (
                      <p className="text-lg font-bold text-white">{selectedMedia.caption}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <UserIcon size={14} className="text-gray-400" />
                      <span className="text-sm font-black uppercase tracking-tighter text-gray-300">
                        {selectedMedia.guest_name || 'Convidado'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                    <Clock size={12} />
                    <span>{new Date(selectedMedia.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}