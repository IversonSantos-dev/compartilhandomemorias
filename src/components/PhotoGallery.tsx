import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Edit3, Heart, Share2, MoreVertical, Loader2, X, User, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface Photo {
  id: string;
  image_url: string;
  caption: string | null;
  user_id: string;
  created_at: string;
  guest_name?: string | null;
}

export const PhotoGallery: React.FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<Photo | null>(null);

  useEffect(() => {
    fetchPhotos();
    getCurrentUser();

    // Subscribe to changes
    const channel = supabase
      .channel('photos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'photos' }, () => {
        fetchPhotos();
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPhotos([]);
        return;
      }

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
              boxShadow: index === 0 ? "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" : "0 1px 2px 0 rgb(0 0 0 / 0.05)"
            }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ 
              duration: 0.4,
              ease: "easeOut"
            }}
            onClick={() => setSelectedMedia(photo)}
            className={`group relative aspect-square cursor-pointer overflow-hidden rounded-3xl bg-white ring-1 ring-black/5 transition-all hover:shadow-lg ${index === 0 ? 'ring-2 ring-black/10 z-10' : ''}`}
          >
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

            {/* Owner Actions - Glassmorphism */}
            {currentUserId === photo.user_id && (
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100 z-20">
                <div className="flex gap-1 rounded-full bg-white/20 p-1 backdrop-blur-md ring-1 ring-white/30">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePhoto(photo);
                    }}
                    className="rounded-full p-2 text-white transition-colors hover:bg-red-500/50"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      
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

      {photos.length === 0 && (
        <div className="col-span-full py-20 text-center">
          <p className="text-gray-400 font-medium italic">Nenhum momento compartilhado ainda.</p>
        </div>
      )}
    </div>
  );
};
