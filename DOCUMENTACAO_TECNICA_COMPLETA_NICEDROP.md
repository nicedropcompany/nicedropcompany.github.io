# Documentação Técnica Completa — NiceDrop

> Site institucional + plataforma web da **NiceDrop**, uma rede de entrega autónoma por drones.
> Documento em PT-PT. Última revisão do favicon/documentação: 2026-07-02.

---

## 1. O que o site faz (visão geral)

O NiceDrop é ao mesmo tempo:

1. **Landing page pública** — apresenta o conceito (rede de entrega por drones) e faz marketing.
2. **Aplicação web com login** — depois de autenticado, cada utilizador entra num painel diferente conforme o seu papel (cliente, dono de loja ou developer).
3. **Página de download da app** — com lista de espera (waitlist) por plataforma.

O *backend* é o **Supabase** (autenticação + base de dados PostgreSQL com regras de segurança RLS). Não há servidor próprio: são ficheiros estáticos (HTML/CSS/JS) servidos por **GitHub Pages**, que falam diretamente com o Supabase pelo browser.

---

## 2. Estrutura de páginas

| Ficheiro | Página | Acesso | Descrição |
|---|---|---|---|
| `index.html` | Landing page | Público | Hero, problema/solução, estatísticas, visão futura, CTAs |
| `download.html` | Download da app | Público | Botões de download + waitlist (recolha de emails) |
| `auth.html` | Login / Registo | Público | Entrar, criar conta, login com Google |
| `recovery.html` | Recuperar password | Público | Fluxo de reposição de password |
| `client.html` | Perfil do cliente | Login (client) | Encomendas, carrinho, moradas, favoritos |
| `dashboard.html` | Dashboard da loja | Login (owner) | Gestão da loja, drones, equipa, posts |
| `admin.html` | Painel de administração | Login (developer) | Gestão global de tudo |
| `pay_success.html` | Pagamento concluído | Após Stripe | Confirmação de pagamento |
| `404.html` | Página de erro | Público | "Entrega perdida" |

### Ficheiros de apoio

- **Lógica**: `app.js` (utilitários globais, toasts, tema), `script.js`/`download.js` (animações de scroll), `motion.js` (micro-interações), `hero-three.js` (efeito 3D do hero).
- **Auth/dados**: `supabase-config.js` (ligação), `auth-supabase.js` (login/registo), `client.js`, `dashboard.js`, `admin.js` (lógica de cada painel).
- **Estilo/assets**: `style.css`, `sky.png` (fundo), `nicedrop.png` (wordmark), `favicon.svg` (ícone do separador), `BebasNeue-Regular.ttf` (fonte de títulos).
- **Base de dados**: `rls-policies.sql` (regras de segurança a correr no Supabase), `manifest.json` (PWA).

---

## 3. Papéis de utilizador (roles)

O papel fica guardado na tabela `profiles`. Ao entrar, o utilizador é reencaminhado automaticamente:

| Papel | Redireciona para | O que é |
|---|---|---|
| `client` | `client.html` | Cliente final (papel por defeito de qualquer conta nova) |
| `owner` | `dashboard.html` | Dono de uma ou mais lojas |
| `operator` | (loja) | Funcionário de loja (gere drones/produtos/encomendas dessa loja) |
| `developer` | `admin.html` | Administrador da plataforma (acesso total) |

> Qualquer conta criada por registo normal ou por Google começa sempre como **`client`**. A promoção a `owner`/`operator`/`developer` é feita por um developer no Admin Panel, ou por um owner (que pode promover funcionários da sua loja a owner).

---

## 4. O que se pode EDITAR vs. só VER — por página

Esta é a parte prática: o que cada utilizador consegue **alterar** e o que é **apenas leitura**.

### 4.1 Landing page (`index.html`) — Público
- **Só ver.** Nada é editável pelo visitante. Botões levam a `download.html` e `auth.html`.
- Estatísticas ("live-stats") são texto fixo no HTML — não vêm da base de dados.

