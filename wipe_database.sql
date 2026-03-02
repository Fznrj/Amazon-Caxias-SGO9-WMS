-- 🚀 SCRIPT DE WIPE (PRÉ-LANÇAMENTO) - WMS SGO9
-- ALVO: Tabelas Transacionais, Estoque, Logs e Cadastros Fictícios
-- REFÚGIO (Blindado): auth.users, profiles e system_configs

TRUNCATE TABLE 
    inbound_log,
    outbound_log,
    stock_items,
    expeditions,
    rts_log,
    incidents,
    drivers,
    gamification_profiles
RESTART IDENTITY CASCADE;
