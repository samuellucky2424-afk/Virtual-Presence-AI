export const DB_TABLES = {
  users: 'users_vp',
  wallets: 'wallets_vp',
  transactions: 'transactions_vp',
  sessions: 'sessions_vp',
  plans: 'plans_vp',
  subscriptions: 'subscriptions_vp',
  exchangeRates: 'exchange_rates_vp',
  admins: 'admins_vp',
  creditAdjustments: 'credit_adjustments_vp',
  auditLog: 'audit_log_vp',
} as const;

export const DB_RPC = {
  isCurrentUserAdmin: 'is_current_user_admin_vp',
  adminListUsers: 'admin_list_users_vp',
  adminSetCredits: 'admin_set_credits_vp',
  adminSetBlocked: 'admin_set_blocked_vp',
  adminUpsertPlan: 'admin_upsert_plan_vp',
  adminDeletePlan: 'admin_delete_plan_vp',
  adminStats: 'admin_stats_vp',
} as const;
