# Solana dApp Store Submission

> SIP Privacy - Private Payments on Solana

## Submission Details

| Field | Value |
|-------|-------|
| **Submitted** | 2026-01-24 |
| **Status** | Pending Review (3-4 business days) |
| **App Name** | SIP Privacy |
| **Package** | org.sip_protocol.privacy |
| **Version** | 0.1.0 (version_code: 1) |

## On-Chain Addresses (Mainnet)

| NFT | Address | Explorer |
|-----|---------|----------|
| **App NFT** | `2THAY9h4MaxsCtbm2WVj1gn2NMbVN3GUhLQ1EkMvqQby` | [View](https://explorer.solana.com/address/2THAY9h4MaxsCtbm2WVj1gn2NMbVN3GUhLQ1EkMvqQby) |
| **Release NFT** | `Cq8m84EtYXovgqewZT52Qi4ntNqCQ2dpSiaZePXuEgBF` | [View](https://explorer.solana.com/address/Cq8m84EtYXovgqewZT52Qi4ntNqCQ2dpSiaZePXuEgBF) |
| **Publisher** | `S1PSkwV3YZD6exNiUEdfTJadyUJ1CDDUgwmQaWB5yie` | [View](https://explorer.solana.com/address/S1PSkwV3YZD6exNiUEdfTJadyUJ1CDDUgwmQaWB5yie) |

## Arweave Storage (Permanent)

| Asset | URL |
|-------|-----|
| **APK** | https://arweave.net/PW2HLJYu2Kl6rDbU9Mx0I7yZBqUp5LB0Id-FK8NUQdM |
| **App Icon** | https://arweave.net/K_fDGP8Z-dP3xYNuAw8C6yJtrA5rsr4XNQfnCFTUjLY |
| **Banner** | https://arweave.net/E3uFvhdpbh-MzO1RcrWsqVQhuD5TCjv0n5vGG6GqbYU |
| **Screenshot 1** | https://arweave.net/2JeByGbUboa8at-dy-U41zeBv5Y1i6kvMxfQ7AoRxMQ |
| **Screenshot 2** | https://arweave.net/5JM-bRUl6eqrDDSITT-dBAbTg3sAGlGlZHSNTPrg05M |
| **Screenshot 3** | https://arweave.net/l6tysTSS9w2LG_EAOGMiKTR98x4YD_LvQg-dkFupXE0 |
| **Screenshot 4** | https://arweave.net/57T28pnbEW8cn0-LcoBZCHfIVdI8Q9dMa3n57cCgWRo |
| **Screenshot 5** | https://arweave.net/Sxovwx6Q0O6NqbiwHhDRDi4wNwPe8RDRyoVeHzRNfj0 |

## Cost Breakdown

| Item | SOL |
|------|-----|
| Starting balance | 0.500000000 |
| Remaining balance | 0.443085313 |
| **Total spent** | **~0.057 SOL** |

Breakdown:
- App NFT rent-exempt: ~0.002 SOL
- Release NFT rent-exempt: ~0.002 SOL
- Arweave storage (APK + images): ~0.05 SOL
- Transaction fees: ~0.003 SOL

## APK Details

| Field | Value |
|-------|-------|
| File | `builds/sip-privacy-release.apk` |
| Size | 112 MB |
| SHA256 | `3rRbQomhmI+I3GJCdZTgREcjJvIrOaDx5ksUimdXLE8=` |
| Min SDK | 24 (Android 7.0) |
| Cert Fingerprint | `be3e93cf0ce6ee2dacaf11f56a9357870009d2814956946d0a23fc510fcc4e9d` |

## EAS Build

| Field | Value |
|-------|-------|
| Build ID | `b77b3d02-81c6-4830-86c4-e499ced12733` |
| Project | `rector89/sip-privacy` |
| Profile | `production` |
| URL | https://expo.dev/accounts/rector89/projects/sip-privacy/builds/b77b3d02-81c6-4830-86c4-e499ced12733 |

## Publisher Keypair

| Field | Value |
|-------|-------|
| Public Key | `S1PSkwV3YZD6exNiUEdfTJadyUJ1CDDUgwmQaWB5yie` |
| Encrypted Key | `~/.claude/sip-protocol/keys/solana/dapp-store.json.age` |
| Vanity Prefix | `S1P` (SIP Protocol branding) |

## Next Steps

- [ ] Wait for review approval (3-4 business days)
- [ ] Replace placeholder screenshots with real app screenshots
- [ ] Monitor for review feedback via email (rector@rectorspace.com)

## Updating the App

To submit an update:

```bash
cd ~/local-dev/sip-mobile/publishing

# 1. Build new APK via EAS
eas build --platform android --profile production

# 2. Download and place in builds/
mv ~/Downloads/new-build.apk builds/sip-privacy-release.apk

# 3. Decrypt keypair
age -d ~/.claude/sip-protocol/keys/solana/dapp-store.json.age > /tmp/dapp-store.json

# 4. Create new release NFT
npx @solana-mobile/dapp-store-cli create release \
  -k /tmp/dapp-store.json \
  -u https://api.mainnet-beta.solana.com \
  -b /opt/homebrew/share/android-commandlinetools/build-tools/36.0.0

# 5. Submit update
npx @solana-mobile/dapp-store-cli publish update \
  -k /tmp/dapp-store.json \
  -u https://api.mainnet-beta.solana.com \
  --complies-with-solana-dapp-store-policies \
  --requestor-is-authorized

# 6. Clean up
rm /tmp/dapp-store.json
```

---

*Submitted: 2026-01-24*
