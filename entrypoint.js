// Polyfills must be imported before anything else — polyfills/fetch installs
// globalThis.Headers/Request/Response/fetch before the app graph (expo-router
// → SDK → openai shim → expo/fetch) evaluates and would throw without them.
import "./polyfills/fetch"
import "fast-text-encoding"
import "react-native-get-random-values"
import "@ethersproject/shims"
import { Buffer } from "buffer"

// Make Buffer globally available (required for Solana/Anchor)
global.Buffer = global.Buffer || Buffer

// Then import expo router
import "expo-router/entry"
