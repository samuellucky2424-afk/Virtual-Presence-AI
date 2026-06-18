// @ts-nocheck
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
};

export const DB_RPC = {
  getUserCredits: 'get_user_credits_vp',
  deductCredits: 'deduct_credits_vp',
  addCredits: 'add_credits_vp',
  isAdmin: 'is_admin_vp',
  isCurrentUserAdmin: 'is_current_user_admin_vp',
  adminListUsers: 'admin_list_users_vp',
  adminSetCredits: 'admin_set_credits_vp',
  adminSetBlocked: 'admin_set_blocked_vp',
  adminUpsertPlan: 'admin_upsert_plan_vp',
  adminDeletePlan: 'admin_delete_plan_vp',
  adminStats: 'admin_stats_vp',
};

const LEGACY_TO_CLONE_TABLE = {
  users: DB_TABLES.users,
  wallets: DB_TABLES.wallets,
  transactions: DB_TABLES.transactions,
  sessions: DB_TABLES.sessions,
  plans: DB_TABLES.plans,
  subscriptions: DB_TABLES.subscriptions,
  exchange_rates: DB_TABLES.exchangeRates,
  admins: DB_TABLES.admins,
  credit_adjustments: DB_TABLES.creditAdjustments,
  audit_log: DB_TABLES.auditLog,
};

const LEGACY_TO_CLONE_RPC = {
  get_user_credits: DB_RPC.getUserCredits,
  deduct_credits: DB_RPC.deductCredits,
  add_credits: DB_RPC.addCredits,
  is_admin: DB_RPC.isAdmin,
  is_current_user_admin: DB_RPC.isCurrentUserAdmin,
  admin_list_users: DB_RPC.adminListUsers,
  admin_set_credits: DB_RPC.adminSetCredits,
  admin_set_blocked: DB_RPC.adminSetBlocked,
  admin_upsert_plan: DB_RPC.adminUpsertPlan,
  admin_delete_plan: DB_RPC.adminDeletePlan,
  admin_stats: DB_RPC.adminStats,
};

export function mapDbTableName(table) {
  return LEGACY_TO_CLONE_TABLE[table] || table;
}

export function mapDbRpcName(fn) {
  return LEGACY_TO_CLONE_RPC[fn] || fn;
}
