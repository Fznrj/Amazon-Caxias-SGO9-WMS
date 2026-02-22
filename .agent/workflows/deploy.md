---
description: Como realizar o deploy da aplicação no Vercel
---

# Fluxo de Deploy (Vercel)

Siga estes passos quando o deploy automático do Vercel for reativado ou se precisar fazer um deploy manual.

## 1. Configurações de Ambiente (Vercel Dashboard)
Certifique-se de que as seguintes variáveis de ambiente estão configuradas no painel do Vercel:

- `VITE_SUPABASE_URL`: `https://wwjafnucmhcacdzodgeg.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (Chave completa fornecida no .env.local)

## 2. Comando de Build
O Vercel deve detectar automaticamente as configurações do Vite, mas caso necessário, use:
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

## 3. Deploy Manual (CLI)
Caso prefira usar o Vercel CLI:

```bash
# Instalar CLI se necessário
npm i -g vercel

# Login
vercel login

# Deploy (Produção)
// turbo
vercel --prod
```

## 4. Verificação Pós-Deploy
Após o deploy, verifique se as rotas estão funcionando (o `vercel.json` garante que o recarregamento de páginas internas não dê erro 404).
