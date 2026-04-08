# SIP Mobile: Privacy Provider Integration Guide

This guide explains how to integrate the new Privacy Provider architecture into the SIP Mobile app.

## Architecture Overview

The integration is built around a unified interface (`PrivacyProvider`) that allows the app to support multiple privacy engines (SIP Native, Privacy Cash, ShadowWire) through a single set of methods.

## Components Included

1.  **`PrivacyProviderInterface.ts`**: The core TypeScript interface definition.
2.  **`PrivacySettings.js`**: A React Native component for the user to select and configure their active privacy provider.
3.  **`PrivacyCashAdapter.ts`**: Adapter for Zero-Knowledge pool mixing via Privacy Cash.
4.  **`ShadowWireAdapter.ts`**: Adapter for Bulletproofs-based privacy via ShadowWire.

## How to Integrate

### 1. Register Providers
In your main application state or a dedicated context provider:

```typescript
import { SIPNativeProvider } from './PrivacyProviderInterface';
import { PrivacyCashAdapter } from './PrivacyCashAdapter';
import { ShadowWireAdapter } from './ShadowWireAdapter';

const providers = [
  new SIPNativeProvider(),
  new PrivacyCashAdapter(),
  new ShadowWireAdapter()
];
```

### 2. Active Provider Logic
When a user selects a provider in the `PrivacySettings` UI, store the active provider ID.

```typescript
const [activeProviderId, setActiveProviderId] = useState('sip-native');
const activeProvider = providers.find(p => p.id === activeProviderId);
```

### 3. Use in Send/Swap Screens
When preparing a transaction, use the active provider's methods to handle privacy features:

```typescript
// Example: Generating a stealth address for a recipient
const recipientStealthAddress = await activeProvider.generateStealthAddress();

// Example: Preparing a private transaction
const txData = await activeProvider.prepareTransaction(amount, recipientStealthAddress);
```

## SIP Unique Value: Viewing Keys
For compliance and auditability, use the `getViewingKey()` method to generate a key that can decrypt the transaction details later using `decryptTransaction()`.

---
*Created by Zaki & Atlas (Digital Familiar) for the Solana Privacy Hackathon 2026.*
