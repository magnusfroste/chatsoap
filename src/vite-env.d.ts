/// <reference types="vite/client" />

// Global declarations for Node.js polyfills (required by simple-peer)
import { Buffer as BufferType } from 'buffer';

declare global {
  interface Window {
    Buffer: typeof BufferType;
    process: NodeJS.Process;
    global: Window;
  }
}
