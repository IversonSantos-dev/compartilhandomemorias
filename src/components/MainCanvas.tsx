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
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !session?.user) return;

    const newItems = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      progress: 0,
      preview: URL.createObjectURL(file)
    }));

    setUploadQueue(prev => [...prev, ...newItems]);

    // Processar cada arquivo na fila
    for (const item of newItems) {
      try {
        const fileName = `${session.user.id}/${Date.now()}-${item.file.name}`;
        
        // Simular progresso inicial
        setUploadQueue(prev => prev.map(i => i.id === item.id ? { ...i, progress: 10 } : i));

        const { data, error: uploadError } = await supabase.storage
          .from('photos')
          .upload(fileName, item.file);

        if (uploadError) throw uploadError;
        
        setUploadQueue(prev => prev.map(i => i.id === item.id ? { ...i, progress: 60 } : i));

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

        setUploadQueue(prev => prev.map(i => i.id === item.id ? { ...i, progress: 100 } : i));
        
        toast.success(`Foto "${item.file.name}" enviada!`);
        
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.8 },
          colors: ['#000000', '#FFFFFF']
        });

        // Remover da fila após sucesso
        setTimeout(() => {
          setUploadQueue(prev => prev.filter(i => i.id !== item.id));
          URL.revokeObjectURL(item.preview);
          window.location.reload();
        }, 2000);

      } catch (err: any) {
        toast.error(`Erro no upload de "${item.file.name}": ${err.message}`);
        setUploadQueue(prev => prev.filter(i => i.id !== item.id));
        URL.revokeObjectURL(item.preview);
      }
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
        {/* Landing Page Content (When not logged in) */}
        {!session && (
          <section className="mb-16 flex flex-col items-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <h2 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-black sm:text-7xl">
                Crie memórias <span className="text-gray-400 italic">vivas</span> com quem você ama.
              </h2>
              <p className="mx-auto mt-8 max-w-xl text-lg font-medium text-gray-500">
                O Shared Memory Canvas é uma galeria privada e colaborativa. 
                Crie sua conta para começar a colecionar momentos únicos.
              </p>
            </motion.div>

            <div className="mt-20 grid w-full grid-cols-1 gap-8 md:grid-cols-3">
              {[
                {
                  title: "Captura Instantânea",
                  desc: "Capture fotos diretamente do app ou faça upload da sua galeria num piscar de olhos.",
                  icon: <Camera className="h-6 w-6" />
                },
                {
                  title: "QR Code Inteligente",
                  desc: "Gere links únicos para que seus convidados contribuam sem precisar criar conta.",
                  icon: <ImageIcon className="h-6 w-6" />
                },
                {
                  title: "Segurança Total",
                  desc: "Suas fotos são privadas. Apenas você e quem tiver seu link secreto podem ver.",
                  icon: <User className="h-6 w-6" />
                }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * (i + 1) }}
                  className="rounded-[2.5rem] bg-white p-10 shadow-sm ring-1 ring-black/5"
                >
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-black">{feature.title}</h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-gray-500">
                    {feature.desc}
                  </p>
                </motion.div>
              ))}
            </div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-16"
            >
              <button
                onClick={handleLogin}
                className="rounded-full bg-black px-10 py-5 text-lg font-bold text-white shadow-2xl shadow-black/10 transition-all hover:bg-gray-800 active:scale-95"
              >
                Começar Agora
              </button>
            </motion.div>
          </section>
        )}

        {/* Dashboard (When logged in) */}
        {session && (
          <section className="space-y-16">
            <div className="flex flex-col items-center justify-center text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="text-4xl font-black tracking-tight text-black sm:text-5xl">
                  Sua Galeria <span className="text-gray-400 italic">Privada</span>
                </h2>
                <p className="mt-4 text-gray-500 font-medium">
                  Capture novos momentos ou gerencie suas memórias compartilhadas.
                </p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-10 flex flex-col items-center gap-6"
              >
                <div className="flex flex-wrap justify-center gap-4">
                  <button
                    onClick={() => setIsCameraOpen(true)}
                    className="group flex items-center gap-3 rounded-2xl bg-black px-8 py-4 text-lg font-bold text-white transition-all hover:bg-gray-800 hover:shadow-xl hover:shadow-black/10 active:scale-95"
                  >
                    <Camera className="transition-transform group-hover:rotate-12" size={24} />
                    Capturar
                  </button>
                  
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white px-8 py-4 text-lg font-bold text-black ring-1 ring-black/10 transition-all hover:bg-gray-50 hover:shadow-md active:scale-95">
                    <UploadIcon className={uploadQueue.length > 0 ? "animate-bounce" : ""} size={24} />
                    Upload
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      multiple
                      onChange={handleFileUpload}
                      disabled={uploadQueue.length > 0}
                    />
                  </label>
                </div>

                {/* Fila de Upload */}
                <AnimatePresence>
                  {uploadQueue.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="w-full max-w-md space-y-3"
                    >
                      {uploadQueue.map(item => (
                        <div key={item.id} className="flex items-center gap-4 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                            <img src={item.preview} alt="Preview" className="h-full w-full object-cover" />
                          </div>
                          <div className="flex-1 space-y-1.5">
                            <div className="flex justify-between text-[10px] font-black text-gray-400">
                              <span className="truncate max-w-[150px] uppercase">{item.file.name}</span>
                              <span>{item.progress}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-50">
                              <motion.div 
                                className="h-full bg-black"
                                animate={{ width: `${item.progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            <div>
              <div className="mb-8 flex items-center gap-3 border-b border-gray-100 pb-4">
                <ImageIcon className="text-black" size={24} />
                <h3 className="text-xl font-bold tracking-tight text-black">Meus Momentos</h3>
              </div>
              <PhotoGallery />
            </div>
          </section>
        )}
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
