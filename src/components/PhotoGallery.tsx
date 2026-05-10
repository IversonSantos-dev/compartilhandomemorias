import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Edit3, Heart, Share2, MoreVertical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Photo {
  id: string;
  image_url: string;
  caption: string | null;
  user_id: string;
  created_at: string;
}

export const PhotoGallery: React.FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="aspect-[4/5] animate-pulse rounded-3xl bg-gray-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="columns-1 gap-6 space-y-6 sm:columns-2 lg:columns-3">
      <AnimatePresence>
        {photos.map((photo, index) => (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ delay: index * 0.05 }}
            className="group relative break-inside-avoid overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 transition-all hover:shadow-md"
          >
            <img
              src={photo.image_url}
              alt={photo.caption || "Shared moment"}
              className="w-full object-cover"
              loading="lazy"
            />
            
            {/* Owner Actions - Glassmorphism */}
            {currentUserId === photo.user_id && (
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex gap-1 rounded-full bg-white/20 p-1 backdrop-blur-md ring-1 ring-white/30">
                  <button 
                    onClick={() => deletePhoto(photo)}
                    className="rounded-full p-2 text-white transition-colors hover:bg-red-500/50"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )}

            <div className="p-4">
              {photo.caption && (
                <p className="text-sm font-medium text-gray-800">{photo.caption}</p>
              )}
              <p className="mt-1 text-xs text-gray-400">
                {new Date(photo.created_at).toLocaleDateString('pt-BR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      
      {photos.length === 0 && (
        <div className="col-span-full py-20 text-center">
          <p className="text-gray-400 font-medium italic">Nenhum momento compartilhado ainda.</p>
        </div>
      )}
    </div>
  );
};
