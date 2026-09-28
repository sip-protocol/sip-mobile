// RN 0.86 removed the WHATWG fetch polyfills from core (no setUpFetching), but
// expo/fetch — pulled in by the openai Expo shim inside @sip-protocol/sdk —
// throws at import time when globalThis.Headers is missing. That exception is
// fatal on bridgeless RN: handleHostException destroys the React instance and
// the app white-screens.
//
// This module MUST be the first import in entrypoint.js: ES module hoisting
// means every other import (expo-router/entry and the whole app graph,
// including the SDK chain that evaluates expo/fetch) runs before any
// statement in entrypoint.js itself.

// Restore the exact globals RN core used to install — eagerly (no lazy
// getters): expo/fetch's runtime check runs seconds after bundle eval and
// must see concrete values.
const whatwgFetch = require("whatwg-fetch")
// Non-configurable + non-writable: nothing downstream can delete or shadow
// these (a delete of a configurable property is silent and would leave
// expo/fetch's later check seeing undefined).
Object.defineProperty(globalThis, "Headers", { value: whatwgFetch.Headers, writable: false, configurable: false, enumerable: true })
Object.defineProperty(globalThis, "Request", { value: whatwgFetch.Request, writable: false, configurable: false, enumerable: true })
Object.defineProperty(globalThis, "Response", { value: whatwgFetch.Response, writable: false, configurable: false, enumerable: true })
Object.defineProperty(globalThis, "fetch", { value: whatwgFetch.fetch, writable: false, configurable: false, enumerable: true })

// Fail loud: if this fires, the polyfill ran but did not install Headers
// (distinguishes "ran and failed" from "never executed" in the field).
if (!globalThis.Headers) {
  throw new Error("SIP_POLYFILL_HEADERS_MISSING")
}
