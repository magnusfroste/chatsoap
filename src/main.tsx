// Polyfills for Node.js modules required by simple-peer
import { Buffer } from 'buffer';
import process from 'process';

// Set globals before any other imports
window.Buffer = Buffer;
window.process = process;
window.global = window;

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
