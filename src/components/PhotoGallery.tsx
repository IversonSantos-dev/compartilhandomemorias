import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Edit3, Heart, Share2, MoreVertical, Loader2, X, User, Clock, Download, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';

interface Photo {
  id: string;
  image_url: string;
  caption: string | null;
  user_id: string;
  created_at: string;
  guest_name?: string | null;
  reactions?: Record<string, number> | any;
}

export const PhotoGallery: React.FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<Photo | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    fetchPhotos();
    getCurrentUser();

    // Subscribe to changes
    const channel = supabase
      .channel('photos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setPhotos(prev => prev.map(p => 
            p.id === payload.new.id ? { ...p, ...payload.new } : p
          ));
        } else {
          fetchPhotos();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchPhotos = async () => {
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPhotos(data || []);
    } catch (err: any) {
      console.error("Error fetching photos:", err);
    } finally {
      setLoading(false);
    }
  };

  const deletePhoto = async (photo: Photo) => {
    if (!window.confirm("Deseja excluir este momento?")) return;
    
    try {
      // 1. Delete from Storage
      const path = photo.image_url.split('/photos/')[1];
      await supabase.storage.from('photos').remove([path]);

      // 2. Delete from Database
      const { error } = await supabase
        .from('photos')
        .delete()
        .eq('id', photo.id);

      if (error) throw error;
      toast.success("Momento removido.");
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
    }
  };

  const handleReaction = async (photoId: string, emoji: string) => {
    try {
      const photo = photos.find(p => p.id === photoId);
      if (!photo) return;

      const currentReactions = { ...(photo.reactions || {}) };
      currentReactions[emoji] = (currentReactions[emoji] || 0) + 1;

      const { error } = await supabase
        .from('photos')
        .update({ reactions: currentReactions })
        .eq('id', photoId);

      if (error) throw error;
      
      setPhotos(prev => prev.map(p => 
        p.id === photoId ? { ...p, reactions: currentReactions } : p
      ));
    } catch (err: any) {
      console.error("Error reacting:", err);
    }
  };

  const downloadImage = async (imageUrl: string, fileName: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'photo';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading photo:", err);
      toast.error("Erro ao baixar foto.");
    }
  };

  const handleDownloadSelected = async () => {
    if (selectedPhotos.length === 0) return;
    setIsDownloading(true);
    toast.info(`Iniciando download de ${selectedPhotos.length} fotos...`);

    try {
      for (const photoId of selectedPhotos) {
        const photo = photos.find(p => p.id === photoId);
        if (photo) {
          const extension = photo.image_url.split('.').pop()?.split('?')[0] || 'jpg';
          const fileName = `foto-${photoId}.${extension}`;
          await downloadImage(photo.image_url, fileName);
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      toast.success("Downloads concluídos!");
      setIsSelectionMode(false);
      setSelectedPhotos([]);
    } catch (err) {
      toast.error("Erro no download múltiplo.");
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleSelectPhoto = (id: string) => {
    setSelectedPhotos(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setSelectedPhotos([]);
    }
    setIsSelectionMode(!isSelectionMode);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="aspect-[4/5] animate-pulse rounded-3xl bg-gray-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-widest text-white/50">Mural de Momentos</h2>
        <div className="flex items-center gap-2">
          {isSelectionMode && (
            <button
              onClick={handleDownloadSelected}
              disabled={selectedPhotos.length === 0 || isDownloading}
              className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-blue-700 disabled:opacity-50"
            >
              {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Salvar Selecionadas ({selectedPhotos.length})
            </button>
          )}
          <button
            onClick={toggleSelectionMode}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all ${
              isSelectionMode 
                ? "bg-white/20 text-white ring-1 ring-white/30" 
                : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
            }`}
          >
            {isSelectionMode ? "Cancelar" : "Selecionar Vários"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <AnimatePresence>
          {photos.map((photo, index) => (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                y: 0,
                boxShadow: index === 0 && !isSelectionMode ? "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" : "0 1px 2px 0 rgb(0 0 0 / 0.05)"
              }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ 
                duration: 0.4,
                ease: "easeOut"
              }}
              onClick={() => isSelectionMode ? toggleSelectPhoto(photo.id) : setSelectedMedia(photo)}
              className={`group relative aspect-square cursor-pointer overflow-hidden rounded-3xl bg-white ring-1 ring-black/5 transition-all hover:shadow-lg ${index === 0 && !isSelectionMode ? 'ring-2 ring-black/10 z-10' : ''} ${selectedPhotos.includes(photo.id) ? 'ring-4 ring-blue-500 shadow-blue-500/20' : ''}`}
            >
              {isSelectionMode && (
                <div className="absolute top-4 left-4 z-30">
                  {selectedPhotos.includes(photo.id) ? (
                    <CheckCircle2 size={24} className="text-blue-500 fill-white" />
                  ) : (
                    <Circle size={24} className="text-white/50 fill-black/20" />
                  )}
                </div>
              )}
              <div className="absolute inset-0">
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
                    alt={photo.caption || "Shared moment"}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                )}
              </div>
              
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                {photo.caption && (
                  <p className="mb-1 text-xs font-bold text-white line-clamp-2">{photo.caption}</p>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <User size={10} className="text-white/70" />
                    <span className="truncate text-[10px] font-black uppercase tracking-tighter text-white">
                      {photo.guest_name || 'Usuário'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {Object.entries(photo.reactions || {}).slice(0, 3).map(([emoji, count]) => (
                        <span key={emoji} className="text-[10px] text-white/90">{emoji} {(count as number)}</span>
                      ))}
                    </div>
                    <span className="shrink-0 text-[10px] font-medium text-white/60">
                      {new Date(photo.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reactions Overlay */}
              {!isSelectionMode && (
                <div className="absolute top-2 left-2 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 z-20">
                  {['❤️', '😊', '🎉'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReaction(photo.id, emoji);
                      }}
                      className="rounded-full bg-white/20 p-1.5 text-xs backdrop-blur-md ring-1 ring-white/30 transition-transform hover:scale-125 active:scale-90"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1 backdrop-blur-md group-hover:hidden">
                <Clock size={10} className="text-white/80" />
                <span className="text-[9px] font-bold text-white uppercase tracking-tighter">
                  {new Date(photo.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Actions - Glassmorphism */}
              {!isSelectionMode && (
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 z-20">
                  <div className="flex gap-1 rounded-full bg-white/20 p-1 backdrop-blur-md ring-1 ring-white/30">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        const extension = photo.image_url.split('.').pop()?.split('?')[0] || 'jpg';
                        downloadImage(photo.image_url, `foto-${photo.id}.${extension}`);
                      }}
                      className="rounded-full p-2 text-white transition-colors hover:bg-blue-500/50"
                      title="Baixar foto"
                    >
                      <Download size={18} />
                    </button>
                    {currentUserId === photo.user_id && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePhoto(photo);
                        }}
                        className="rounded-full p-2 text-white transition-colors hover:bg-red-500/50"
                        title="Excluir foto"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* Media Modal - View full image/video */}
      <AnimatePresence>
        {selectedMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl"
            onClick={() => setSelectedMedia(null)}
          >
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute right-6 top-6 z-10 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
              onClick={() => setSelectedMedia(null)}
            >
              <X size={24} />
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
                      <User size={14} className="text-gray-400" />
                      <span className="text-sm font-black uppercase tracking-tighter text-gray-300">
                        {selectedMedia.guest_name || 'Usuário'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <button
                      onClick={() => {
                        const extension = selectedMedia.image_url.split('.').pop()?.split('?')[0] || 'jpg';
                        downloadImage(selectedMedia.image_url, `foto-${selectedMedia.id}.${extension}`);
                      }}
                      className="flex items-center gap-2 rounded-full bg-white px-6 py-2 text-sm font-black text-black transition-transform hover:scale-105 active:scale-95"
                    >
                      <Download size={18} />
                      SALVAR FOTO
                    </button>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                      <Clock size={12} />
                      <span>{new Date(selectedMedia.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {photos.length === 0 && (
        <div className="col-span-full py-20 text-center">
          <p className="text-gray-400 font-medium italic">Nenhum momento compartilhado ainda.</p>
        </div>
      )}
    </div>
  );
};