import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Share2, QrCode, Copy, Check, Loader2, X, Plus, FolderEdit } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

export const ShareGallery: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tokenId, setTokenId] = useState<string | null>(null);

  const fetchLink = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('shared_links')
        .select('token, name')
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setLink(`${window.location.origin}/share/${data.token}`);
        setFolderName(data.name || '');
        setTokenId(data.token);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createLink = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('shared_links')
        .insert({ owner_id: user.id })
        .select('token, name')
        .single();

      if (error) throw error;
      setLink(`${window.location.origin}/share/${data.token}`);
      setFolderName(data.name || '');
      setTokenId(data.token);
      toast.success("Link de compartilhamento criado!");
    } catch (err: any) {
      toast.error("Erro ao criar link: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchLink();
  }, [isOpen]);

  const copyToClipboard = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const updateFolderName = async () => {
    if (!tokenId) return;
    try {
      const { error } = await supabase
        .from('shared_links')
        .update({ name: folderName })
        .eq('token', tokenId);

      if (error) throw error;
      toast.success("Nome da pasta atualizado!");
      setIsEditingName(false);
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + err.message);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-black shadow-sm ring-1 ring-black/5 transition-all hover:bg-gray-50 active:scale-95"
      >
        <Share2 size={16} />
        <span>Compartilhar</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] bg-white p-8 shadow-2xl"
            >
              <button
                onClick={() => setIsOpen(false)}
                className="absolute right-6 top-6 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100"
              >
                <X size={20} />
              </button>

              <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white">
                  <QrCode size={24} />
                </div>
                <h2 className="text-2xl font-black tracking-tighter text-black">
                  Compartilhar Galeria
                </h2>
                <p className="mt-2 text-sm font-medium text-gray-500">
                  Escaneie o QR Code para permitir que convidados façam upload de fotos.
                </p>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-black" size={32} />
                </div>
              ) : link ? (
                <div className="space-y-6">
                  {/* Nome da Pasta */}
                  <div className="rounded-2xl bg-gray-50 p-4 ring-1 ring-black/5">
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-400">
                      Nome da Pasta Compartilhada
                    </label>
                    <div className="flex items-center gap-2">
                      {isEditingName ? (
                        <div className="flex flex-1 items-center gap-1">
                          <input
                            type="text"
                            value={folderName}
                            onChange={(e) => setFolderName(e.target.value)}
                            className="flex-1 bg-transparent text-sm font-bold text-black outline-none"
                            placeholder="Ex: Casamento 2024"
                            autoFocus
                          />
                          <button onClick={updateFolderName} className="text-black">
                            <Check size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-1 items-center justify-between">
                          <span className="text-sm font-bold text-black">
                            {folderName || "Sem nome definido"}
                          </span>
                          <button 
                            onClick={() => setIsEditingName(true)}
                            className="text-gray-400 hover:text-black"
                          >
                            <FolderEdit size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-center rounded-3xl bg-gray-50 p-6 ring-1 ring-black/5">
                    <QRCodeSVG value={link} size={180} />
                  </div>
                  
                  <div className="flex items-center gap-2 overflow-hidden rounded-2xl bg-gray-50 p-2 ring-1 ring-black/5">
                    <span className="flex-1 truncate px-2 text-xs font-medium text-gray-500">
                      {link}
                    </span>
                    <button
                      onClick={copyToClipboard}
                      className="rounded-xl bg-black p-2 text-white transition-all hover:bg-gray-800 active:scale-95"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={createLink}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-black py-4 text-sm font-bold text-white shadow-lg shadow-black/10 transition-all hover:bg-gray-800 active:scale-95"
                >
                  <Plus size={18} />
                  <span>Gerar Link de Acesso</span>
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
