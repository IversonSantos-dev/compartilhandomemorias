import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LogIn, LogOut, User, Camera, Upload as UploadIcon, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CameraCapture } from './CameraCapture';
import { PhotoGallery } from './PhotoGallery';
import { AuthModal } from './AuthModal';
import { ShareGallery } from './ShareGallery';
import { toast, Toaster } from 'sonner';
import confetti from 'canvas-confetti';

export const MainCanvas: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<{ id: string; file: File; progress: number; preview: string }[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = () => {
    setIsAuthModalOpen(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Até logo!");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session?.user) return;

    setIsUploading(true);
    setUploadProgress(10);
    try {
      const fileName = `${session.user.id}/${Date.now()}-${file.name}`;
      
      // Simular progresso inicial
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      const { data, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, file);

      clearInterval(progressInterval);
      if (uploadError) throw uploadError;
      
      setUploadProgress(95);

      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('photos')
        .insert({
          user_id: session.user.id,
          image_url: publicUrl,
          caption: ""
        });

      if (dbError) throw dbError;

      setUploadProgress(100);
      toast.success("Foto enviada com sucesso!");
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#000000', '#FFFFFF', '#F9F9F9']
      });
      
      // Resetar após um pequeno delay para a animação completar
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F9F9] font-sans selection:bg-black selection:text-white">
      <Toaster position="top-center" richColors />
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#F9F9F9]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-bold tracking-tighter text-black sm:text-3xl"
          >
            Shared Memory Canvas<span className="text-gray-300">.</span>
          </motion.h1>
          
          <div className="flex items-center gap-4">
            {session ? (
              <div className="flex items-center gap-3">
                <ShareGallery />
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white shadow-sm ring-1 ring-black/5">
                  <span className="text-sm font-bold uppercase">
                    {session.user.email?.[0]}
                  </span>
                </div>
                <div className="hidden flex-col sm:flex">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Usuário Logado
                  </span>
                  <span className="text-sm font-bold text-black">
                    {session.user.email?.split('@')[0]}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-2 rounded-full bg-white p-2.5 text-black shadow-sm ring-1 ring-black/5 transition-all hover:bg-gray-50 active:scale-95"
                  title="Sair"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="flex items-center gap-2 rounded-full bg-black px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-gray-800 active:scale-95 shadow-lg shadow-black/10"
              >
                <LogIn size={18} />
                <span>Entrar</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pb-24 pt-8">
        {/* Call to Action Section */}
        <section className="mb-16 flex flex-col items-center justify-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="max-w-2xl text-4xl font-black leading-tight tracking-tight text-black sm:text-6xl">
              Capture e compartilhe momentos <span className="text-gray-400 italic">instantaneamente.</span>
            </h2>
            <p className="mt-6 text-lg text-gray-500 font-medium">
              Uma galeria colaborativa para nossas melhores memórias.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-10 flex flex-col items-center gap-6"
          >
            {session ? (
              <div className="flex flex-col items-center gap-6 w-full max-w-md">
                <div className="flex flex-wrap justify-center gap-4">
                  <button
                    onClick={() => setIsCameraOpen(true)}
                    className="group flex items-center gap-3 rounded-2xl bg-black px-8 py-4 text-lg font-bold text-white transition-all hover:bg-gray-800 hover:shadow-xl hover:shadow-black/10 active:scale-95"
                  >
                    <Camera className="transition-transform group-hover:rotate-12" size={24} />
                    Capturar
                  </button>
                  
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-8 py-4 text-lg font-bold text-black ring-1 ring-black/10 transition-all hover:bg-gray-50 hover:shadow-md active:scale-95">
                    <UploadIcon className={isUploading ? "animate-bounce" : ""} size={24} />
                    Upload
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleFileUpload}
                      disabled={isUploading}
                    />
                  </label>
                </div>

                {/* Barra de Progresso de Upload */}
                <AnimatePresence>
                  {isUploading && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="w-full space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5"
                    >
                      <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-500">
                        <span>Enviando momento...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
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
            ) : (
              <p className="rounded-2xl bg-white px-8 py-4 text-sm font-semibold text-gray-500 ring-1 ring-black/5">
                Faça login para adicionar seus próprios momentos.
              </p>
            )}
          </motion.div>
        </section>

        {/* Gallery Section */}
        <section>
          <div className="mb-8 flex items-center gap-3">
            <ImageIcon className="text-black" size={24} />
            <h3 className="text-xl font-bold tracking-tight">Memórias Recentes</h3>
          </div>
          <PhotoGallery />
        </section>
      </main>

      {/* Floating Camera Button for Mobile (Bottom Right) */}
      {session && !isCameraOpen && (
        <motion.button
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsCameraOpen(true)}
          className="fixed bottom-8 right-8 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-black text-white shadow-2xl shadow-black/20 sm:hidden"
        >
          <Camera size={30} />
        </motion.button>
      )}

      {/* Modals */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
      
      <CameraCapture 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)}
        onCapture={(url) => {
          confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 },
            colors: ['#000000', '#FFFFFF', '#F9F9F9']
          });
        }}
      />
    </div>
  );
};
