/**
 * Whether a request may run a scheduled job (here, the batch embedding job). Vercel Cron
 * sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set, as it
 * is in production. Without the secret only local development may run one;
 * a job used to run for anyone when the secret was missing. The
 * `x-vercel-cron` header is not proof of anything: anyone can send it.
 */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  return (req.headers.get('authorization') || '') === `Bearer ${secret}`
}
