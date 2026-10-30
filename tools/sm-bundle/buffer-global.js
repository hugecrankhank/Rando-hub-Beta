// DASH's encoder and sm-rando use Node's global Buffer without importing it;
// the same shim, made global for the bundle (esbuild --inject).
import { Buffer } from './buffer-shim.js';
globalThis.Buffer = Buffer;
