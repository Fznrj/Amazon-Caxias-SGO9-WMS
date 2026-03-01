-- 1. Inserir 18 scans válidos no inventário para o usuário "Fernando Souza" hoje
-- Isso vai forçar a View v_today_operator_productivity a retornar 18 scans.
-- Consequentemente, o GamificationContext vai rodar processOperator() com 18 scans e subir a XP.

DO $$
DECLARE
    v_company_id UUID;
    i INT;
    v_operator_name TEXT := 'Fernando Souza';
BEGIN
    -- Pegar o company_id do usuário (Se falhar, defina manualmente)
    SELECT company_id INTO v_company_id FROM auth.users u JOIN public.users p ON u.id = p.id WHERE p.name = v_operator_name LIMIT 1;
    
    IF v_company_id IS NULL THEN
        SELECT company_id INTO v_company_id FROM public.users WHERE name = v_operator_name LIMIT 1;
    END IF;

    -- Inserir 18 registros falsos no inventário para dar volume de scan
    FOR i IN 1..18 LOOP
        INSERT INTO public.inventory_log (id, time, operator, company_id)
        VALUES ('MANUAL_CORRECTION_MAR1_' || i || '_' || floor(extract(epoch from now())), now(), v_operator_name, v_company_id);
    END LOOP;

END $$;
