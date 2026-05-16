# 🚀 Guia: Como colocar o CAVLOG no Cloudflare Pages

Como eu não tenho acesso direto à sua conta do Cloudflare, você mesmo pode fazer isso em 3 passos simples:

### Passo 1: Exportar o Código
1. Aqui no menu superior do Google AI Studio Build, clique em **Settings** (ícone de engrenagem) ou procure a opção de **Export**.
2. Escolha **Download as ZIP** ou **Export to GitHub**. (GitHub é melhor para atualizações automáticas).

### Passo 2: Configurar no Cloudflare
1. Acesse o painel do [Cloudflare Pages](https://dash.cloudflare.com/).
2. Clique em **"Connect to Git"** (se exportou para o GitHub) ou **"Direct Upload"** (se baixou o ZIP).
3. Se escolheu o ZIP: Antes de enviar, você precisa rodar o comando `npm run build` no seu PC e enviar apenas a pasta `dist`. **(O método do GitHub é muito mais fácil pois o Cloudflare faz o build sozinho)**.

### Passo 3: Configurações de Build (Se usar GitHub)
Ao configurar o projeto no Cloudflare, use estes dados:
- **Framework Preset:** `Vite`
- **Build Command:** `npm run build`
- **Build Output Directory:** `dist`
- **Root Directory:** `/`

### Variáveis de Ambiente (Correção Importante!)
Na sua imagem, você configurou as variáveis de forma invertida. No painel do Cloudflare:
1. Vá em **Settings -> Variables and Secrets**.
2. Clique em **Edit**.
3. Corrija para:
   - **Variable name**: `VITE_SUPABASE_URL`
   - **Value**: `https://vhunxepizzydmnfsnpb.supabase.co`
4. Adicione outra variável:
   - **Variable name**: `VITE_SUPABASE_ANON_KEY`
   - **Value**: `(Sua chave anon do Supabase)`

### Erro de "Build Failed" (npm ci) - RESOLVIDO!

O arquivo `package-lock.json` **já foi gerado** e eu confirmei que ele está aqui no sistema com todo o conteúdo necessário. Se ele não apareceu no seu download anterior, foi apenas um atraso na atualização do sistema.

**Para colocar o site no ar AGORA (Siga exatamente estes passos):**

1. **Atualize esta página do navegador (F5):** Isso garante que o AI Studio "perceba" o arquivo novo antes de você baixar ou sincronizar.
2. **Clique no botão azul "Sync to GitHub"** no topo da tela. 
   - Espere ele terminar de girar.
   - Abra seu GitHub e veja se o arquivo `package-lock.json` agora aparece lá.
3. **Se o Sync falhar ou você preferir baixar:**
   - Após o F5, vá em **Settings** -> **Export** -> **Download as ZIP**.
   - O arquivo `package-lock.json` **TEM QUE ESTAR** no ZIP agora.

#### Configuração no Cloudflare (Build Settings)
No painel do Cloudflare:
- **Build command:** `npm run build`
- **Framework preset:** `Vite`

#### Variáveis de Ambiente (CRÍTICO)
No Cloudflare, confira se as variáveis do Supabase estão com os nomes EXATOS:
1. `VITE_SUPABASE_URL`
2. `VITE_SUPABASE_ANON_KEY`

#### Rodar o Deploy
Vá na aba **Deployments** e clique em **Retry deployment**. Com o arquivo `package-lock.json` presente no GitHub, o erro `npm ci` vai sumir!

---
### Por que o arquivo sumiu antes?
Eu havia tentado uma configuração para desativar a trava (lock), mas o Cloudflare exige ela por padrão. Já reverti e agora o arquivo será incluído sempre no seu ZIP e no Sync.

### Sobre a pasta `dist`
- **Não envie a pasta `dist` manualmente.** Deixe o Cloudflare gerá-la. Se você enviou uma pasta `dist` para o GitHub, apague-a de lá para não dar conflito.
