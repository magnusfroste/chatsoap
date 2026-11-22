
- Realtime channels that only use postgres_changes get their topic from `uniqueChannelName()` in src/lib/realtimeChannel.ts; presence/broadcast channels (e.g. typing) keep a shared fixed topic. Why: a reused topic returns an already-subscribed channel and `.on()` then crashes the app.
