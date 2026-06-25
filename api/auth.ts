// @ts-nocheck
export function getBearerToken(req) {
  const header = req?.headers?.authorization || req?.headers?.Authorization;
  if (typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function requireSupabaseUser(supabaseAdmin, req) {
  const token = getBearerToken(req);
  if (!token) {
    return { ok: false, statusCode: 401, message: 'Missing authorization token' };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user?.id) {
    return { ok: false, statusCode: 401, message: 'Invalid authorization token' };
  }

  return { ok: true, user: data.user };
}
