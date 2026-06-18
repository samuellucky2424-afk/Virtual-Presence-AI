// @ts-nocheck
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdminConfigError = !supabaseUrl
  ? 'Missing SUPABASE_URL or VITE_SUPABASE_URL'
  : !supabaseServiceKey
    ? 'Missing SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY'
    : null;

const rawSupabaseAdmin = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

const TABLE_NAMES = {
  users: 'users_vp',
  wallets: 'wallets_vp',
  transactions: 'transactions_vp',
  sessions: 'sessions_vp',
  plans: 'plans_vp',
  subscriptions: 'subscriptions_vp',
  exchange_rates: 'exchange_rates_vp',
  admins: 'admins_vp',
  credit_adjustments: 'credit_adjustments_vp',
  audit_log: 'audit_log_vp',
};

const RPC_NAMES = {
  get_user_credits: 'get_user_credits_vp',
  deduct_credits: 'deduct_credits_vp',
  add_credits: 'add_credits_vp',
  is_admin: 'is_admin_vp',
  is_current_user_admin: 'is_current_user_admin_vp',
  admin_list_users: 'admin_list_users_vp',
  admin_set_credits: 'admin_set_credits_vp',
  admin_set_blocked: 'admin_set_blocked_vp',
  admin_upsert_plan: 'admin_upsert_plan_vp',
  admin_delete_plan: 'admin_delete_plan_vp',
  admin_stats: 'admin_stats_vp',
};

function createMappedSupabaseClient(client) {
  if (!client) return null;

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table) => target.from(TABLE_NAMES[table] || table);
      }

      if (prop === 'rpc') {
        return (fn, args, options) => target.rpc(RPC_NAMES[fn] || fn, args, options);
      }

      return Reflect.get(target, prop, receiver);
    },
  });
}

export const supabaseAdmin = rawSupabaseAdmin
  ? createMappedSupabaseClient(rawSupabaseAdmin)
  : null;
