-- Adicionar coluna para ponto focal no perfil
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS banner_focus_point TEXT DEFAULT '50% 50%';

-- Adicionar coluna para reações nas fotos
ALTER TABLE public.photos 
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb;

-- Comentários para documentação
COMMENT ON COLUMN public.profiles.banner_focus_point IS 'Armazena a posição central da imagem de capa (ex: 50% 50%)';
COMMENT ON COLUMN public.photos.reactions IS 'Armazena contagem de emojis de reação (ex: {"❤️": 5, "😊": 2})';