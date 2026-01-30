# Calling System - Status & Documentation

## ✅ Working Features (Verified 2026-01-30)

### Direct Chat 1-to-1 Calls
- **Audio calls**: ✅ Working - Both parties can hear each other
- **Video calls**: ✅ Ready to test - Code is in place
- **Incoming call detection**: ✅ Working - Global listener in AuthProvider
- **Call accept/decline**: ✅ Working - Database status updates correctly
- **Call end**: ✅ Working - Cleanup of streams and peer connections

### Technical Implementation
| Component | Purpose | Status |
|-----------|---------|--------|
| `useDirectCall.ts` | WebRTC peer connection, media handling | ✅ |
| `useIncomingCallListener.ts` | Global incoming call detection | ✅ |
| `CallUI.tsx` | Full-screen call interface | ✅ |
| `FloatingVideoCall.tsx` | Floating PiP call panel | ✅ |
| `IncomingCallOverlay.tsx` | Incoming call notification | ✅ |
| `InlineCallBar.tsx` | Header bar for active calls | ✅ |

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                     AuthProvider                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         useIncomingCallListener (global)            │    │
│  │  - Listens for direct_calls with status="ringing"   │    │
│  │  - Shows IncomingCallOverlay when call detected     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    DirectChat Page                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               useDirectCall hook                     │    │
│  │  - Manages WebRTC peer connection (simple-peer)     │    │
│  │  - Handles local/remote MediaStreams                │    │
│  │  - Signaling via Supabase call_signals table        │    │
│  │  - Status sync via direct_calls table               │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Signaling Flow
1. **Caller** creates `direct_calls` record with `status: "ringing"`
2. **Callee** detects call via global listener, shows overlay
3. **Callee accepts** → updates status to `"accepted"`, creates peer
4. **Caller** detects status change via polling (1s interval)
5. **Both** exchange ICE candidates via `call_signals` table
6. **WebRTC** connection established, audio/video streams flow

### Key Technical Decisions
- **Polling fallback**: 1-second polling supplements Realtime for reliability
- **Global listener**: Centralized in AuthProvider to avoid competing subscriptions
- **simple-peer**: Wraps WebRTC for simpler API
- **Node.js polyfills**: Buffer, process, events for simple-peer browser compatibility

## 🔧 Previous Issues Fixed

### Issue: Callee answers but caller stays in "calling" state
**Root cause**: Duplicate `useIncomingCallListener` instances in AuthProvider AND Chats.tsx created competing Realtime subscriptions.
**Fix**: Removed duplicate from Chats.tsx, kept only in AuthProvider.

### Issue: Database not updating to "accepted" 
**Root cause**: Navigation happening before database update completed.
**Fix**: Ensured `await` on database update before any state transitions.

## 📋 TODO / Future Improvements

- [ ] Group video calls (Room-based)
- [ ] Screen sharing in calls
- [ ] Call recording
- [ ] TURN server for better NAT traversal
- [ ] Call quality indicators
- [ ] Mobile camera switching (front/back)
