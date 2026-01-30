// Polyfills for Node.js modules used by simple-peer
import { Buffer } from 'buffer';
import process from 'process/browser';
import { EventEmitter } from 'events';

// Ensure global polyfills are available
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Buffer = Buffer;
  (globalThis as any).process = process;
  (globalThis as any).global = globalThis;
  
  // Ensure process.nextTick exists
  if (!process.nextTick) {
    (process as any).nextTick = (fn: Function, ...args: any[]) => {
      queueMicrotask(() => fn(...args));
    };
  }
}

export { Buffer, process, EventEmitter };
