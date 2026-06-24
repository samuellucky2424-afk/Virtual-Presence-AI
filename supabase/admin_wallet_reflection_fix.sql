-- Makes admin wallet edits visible in user wallet transaction history.
-- Run this in Supabase SQL Editor after vp_setup.sql if your current database
-- was created before this fix.

CREATE OR REPLACE FUNCTION public.admin_set_credits_vp(
    p_user_id UUID,
    p_credits INTEGER,
    p_reason  TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin   UUID := auth.uid();
    v_current INTEGER;
    v_delta   INTEGER;
    v_wallet  UUID;
BEGIN
    IF NOT public.is_admin_vp(v_admin) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;
    IF p_credits < 0 THEN
        RAISE EXCEPTION 'Credits cannot be negative';
    END IF;

    INSERT INTO public.wallets_vp (user_id, credits) VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT credits INTO v_current
      FROM public.wallets_vp
     WHERE user_id = p_user_id
     FOR UPDATE;

    v_delta := p_credits - COALESCE(v_current, 0);

    UPDATE public.wallets_vp
       SET credits = p_credits
     WHERE user_id = p_user_id
     RETURNING id INTO v_wallet;

    INSERT INTO public.credit_adjustments_vp (user_id, admin_id, delta, new_balance, reason)
    VALUES (p_user_id, v_admin, v_delta, p_credits, p_reason);

    IF v_delta <> 0 THEN
        INSERT INTO public.transactions_vp (
            user_id,
            wallet_id,
            type,
            amount_naira,
            amount,
            credits,
            reference,
            description,
            status,
            metadata
        )
        VALUES (
            p_user_id,
            v_wallet,
            CASE WHEN v_delta < 0 THEN 'debit' ELSE 'credit' END,
            0,
            0,
            ABS(v_delta),
            'ADMIN-' || uuid_generate_v4()::TEXT,
            COALESCE(NULLIF(p_reason, ''), 'Admin wallet adjustment'),
            'success',
            jsonb_build_object('admin_id', v_admin, 'delta', v_delta, 'new_balance', p_credits)
        );
    END IF;

    INSERT INTO public.audit_log_vp (actor_id, action, target_table, target_id, payload)
    VALUES (
        v_admin,
        'set_credits',
        'wallets_vp',
        p_user_id::TEXT,
        json_build_object('delta', v_delta, 'new_balance', p_credits, 'reason', p_reason)
    );

    RETURN json_build_object('success', TRUE, 'new_credits', p_credits, 'delta', v_delta);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_credits_vp(UUID, INTEGER, TEXT) TO authenticated;
