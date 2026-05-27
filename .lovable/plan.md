## Objetivo
Substituir o login fake (senha hardcoded "Possible" via sessionStorage) por autenticação real do Lovable Cloud (Supabase Auth), reaproveitando as tabelas `profiles`, `analises` e `scoring_config` já existentes.

## Arquivos a modificar

### 1. `src/pages/Login.tsx` (reescrever)
- Adicionar campo de email (input type="email", required) acima do campo de senha.
- Remover a constante `APP_PASSWORD` e qualquer comparação local.
- No submit, chamar `supabase.auth.signInWithPassword({ email, password })`.
- Estado de loading enquanto a chamada está pendente (botão desabilitado + texto "Entrando...").
- Tratamento de erro: mostrar mensagem amigável em PT-BR ("Email ou senha incorretos" para credenciais inválidas; mensagem genérica para outros erros). Usar o toast (`sonner`) já disponível para erros inesperados.
- Em caso de sucesso, `navigate("/")`.
- Abaixo do botão "Entrar", link textual "Esqueci minha senha" que abre um pequeno fluxo inline: se o campo email estiver vazio, mostrar erro pedindo para preencher; senão, chamar `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${window.location.origin}/login })` e mostrar confirmação ("Se o email existir, você receberá instruções para redefinir a senha").
- Remover qualquer `sessionStorage.setItem("app_authenticated", ...)`.
- Manter o visual atual (card branco sobre fundo navy, logo, título).

### 2. `src/components/AuthGuard.tsx` (reescrever)
- Substituir checagem de `sessionStorage` por estado real do Supabase.
- No `useEffect`, primeiro registrar `supabase.auth.onAuthStateChange((_event, session) => setSession(session))` e em seguida chamar `supabase.auth.getSession()` para a verificação inicial (ordem recomendada para evitar deadlocks).
- Três estados: `loading` (renderiza um loader centralizado simples), `unauthenticated` (`<Navigate to="/login" replace />`), `authenticated` (renderiza `children`).
- Cleanup do subscription no unmount.

### 3. `src/App.tsx`
- Importar `Login` de `./pages/Login`.
- Trocar a rota `/login` para usar `<Login />`.
- Envolver as rotas protegidas (`/`, `/analise/pf`, `/analise/pj`, `/preview`, `/resultado`, `/historico`, `/configuracoes`) com `<AuthGuard>...</AuthGuard>`.
- Rota `/login` permanece pública. Rota `*` (NotFound) permanece pública.

### 4. `src/components/Header.tsx`
- Adicionar estado de sessão local: `useEffect` com `onAuthStateChange` + `getSession()` para pegar o email do usuário (`session?.user?.email`).
- À direita da nav, adicionar bloco com o email (texto pequeno, cor `navy-foreground/70`) e botão "Sair" (variant ghost ou link, ícone `LogOut` do lucide-react).
- Botão "Sair" chama `await supabase.auth.signOut()` e depois `navigate("/login")`.
- Manter o restante do header (logo, links de nav) intacto.

## Limpeza
- Remoção da constante `APP_PASSWORD` (estava só em `Login.tsx`).
- Busca por `app_authenticated` no projeto para garantir que nenhum outro arquivo ainda usa o flag antigo; se encontrar, remover.

## O que NÃO será alterado
- Nenhuma migration / tabela / RLS / edge function.
- Páginas de análise (AnalisePF, AnalisePJ, Preview, Resultado, Historico, Configuracoes) — exceto pela proteção via AuthGuard no router.
- Nenhum fluxo de cadastro será adicionado.

## Decisões a confirmar (assumidas se você não responder)
- **Reset de senha**: o link `redirectTo` aponta para `/login` (não há página dedicada `/reset-password`). Isso significa que, ao clicar no link do email, o usuário cai no `/login` já autenticado pela sessão de recuperação, mas **não terá UI para definir nova senha**. Se quiser fluxo completo de redefinição, preciso criar uma página `/reset-password` separada — não está no escopo desta tarefa. Vou deixar isso como pendência no relatório final.
- **Loader do AuthGuard**: tela cheia com fundo `bg-background` e um spinner simples (sem texto), para evitar flash de conteúdo.
- **Header em mobile**: o email pode ficar oculto em telas pequenas (`hidden sm:inline`) para não quebrar o layout; apenas o botão "Sair" continua visível.

## Provas que serão entregues ao fim
1. Lista de arquivos modificados.
2. Saída do build.
3. Passos numerados de teste (login válido, login inválido, esqueci senha, logout, acesso direto a rota protegida sem sessão).
4. Decisões tomadas.
5. Pendências (notavelmente: página `/reset-password` dedicada não existe; trigger de auto-criação de profile no signup — confirmar se já está configurada no backend, já que signup não é exposto na UI mas pode ser usado pelo admin).