### 4.2 Download (`download.html`) — Público
- **Ver**: informação da app, plataformas.
- **Editar/enviar**: o visitante pode **submeter o email** para a waitlist de uma plataforma (grava na tabela `waitlist`). Só isso.

### 4.3 Autenticação (`auth.html`, `recovery.html`) — Público
- **Ações**: criar conta, entrar (email/password ou Google), pedir recuperação de password.
- Cria/atualiza o próprio registo em `profiles` (sempre com role `client` no arranque).

### 4.4 Perfil do Cliente (`client.html`) — Papel `client`
Separadores: **Resumo · Encomendas · Carrinho · Moradas · Favoritos** (+ **Loja** se for operator/owner).

> **Importante:** no site, o perfil do cliente é essencialmente **só de leitura**. O cliente **não encomenda nem compra por aqui** — encomendas, carrinho, moradas e favoritos são criados/geridos na **app móvel** e aqui apenas se **consultam**. A única coisa editável no site é o **nome do perfil**.

| Item | Editar | Só ver |
|---|---|---|
| Nome do perfil (username) | ✅ (modal "Editar Perfil") | |
| Encomendas próprias | | ✅ (histórico e estado — sem fazer novas) |
| Carrinho | | ✅ (mostra os itens; sem adicionar/remover nem checkout) |
| Moradas | | ✅ (lista + "Ver mapa"; sem adicionar/apagar) |
| Favoritos | | ✅ (produtos guardados) |
| Separador "Loja" | | ✅ (só aparece a operator/owner, estatísticas em leitura) |

### 4.5 Dashboard da Loja (`dashboard.html`) — Papel `owner`
Barra lateral lista as lojas do owner; ao escolher uma, vê estatísticas e detalhes.

| Item | Owner pode | Notas |
|---|---|---|
| Estatísticas (drones, receita, produtos, pendentes, estado) | Ver | Calculadas em tempo real |
| Drones da loja | Ver estado/capacidade | Criar/apagar drones é do developer (owner/operator atualizam estado) |
| Equipa | **Editar**: adicionar funcionário, promover a OWNER, remover membro | |
| Encomendas da loja | Ver e **atualizar estado** | pending → shipping → delivered, etc. |
| Posts / Notícias | **Criar/editar/apagar** | Publicações da loja |
| Produtos | **Gerir** (via RLS: owner/operator) | |

### 4.6 Admin Panel (`admin.html`) — Papel `developer`
Acesso total à plataforma. Cartões do painel:

| Secção | O que faz o developer |
|---|---|
| **Utilizadores** | Ver todos; **mudar o role** de qualquer utilizador (client/operator/owner/developer) |
| **Criar Loja** | **Criar** loja (nome, dono, localização por mapa ou coordenadas) |
| **Todas as Lojas** | Ver e **apagar** lojas |
| **Adicionar Drone** | **Criar** drones e atribuí-los a uma loja (nome, capacidade) |
| **Encomendas Recentes** | Ver **todas** as encomendas globais |
| **Pagamentos Stripe** | Ver **todos** os pagamentos (`parent_orders`) |
| **Posts / Notícias** | **Criar/editar/apagar** posts |
| **Categorias** | **Criar/apagar** categorias de produtos |

Só o developer vê a **waitlist** e os **pagamentos**.

---

## 5. Modelo de dados (Supabase / PostgreSQL)

Tabelas principais e quem lê/escreve (resumo das políticas RLS em `rls-policies.sql`):

