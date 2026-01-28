/**
 * Settings Store Tests
 */

import { describe, it, expect, beforeEach } from "vitest"
import { useSettingsStore, SLIPPAGE_PRESETS } from "@/stores/settings"

describe("Settings Store", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      slippage: 1.0,
      defaultPrivacyLevel: "shielded",
      biometricsEnabled: false,
      network: "devnet",
      rpcProvider: "helius",
    })
  })

  describe("Slippage Settings", () => {
    it("should default to 1%", () => {
      const { slippage } = useSettingsStore.getState()
      expect(slippage).toBe(1.0)
    })

    it("should set slippage", () => {
      const { setSlippage } = useSettingsStore.getState()

      setSlippage(0.5)
      expect(useSettingsStore.getState().slippage).toBe(0.5)

      setSlippage(3.0)
      expect(useSettingsStore.getState().slippage).toBe(3.0)
    })

    it("should clamp slippage to min 0.01", () => {
      const { setSlippage } = useSettingsStore.getState()

      setSlippage(0.001)
      expect(useSettingsStore.getState().slippage).toBe(0.01)

      setSlippage(-5)
      expect(useSettingsStore.getState().slippage).toBe(0.01)
    })

    it("should clamp slippage to max 50", () => {
      const { setSlippage } = useSettingsStore.getState()

      setSlippage(100)
      expect(useSettingsStore.getState().slippage).toBe(50)
    })

    it("should convert slippage to decimal", () => {
      const { setSlippage, getSlippageDecimal } = useSettingsStore.getState()

      setSlippage(1.0)
      expect(getSlippageDecimal()).toBe(0.01)

      setSlippage(0.5)
      expect(useSettingsStore.getState().getSlippageDecimal()).toBe(0.005)
    })
  })

  describe("Privacy Settings", () => {
    it("should default to shielded", () => {
      const { defaultPrivacyLevel } = useSettingsStore.getState()
      expect(defaultPrivacyLevel).toBe("shielded")
    })

    it("should set privacy level", () => {
      const { setDefaultPrivacyLevel } = useSettingsStore.getState()

      setDefaultPrivacyLevel("transparent")
      expect(useSettingsStore.getState().defaultPrivacyLevel).toBe("transparent")

      setDefaultPrivacyLevel("compliant")
      expect(useSettingsStore.getState().defaultPrivacyLevel).toBe("compliant")
    })
  })

  describe("Biometrics Settings", () => {
    it("should default to disabled", () => {
      const { biometricsEnabled } = useSettingsStore.getState()
      expect(biometricsEnabled).toBe(false)
    })

    it("should toggle biometrics", () => {
      const { setBiometricsEnabled } = useSettingsStore.getState()

      setBiometricsEnabled(true)
      expect(useSettingsStore.getState().biometricsEnabled).toBe(true)

      setBiometricsEnabled(false)
      expect(useSettingsStore.getState().biometricsEnabled).toBe(false)
    })
  })

  describe("Network Settings", () => {
    it("should default to devnet", () => {
      const { network } = useSettingsStore.getState()
      expect(network).toBe("devnet")
    })

    it("should set network", () => {
      const { setNetwork } = useSettingsStore.getState()

      setNetwork("mainnet-beta")
      expect(useSettingsStore.getState().network).toBe("mainnet-beta")

      setNetwork("devnet")
      expect(useSettingsStore.getState().network).toBe("devnet")

      setNetwork("testnet")
      expect(useSettingsStore.getState().network).toBe("testnet")
    })
  })

  describe("RPC Provider Settings", () => {
    it("should default to helius", () => {
      const { rpcProvider } = useSettingsStore.getState()
      expect(rpcProvider).toBe("helius")
    })

    it("should set rpc provider", () => {
      const { setRpcProvider } = useSettingsStore.getState()

      setRpcProvider("quicknode")
      expect(useSettingsStore.getState().rpcProvider).toBe("quicknode")

      setRpcProvider("triton")
      expect(useSettingsStore.getState().rpcProvider).toBe("triton")

      setRpcProvider("publicnode")
      expect(useSettingsStore.getState().rpcProvider).toBe("publicnode")
    })
  })
})

describe("Slippage Presets", () => {
  it("should have expected presets", () => {
    expect(SLIPPAGE_PRESETS).toContain(0.1)
    expect(SLIPPAGE_PRESETS).toContain(0.5)
    expect(SLIPPAGE_PRESETS).toContain(1.0)
    expect(SLIPPAGE_PRESETS).toContain(3.0)
  })

  it("should have 4 presets", () => {
    expect(SLIPPAGE_PRESETS).toHaveLength(4)
  })
})
