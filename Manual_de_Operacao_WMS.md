# 🚀 Manual de Operação - Amazon Caxias WMS SGO9 (Versão 1.0)

Este manual tem como objetivo orientar a equipe operacional de Logística no uso diário da plataforma WMS (Web e Coletores Android), englobando desde a etapa de Inbound até o Tracking de RTS e as métricas de Gamificação.

---

## 🔐 1. Acesso e Níveis de Permissão

O sistema exige autenticação obrigatória, gerenciando regras de acesso baseadas na empresa vinculada (Company ID) e no cargo (Role).
- **Operadores / Liderança:** Acessam para realizar bipes (Entrada, Saída, RTS) e visualizar sua Produtividade/Gamificação.
- **Admin / Liderança Sênior:** Possuem abas extras como Gestão de Usuários, Visão Geral (Dashboard Avançado) e Logs de Tratativas.

> **⚠️ Ciclo de Vida do Coletor:** Se o app for colocado em segundo plano (Soneca/Bolso), ele irá **ressincronizar os dados automaticamente** ao retornar à tela, protegendo a operação contra quedas de contadores.

---

## 📊 2. Dashboard 

O **Dashboard** é o coração da operação SGO9.
- Atualizado em tempo real (Supabase Realtime).
- Apresenta as "Entradas Hoje", "Saídas Hoje", "Aguardando Saída (Estoque Atual)" e o total de Motoristas Ativos.
- O Dashboard impõe regras rígidas de fuso horário **(Horário de Brasília T03:00)**, garantindo que "Hoje" recomece perfeitamente às 00:00, e não no relógio local do aparelho.

---

## 📥 3. Entrada (Inbound)

Responsável por capturar pacotes recém-chegados e integrá-los ao Banco Central.
1. Vá até a aba **"Entrada"**.
2. **Scan Rápido:** Coloque o cursor no campo e bip os pacotes.
3. Se o pacote for duplicado (já existe no painel), o sistema dispara um bipe agudo (Feedback Sonoro de Erro) e bloqueia a duplicata.
4. **Manifesto:** Pode-se colar uma lista de TBRs esperadas; o sistema fará a conciliação ("Missing vs Matched").

---

## 📤 4. Saída Rápida (Outbound)

Desenhado para o ambiente Hostil de Expedição (Alta Volumetria sem travamentos).
1. Na aba **"Saída"**, selecione primeiro o **Motorista** no Dropdown.
2. Com o motorista setado, coloque o leitor no campo de scan.
3. **Alto Volume:** A listagem visual foi removida para ganhos de performance. No seu lugar, pisca um contador de **"Resumo do Dia do Motorista"**.
4. **Auditoria em tempo real:** Se você bipar um pacote que estava sinalizado com uma "Tratativa Pendente" (Ex: Rótulo rasgado), o app vai travar o bipe e soar um alarme. Você deve resolver o incidente na aba correspondente antes de liberar o pacote. O mesmo ocorre para pacotes cuja leitura anterior está como "saiu".

---

## 🚚 5. Tracking RTS (Retorno ao Site)

A visão tática dos motoristas durante e após suas rotas.
- **Não Reseta até Meia-Noite:** Todo motorista que receber pacotes na aba "Saída" aparecerá nesta lousa durante todo o resto do dia.
- Mostra a matemática de prestação de contas: `Total Saída` | `Entregues` | `RTS` | `Pendente`.
- **Baixa RTS (Devolução):** Motorista voltou com pacotes? Você os bipa no campo laranja (Lado DEV). O sistema dá baixa no pacote de volta ao Estoque Local e eleva o marcador `RTS`.
- O motorista zera a linha quando: `Entregues + RTS = Total Saída`. A linha vai emitir a cor verde "COMPLETO", mas ele continuará na tela por motivos de auditoria.

---

## 📦 6. Inventário e SLA de Estoque

O WMS roda uma vigilância automática (`SLA Enforce`) em plano de fundo:
- Itens parados na gaiola (Em Estoque) por mais de 72 horas são automaticamente movidos para **Possível Perda**.
- Se ficarem mais de 72h como Possível Perda e ninguém localizá-los, são condenados a **Perda** oficial.
- Como corrigir? Executar varreduras usando a ferramenta de **Inventário Cego**.

---

## 🎮 7. Gamificação (Progresso Exponencial)

Para instigar a produtividade brutal, os operadores possuem Perfis Gamificados com curva progressiva **hardcore** baseada em XPs ganho por bipagens válidas.

### Elos e Níveis
Ao invés de estarem limitados, a plataforma possui 28 Tiers:
- **Divisões Romanas Invertidas:** (Nível III -> II -> I).
- **Trilha Ascendente:** `Ferro > Bronze > Prata > Ouro > Platina > Esmeralda > Diamante > Mestre > Grão-Mestre > Desafiante`.
- Escala Exponencial chegando até a marca insana de quase **150.000 XP** para o topo.

### Conquistas Especiais
Há troféus por constância no WMS (ex: dias sem erros, scanner lendário).
- Exemplo: **Conquista de Superação 110%**: Requer que o usuário atinja uma média de produtividade de 385 pacotes líquidos (Considerando a meta base de 350 dividida pela presença dele no mês).

---

> *Produzido por Amazon Caxias SGO9 Team. Desejamos uma excelente Operação V1.0 amanhã.*