| Tabela | Conteúdo | Leitura | Escrita |
|---|---|---|---|
| `profiles` | Utilizadores (username, role, store_id) | Autenticados | Próprio perfil (developer edita todos) |
| `stores` | Lojas | Autenticados | Developer cria/apaga; owner atualiza a sua |
| `drones` | Drones (nome, capacidade, estado) | Autenticados | Developer cria/apaga; owner/operator atualizam |
| `orders` | Encomendas | Cliente vê as suas; loja vê as dela; developer vê tudo | Cliente cria; loja/developer mudam estado |
| `products` | Produtos | Público (autenticados) | Owner/operator da loja + developer |
| `posts` | Notícias/publicações | Público (autenticados) | Owner/operator da loja + developer |
| `categories` | Categorias de produto | Público (autenticados) | Só developer |
| `addresses` | Moradas dos clientes | Só o próprio | Só o próprio |
| `cart` | Carrinho | Só o próprio | Só o próprio |
| `parent_orders` | Pagamentos Stripe | Só developer | (backend) |
| `waitlist` | Emails da lista de espera | Só developer | Qualquer pessoa insere |

A segurança é imposta **do lado do Supabase** (RLS), não no browser. A função `get_my_role()` determina permissões pelo role do utilizador autenticado.

> A coluna "Escrita" descreve o que a base de dados **permite** (usado sobretudo pela **app móvel** — ex.: o cliente cria encomendas/carrinho/moradas na app). O site `client.html` **não** oferece essas ações: mostra os dados em leitura.

---

## 6. Autenticação e fluxo

1. Registo/login em `auth.html` (`auth-supabase.js`) via `supabase.auth`.
2. Após entrar, procura/cria o perfil em `profiles` (role `client` por defeito).
3. Guarda a sessão em `localStorage` (`nicedrop_user`) e redireciona pelo role.
4. Login com Google usa OAuth; o retorno é tratado por `handleOAuthReturn()`.
5. `index.html` deteta tokens no URL e reencaminha para `auth.html` para concluir o login.

---

## 7. Como executar e desenvolver

1. **Ver localmente**: abrir `index.html` no browser. Para o fluxo completo (login/dados), usar um servidor local (ex.: extensão *Live Server*) porque há OAuth e chamadas ao Supabase.
2. **Publicação**: o site é servido por **GitHub Pages** a partir deste repositório (`nicedropcompany.github.io`). Fazer *commit*/*push* publica.
3. **Base de dados**: as tabelas e regras estão em `rls-policies.sql` — correr no *SQL Editor* do Supabase. A ligação está em `supabase-config.js` (URL + chave anónima pública).

---

## 8. Personalização rápida (o que podes editar no código)

| Quero mudar… | Onde |
|---|---|
| **Favicon** (ícone do separador) | `favicon.svg` — SVG vetorial com o "N" no cartão. Alterar cores/forma aí. |
| Logótipo (wordmark) | Substituir `nicedrop.png` |
| Fundo do site | Substituir `sky.png` |
| Cores / tipografia / espaçamento | Variáveis `:root` e regras em `style.css` |
| Textos e secções da landing | `index.html` |
| Fonte dos títulos | `BebasNeue-Regular.ttf` + Bebas Neue (Google Fonts) |
| Ligação ao backend | `supabase-config.js` |
| Animações de scroll/parallax | `script.js`, `download.js`, `motion.js` |

### Nota sobre o favicon
O ícone do separador é agora `favicon.svg` (recriação vetorial do logótipo: céu azul + cartão branco com sombra + "N" preto). Está ligado em todas as páginas HTML e no `manifest.json`. Como é SVG, é nítido em qualquer tamanho. O `nicedrop.png` fica como *fallback* para browsers antigos e como ícone Apple/PWA. Se tiveres o PNG original do logótipo, basta substituir o ficheiro e apontar os `<link rel="icon">` para ele.

---

## 9. Resumo "quem pode fazer o quê"

- **Visitante (sem login)** → só vê a landing e o download; pode entrar na waitlist e criar conta.
- **Cliente (`client`)** → no site **só consulta** as suas encomendas, carrinho, moradas e favoritos; a única edição é o **nome do perfil**. Encomendar/comprar é feito na **app**, não no site.
- **Funcionário (`operator`)** → gere drones/produtos/encomendas da loja onde está.
- **Dono (`owner`)** → tudo o do operator + gere a equipa e posts da(s) sua(s) loja(s).
- **Developer** → controla tudo: utilizadores, lojas, drones, categorias, posts, pagamentos e waitlist.
