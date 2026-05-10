Eu vou implementar um sistema de autenticação com login e senha (em vez de link mágico) e criar um fluxo de login dedicado para o usuário principal (dono da lista).

### Alterações:
1.  **Configuração do Supabase**: Garantir que o provedor de Email está habilitado com senha (por padrão já vem, mas ajustaremos o componente).
2.  **Novo Componente de Login**: Criar `src/components/AuthModal.tsx` com campos de email e senha, incluindo alternância entre Login e Cadastro.
3.  **Atualização do MainCanvas**: Substituir o `window.prompt` de link mágico pelo novo modal de autenticação.
4.  **Gerenciamento de Estado**: Adicionar suporte para login tradicional e tratamento de erros mais robusto.

### Detalhes Técnicos:
- Usar `supabase.auth.signInWithPassword` para o login.
- Manter o estilo visual "Dots Memory" (rounded-2xl, glassmorphism, sombras suaves).
- Usar `sonner` para notificações de sucesso/erro.
