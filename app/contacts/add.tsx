/**
 * Add Contact Screen
 *
 * Form to create a new contact for Private Social Payments.
 * - Name (required, max 50 chars)
 * - Address (required, Solana base58 or stealth meta-address)
 * - Stealth Meta-Address (optional, sip:solana:...)
 * - Favorite toggle
 * - Save button with validation
 */

import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Keyboard } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useState, useCallback } from "react"
import { router } from "expo-router"
import { ArrowLeftIcon, UserPlusIcon } from "phosphor-react-native"
import { TouchableOpacity } from "react-native"
import { ICON_COLORS } from "@/constants/icons"
import { useContactsStore } from "@/stores/contacts"
import { useToastStore } from "@/stores/toast"
import { validateContactName, validateContactAddress } from "@/utils/contacts"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Toggle } from "@/components/ui/Toggle"

// ============================================================================
// SCREEN
// ============================================================================

export default function AddContactScreen() {
  const addContact = useContactsStore((s) => s.addContact)
  const { addToast } = useToastStore()

  // Form state
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [stealthMeta, setStealthMeta] = useState("")
  const [isFavorite, setIsFavorite] = useState(false)

  // Validation state
  const [nameError, setNameError] = useState<string | null>(null)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [stealthError, setStealthError] = useState<string | null>(null)

  // ──────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ──────────────────────────────────────────────────────────────────────────

  const handleNameChange = useCallback((value: string) => {
    setName(value)
    if (nameError) {
      const validation = validateContactName(value)
      setNameError(validation.isValid ? null : validation.error || null)
    }
  }, [nameError])

  const handleAddressChange = useCallback((value: string) => {
    setAddress(value)
    if (addressError && value.length > 10) {
      const validation = validateContactAddress(value)
      setAddressError(validation.isValid ? null : validation.error || null)
    }
  }, [addressError])

  const handleStealthMetaChange = useCallback((value: string) => {
    setStealthMeta(value)
    if (stealthError && value.length > 0) {
      // Stealth meta must start with sip:solana: if provided
      if (value.startsWith("sip:solana:") || value === "") {
        setStealthError(null)
      }
    }
  }, [stealthError])

  const handleSave = useCallback(() => {
    Keyboard.dismiss()

    // Validate name
    const nameValidation = validateContactName(name)
    if (!nameValidation.isValid) {
      setNameError(nameValidation.error || "Invalid name")
      return
    }

    // Validate address
    const addressValidation = validateContactAddress(address)
    if (!addressValidation.isValid) {
      setAddressError(addressValidation.error || "Invalid address")
      return
    }

    // Validate stealth meta (optional, but must be valid format if provided)
    const trimmedStealth = stealthMeta.trim()
    if (trimmedStealth && !trimmedStealth.startsWith("sip:solana:")) {
      setStealthError("Stealth address must start with sip:solana:")
      return
    }

    // Save contact
    addContact({
      name: name.trim(),
      address: address.trim(),
      stealthMeta: trimmedStealth || undefined,
      chain: "solana",
      isFavorite,
    })

    addToast({
      type: "success",
      title: "Contact saved",
      message: `${name.trim()} has been added to your contacts.`,
    })

    router.back()
  }, [name, address, stealthMeta, isFavorite, addContact, addToast])

  const isFormValid = name.trim().length > 0 && address.trim().length > 0

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center px-6 pt-6 pb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 bg-dark-900 rounded-full items-center justify-center mr-3"
            activeOpacity={0.7}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeftIcon size={20} color="#ffffff" weight="bold" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-white">Add Contact</Text>
            <Text className="text-dark-400 text-sm mt-0.5">
              Save a contact for quick payments
            </Text>
          </View>
          <View className="w-10 h-10 bg-brand-900/30 rounded-full items-center justify-center">
            <UserPlusIcon size={20} color={ICON_COLORS.brand} weight="regular" />
          </View>
        </View>

        <ScrollView
          className="flex-1 px-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Name Field */}
          <Input
            label="Name"
            placeholder="Contact name"
            value={name}
            onChangeText={handleNameChange}
            error={nameError || undefined}
            maxLength={50}
            autoCapitalize="words"
            autoCorrect={false}
            className="mb-4"
          />

          {/* Address Field */}
          <Input
            label="Address"
            placeholder="Solana address or sip:solana:..."
            value={address}
            onChangeText={handleAddressChange}
            error={addressError || undefined}
            autoCapitalize="none"
            autoCorrect={false}
            hint="32-44 character Solana address or SIP stealth address"
            className="mb-4"
          />

          {/* Stealth Meta-Address Field */}
          <Input
            label="Stealth Meta-Address (optional)"
            placeholder="sip:solana:<spendKey>:<viewKey>"
            value={stealthMeta}
            onChangeText={handleStealthMetaChange}
            error={stealthError || undefined}
            autoCapitalize="none"
            autoCorrect={false}
            hint="For full privacy, use their stealth meta-address"
            className="mb-4"
          />

          {/* Favorite Toggle */}
          <View className="bg-dark-900 rounded-xl border border-dark-800 px-4 mb-6">
            <Toggle
              value={isFavorite}
              onValueChange={setIsFavorite}
              label="Favorite"
              description="Show in favorites section for quick access"
            />
          </View>
        </ScrollView>

        {/* Save Button */}
        <View className="px-6 pb-6 pt-2 border-t border-dark-900">
          <Button
            fullWidth
            size="lg"
            onPress={handleSave}
            disabled={!isFormValid}
            accessibilityLabel="Save contact"
            accessibilityHint="Saves the contact and returns to the contact list"
          >
            Save Contact
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
