// Polyfills for Node.js modules required by simple-peer
import { Buffer } from 'buffer';
import process from 'process/browser';
import { EventEmitter } from 'events';

// Set globals before any other imports
(window as any).Buffer = Buffer;
(window as any).process = process;
(window as any).global = window;

// Ensure process.nextTick exists for stream-browserify
if (!process.nextTick) {
  (process as any).nextTick = (fn: Function, ...args: any[]) => {
    queueMicrotask(() => fn(...args));
  };
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
