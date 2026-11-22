/**
 * Returns a channel topic that is unique per subscription.
 *
 * supabase.channel(name) returns an already-subscribed channel when the same
 * topic exists on the client, and calling .on() on it throws
 * "cannot add postgres_changes callbacks after subscribe()". Use this for
 * postgres_changes-only channels. Do NOT use it for presence/broadcast
 * channels, which must share one topic across clients.
 */
export const uniqueChannelName = (base: string): string =>
  `${base}-${crypto.randomUUID()}`;
