/**
 * Contact List Screen
 *
 * Displays saved contacts for Private Social Payments.
 * - Favorites section at top (if any exist)
 * - All contacts sorted by most recent payment, then creation date
 * - Tap contact to navigate to send screen with pre-filled recipient
 * - "Add" button navigates to /contacts/add
 */

import { View, Text, ScrollView, TouchableOpacity } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { PlusIcon, StarIcon, PaperPlaneTiltIcon, UserCircleIcon } from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"
import { hapticLight } from "@/utils/haptics"
import { useContactsStore } from "@/stores/contacts"
import { sortContacts, truncateAddress } from "@/utils/contacts"
import { EmptyState } from "@/components/ui/EmptyState"
import type { Contact } from "@/types/contacts"

// ============================================================================
// CONTACT ROW
// ============================================================================

function ContactRow({ contact }: { contact: Contact }) {
  const handlePress = () => {
    hapticLight()
    router.push({
      pathname: "/(tabs)/send",
      params: {
        recipient: contact.address,
        contactName: contact.name,
      },
    })
  }

  return (
    <TouchableOpacity
      className="flex-row items-center bg-dark-900 rounded-xl p-4 mb-2 border border-dark-800"
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityLabel={`Send payment to ${contact.name}`}
      accessibilityHint="Opens the send screen with this contact as recipient"
      accessibilityRole="button"
    >
      {/* Avatar */}
      <View className="w-11 h-11 bg-dark-800 rounded-full items-center justify-center mr-3">
        <UserCircleIcon size={28} color={ICON_COLORS.muted} weight="regular" />
      </View>

      {/* Name + Address */}
      <View className="flex-1 mr-3">
        <View className="flex-row items-center gap-1.5">
          <Text className="text-white font-semibold text-base" numberOfLines={1}>
            {contact.name}
          </Text>
          {contact.isFavorite && (
            <StarIcon size={14} color={ICON_COLORS.warning} weight="fill" />
          )}
        </View>
        <Text className="text-dark-400 text-sm mt-0.5" numberOfLines={1}>
          {truncateAddress(contact.address)}
        </Text>
      </View>

      {/* Payment count badge */}
      {contact.paymentCount > 0 && (
        <View className="flex-row items-center gap-1 bg-dark-800 px-2.5 py-1 rounded-lg">
          <PaperPlaneTiltIcon size={12} color={ICON_COLORS.brand} weight="fill" />
          <Text className="text-dark-300 text-xs font-medium">
            {contact.paymentCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

// ============================================================================
// SCREEN
// ============================================================================

export default function ContactListScreen() {
  const contacts = useContactsStore((s) => s.contacts)

  const sorted = sortContacts(contacts)
  const favorites = sorted.filter((c) => c.isFavorite)
  const nonFavorites = sorted.filter((c) => !c.isFavorite)

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 pt-6 pb-4">
        <Text className="text-3xl font-bold text-white">Contacts</Text>
        <TouchableOpacity
          className="bg-brand-600 w-10 h-10 rounded-full items-center justify-center"
          onPress={() => router.push("/contacts/add")}
          activeOpacity={0.7}
          accessibilityLabel="Add contact"
          accessibilityHint="Opens the add contact form"
          accessibilityRole="button"
        >
          <PlusIcon size={20} color="#ffffff" weight="bold" />
        </TouchableOpacity>
      </View>

      {/* Empty State */}
      {contacts.length === 0 ? (
        <EmptyState
          title="No Contacts Yet"
          message="Add contacts to send private payments quickly."
          iconName="wallet"
          actionLabel="Add Contact"
          onAction={() => router.push("/contacts/add")}
          className="flex-1"
        />
      ) : (
        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {/* Favorites Section */}
          {favorites.length > 0 && (
            <View className="mb-4">
              <View className="flex-row items-center gap-1.5 mb-3">
                <StarIcon size={16} color={ICON_COLORS.warning} weight="fill" />
                <Text className="text-dark-400 text-sm font-medium">Favorites</Text>
              </View>
              {favorites.map((contact) => (
                <ContactRow key={contact.id} contact={contact} />
              ))}
            </View>
          )}

          {/* All Contacts Section */}
          {nonFavorites.length > 0 && (
            <View>
              {favorites.length > 0 && (
                <Text className="text-dark-400 text-sm font-medium mb-3">
                  All Contacts
                </Text>
              )}
              {nonFavorites.map((contact) => (
                <ContactRow key={contact.id} contact={contact} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
