/**
 * Contacts Stack Layout
 *
 * Routes:
 * - /contacts       → Contact list
 * - /contacts/add   → Add new contact form
 */

import { Stack } from "expo-router"

export default function ContactsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0a0a0a" },
        animation: "slide_from_right",
      }}
    />
  )
}
