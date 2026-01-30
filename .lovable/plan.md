

# Call State Synchronization Fix

## Problem Analysis

The current calling implementation has a critical issue: **when Magnus2 answers the call, Magnus stays in "ringing" state** instead of transitioning to "connected".

### Root Cause Identified

Looking at the database logs, all recent calls show `started_at: nil` and `status: ended` - meaning **no call ever successfully transitioned to "accepted"**. This points to a race condition in the Realtime subscription logic:

1. **Magnus (caller)** creates a call with `status: "ringing"` and sets up a status listener
2. **Magnus2 (callee)** receives the call via `useIncomingCallListener` 
3. **Magnus2 accepts** - updates `status: "accepted"` in the database
4. **Problem**: Magnus's status listener uses `callState.status` in the dependency array, which triggers a channel recreation **before the UPDATE event is received**

The issue is in `useDirectCall.ts` lines 556-640 where the effect depends on `callState.status`. When the caller is in "calling" state, any state update causes the effect to re-run, unsubscribing from the old channel and creating a new one - **missing the "accepted" event**.

### Evidence from Console Logs
```
[DirectCall] Call status subscription: SUBSCRIBED
[DirectCall] Call status update received: ended
```
The subscription only receives "ended" (when caller hangs up) but never "accepted" because the channel was recreated.

## Proposed Solution

### Architecture Consideration

Before implementing a fix, I want to address your questions:

1. **Separate audio component?** - Yes, abstracting the WebRTC/audio logic into a separate service would help, but the core issue is state management, not the audio layer itself.

2. **Switch to Agora?** - Agora would handle the complex signaling automatically, but the current issue is specifically with **Supabase Realtime subscription management**, not WebRTC itself. Fixing the subscription logic should resolve this.

### Fix Strategy: Stable Channel Subscriptions

The fix involves making the call status subscription stable (not re-created on every state change):

#### 1. Refactor Status Listener Effect (useDirectCall.ts)

```text
Current (problematic):
+------------------+      +------------------+      +------------------+
| callState:       | ---> | Effect runs,     | ---> | New channel      |
| "calling"        |      | creates channel  |      | misses UPDATE    |
+------------------+      +------------------+      +------------------+
         |
         v (state change from external update)
+------------------+
| Effect re-runs,  |
| old channel gone |
+------------------+

Fixed:
+------------------+      +------------------+      +------------------+
| callIdRef only   | ---> | Effect stable    | ---> | Same channel     |
| as dependency    |      | on status change |      | receives UPDATE  |
+------------------+      +------------------+      +------------------+
```

#### Key Changes:

1. **Remove `callState.status` from dependencies** - Use `callIdRef` instead
2. **Add early exit inside effect** - Check if call is still active
3. **Use refs for state checks** - Avoid closure issues
4. **Add accepted status listener in useIncomingCallListener** - Ensure caller can also detect the status change

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useDirectCall.ts` | Refactor status listener to use stable refs instead of state dependencies |

### Implementation Details

```typescript
// useDirectCall.ts - Lines 556-640
// BEFORE: Dependencies include callState.status causing re-subscription
useEffect(() => {
  if (!userId || callState.status === "idle" || callState.status === "ended") return;
  const callId = callIdRef.current;
  if (!callId) return;
  // ... creates channel
}, [callState.status, callState.callId, userId, stopLocalMedia]); // Problem!

// AFTER: Only depend on callId changes, check status via ref
const callStatusRef = useRef(callState.status);
callStatusRef.current = callState.status;

useEffect(() => {
  const callId = callIdRef.current;
  if (!callId || !userId) return;
  
  // Early exit if no longer active
  if (callStatusRef.current === "idle" || callStatusRef.current === "ended") return;
  
  // Channel name based only on callId (stable)
  const channelName = `call-status-${callId}`;
  // ... rest of logic
}, [userId]); // Minimal dependencies

// Also: set up channel when callIdRef changes
useEffect(() => {
  // Subscribe when we get a new callId
}, [callState.callId]);
```

### Alternative: Use Polling as Fallback

If Realtime proves unreliable, add a polling fallback that checks call status every 2 seconds while in "calling" state. This is less elegant but more robust.

## Regarding Agora

Agora is a solid option if you need:
- More reliable signaling
- TURN servers for NAT traversal
- Recording, analytics, etc.

However, the current issue is solvable with the Supabase approach. Agora adds complexity (SDK, billing, another dependency) and the fix above should resolve the state sync issue.

## Technical Implementation Summary

1. Add `callStatusRef` to track status without causing re-renders
2. Split the status listener effect into two effects:
   - One for channel setup (depends only on `callId`)
   - One for cleanup (depends on `userId`)
3. Use stable channel names without timestamps when monitoring an active call
4. Add defensive null checks for `callIdRef.current` inside the listener

