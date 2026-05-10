import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Upload, User, Layout, Save, X, Loader2, Scissors } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { ImageCropper } from './ImageCropper';

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  banner_focus_point: string | null;
}

interface UserProfileProps {
  userId: string;
  onUpdate?: () => void;
}

export const UserProfileSettings: React.FC<UserProfileProps> = ({ userId, onUpdate }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const [isAdjustingFocus, setIsAdjustingFocus] = useState(false);
  const [tempFocus, setTempFocus] = useState({ x: 50, y: 50 });
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropType, setCropType] = useState<'avatar' | 'banner'>('banner');

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProfile(data);
        setDisplayName(data.display_name || '');
        if (data.banner_focus_point) {
          const [x, y] = data.banner_focus_point.split(' ').map((v: string) => parseInt(v));
          setTempFocus({ x, y });
        }
      }
    } catch (err: any) {
      console.error("Error fetching profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
        })
        .eq('id', userId);

      if (error) throw error;
      toast.success("Perfil atualizado!");
      setIsEditing(false);
      fetchProfile();
      onUpdate?.();
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateFocusPoint = async (focusPoint: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          banner_focus_point: focusPoint,
        })
        .eq('id', userId);

      if (error) throw error;
      toast.success("Ponto focal atualizado!");
      fetchProfile();
      onUpdate?.();
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(reader.result as string);
      setCropType(type);
    };
    reader.readAsDataURL(file);
    // Reset input
    e.target.value = '';
  };

  const onCropComplete = async (croppedBlob: Blob) => {
    setCropImage(null);
    setSaving(true);
    try {
      const fileName = `${userId}/${cropType}-${Date.now()}.jpg`;
      const file = new File([croppedBlob], fileName, { type: 'image/jpeg' });

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      const updateData = cropType === 'avatar' ? { avatar_url: publicUrl } : { banner_url: publicUrl };
      
      const { error: dbError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId);

      if (dbError) throw dbError;

      toast.success(`${cropType === 'avatar' ? 'Foto de perfil' : 'Banner'} atualizado!`);
      fetchProfile();
      onUpdate?.();
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="animate-pulse h-40 w-full bg-gray-100 rounded-3xl" />;

  return (
    <div className="w-full space-y-6">
      {/* Banner & Avatar Preview */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-white ring-1 ring-black/5 shadow-sm">
        <div 
          className="group relative h-48 w-full bg-gray-100 overflow-hidden cursor-crosshair"
          onClick={(e) => {
            if (!isAdjustingFocus || !profile?.banner_url) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
            const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
            setTempFocus({ x, y });
          }}
        >
          {profile?.banner_url ? (
            <img 
              src={profile.banner_url} 
              alt="Banner" 
              className="h-full w-full object-cover transition-all duration-300 pointer-events-none" 
              style={{ objectPosition: isAdjustingFocus ? `${tempFocus.x}% ${tempFocus.y}%` : (profile.banner_focus_point || '50% 50%') }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-300">
              <Layout size={40} />
            </div>
          )}
          
          {isAdjustingFocus && (
            <div 
              className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-black/50 shadow-xl pointer-events-none"
              style={{ left: `${tempFocus.x}%`, top: `${tempFocus.y}%` }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-1 w-1 rounded-full bg-white" />
              </div>
            </div>
          )}

          <div className={`absolute inset-0 flex items-center justify-center transition-opacity gap-4 ${isAdjustingFocus ? 'bg-black/20' : 'bg-black/40 opacity-0 group-hover:opacity-100'}`}>
            {isAdjustingFocus ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdateFocusPoint(`${tempFocus.x}% ${tempFocus.y}%`);
                    setIsAdjustingFocus(false);
                  }}
                  className="flex items-center gap-2 rounded-full bg-white px-6 py-2 text-sm font-bold text-black shadow-lg"
                >
                  <Save size={18} />
                  Salvar Foco
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAdjustingFocus(false);
                    if (profile?.banner_focus_point) {
                      const [x, y] = profile.banner_focus_point.split(' ').map((v: string) => parseInt(v));
                      setTempFocus({ x, y });
                    }
                  }}
                  className="rounded-full bg-black/50 p-2 text-white backdrop-blur-md"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <>
                <label className="flex cursor-pointer flex-col items-center gap-2 text-white hover:text-gray-200 transition-colors">
                  <Scissors size={24} />
                  <span className="text-sm font-bold">Recortar Capa</span>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={(e) => handleImageUpload(e, 'banner')}
                  />
                </label>
                
                {profile?.banner_url && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAdjustingFocus(true);
                    }}
                    className="flex flex-col items-center gap-2 text-white hover:text-gray-200 transition-colors"
                  >
                    <Layout size={24} />
                    <span className="text-sm font-bold">Ajustar Foco</span>
                  </button>
                )}
              </>
            )}
          </div>

      <AnimatePresence>
        {cropImage && (
          <ImageCropper
            image={cropImage}
            aspect={cropType === 'avatar' ? 1 : 16 / 9}
            onCropComplete={onCropComplete}
            onCancel={() => setCropImage(null)}
          />
        )}
      </AnimatePresence>
    </div>

        <div className="relative -mt-12 ml-8 flex items-end gap-6 pb-6">
          <div className="group relative h-24 w-24 overflow-hidden rounded-3xl bg-white ring-4 ring-white shadow-xl">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-50 text-gray-300">
                <User size={32} />
              </div>
            )}
            <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Scissors size={20} className="text-white" />
              <input 
                type="file" 
                className="hidden" 
                accept="image/*" 
                onChange={(e) => handleImageUpload(e, 'avatar')}
              />
            </label>
          </div>

          <div className="mb-2 flex-1 space-y-1">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="rounded-xl bg-gray-50 px-4 py-2 text-lg font-black tracking-tighter ring-1 ring-black/5 focus:outline-none focus:ring-black/20"
                  autoFocus
                />
                <button
                  onClick={handleUpdateProfile}
                  disabled={saving}
                  className="rounded-full bg-black p-2 text-white transition-all active:scale-95"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="rounded-full bg-gray-100 p-2 text-gray-500 transition-all active:scale-95"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black tracking-tighter text-black">
                  {profile?.display_name || "Sem Nome"}
                </h2>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="text-gray-400 hover:text-black transition-colors"
                >
                  <Edit3 size={16} />
                </button>
              </div>
            )}
            <p className="text-sm font-medium text-gray-400">Dono da Galeria</p>
          </div>
        </div>
      </div>
    </div>
  );
};

import { Edit3 } from 'lucide-react';
