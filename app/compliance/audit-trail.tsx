/**
 * Audit Trail Screen
 *
 * Displays chronological compliance events:
 * - Key exports and disclosures
 * - Payments sent/received
 * - Swaps executed
 * - Reports generated
 */

import { View, Text, TouchableOpacity, FlatList, RefreshControl } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from "expo-router"
import { useState, useMemo, useCallback } from "react"
import { useCompliance } from "@/hooks"
import { useToastStore } from "@/stores/toast"
import { Modal } from "@/components/ui"
import type { AuditEventType, AuditEvent } from "@/stores"
import {
  ArrowLeftIcon,
  ExportIcon,
  KeyIcon,
  ProhibitIcon,
  DownloadIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ArrowsLeftRightIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
  ClipboardTextIcon,
  TrashIcon,
} from "phosphor-react-native"
import type { Icon as PhosphorIcon } from "phosphor-react-native"
import { ICON_COLORS } from "@/constants/icons"

// ============================================================================
// HELPERS
// ============================================================================

function getEventIcon(type: AuditEventType): PhosphorIcon {
  const icons: Record<AuditEventType, PhosphorIcon> = {
    key_export: ExportIcon,
    key_disclosure: KeyIcon,
    key_revocation: ProhibitIcon,
    key_import: DownloadIcon,
    payment_sent: ArrowRightIcon,
    payment_received: ArrowLeftIcon,
    payment_claimed: CheckCircleIcon,
    swap_executed: ArrowsLeftRightIcon,
    scan_performed: MagnifyingGlassIcon,
    report_generated: ChartBarIcon,
  }
  return icons[type] || ClipboardTextIcon
}

function getEventColor(type: AuditEventType): string {
  switch (type) {
    case "key_disclosure":
    case "key_export":
      return "text-yellow-400"
    case "key_revocation":
      return "text-red-400"
    case "payment_sent":
    case "swap_executed":
      return "text-blue-400"
    case "payment_received":
    case "payment_claimed":
      return "text-green-400"
    case "scan_performed":
    case "report_generated":
      return "text-brand-400"
    default:
      return "text-dark-300"
  }
}

function getEventLabel(type: AuditEventType): string {
  const labels: Record<AuditEventType, string> = {
    key_export: "Key Export",
    key_disclosure: "Key Disclosure",
    key_revocation: "Key Revocation",
    key_import: "Key Import",
    payment_sent: "Payment Sent",
    payment_received: "Payment Received",
    payment_claimed: "Payment Claimed",
    swap_executed: "Swap Executed",
    scan_performed: "Scan Performed",
    report_generated: "Report Generated",
  }
  return labels[type] || type
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 1) return "Just now"
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffHours < 48) return "Yesterday"

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ============================================================================
// COMPONENTS
// ============================================================================

type FilterType = "all" | "keys" | "transactions" | "reports"

const FILTERS: Array<{ key: FilterType; label: string }> = [
  { key: "all", label: "All" },
  { key: "keys", label: "Keys" },
  { key: "transactions", label: "Transactions" },
  { key: "reports", label: "Reports" },
]

function filterEvents(events: AuditEvent[], filter: FilterType): AuditEvent[] {
  if (filter === "all") return events

  const keyEvents: AuditEventType[] = [
    "key_export",
    "key_disclosure",
    "key_revocation",
    "key_import",
  ]
  const transactionEvents: AuditEventType[] = [
    "payment_sent",
    "payment_received",
    "payment_claimed",
    "swap_executed",
  ]
  const reportEvents: AuditEventType[] = ["report_generated", "scan_performed"]

  switch (filter) {
    case "keys":
      return events.filter((e) => keyEvents.includes(e.type))
    case "transactions":
      return events.filter((e) => transactionEvents.includes(e.type))
    case "reports":
      return events.filter((e) => reportEvents.includes(e.type))
    default:
      return events
  }
}

interface EventItemProps {
  event: AuditEvent
  onPress: () => void
}

function EventItem({ event, onPress }: EventItemProps) {
  const IconComponent = getEventIcon(event.type)
  return (
    <TouchableOpacity
      className="bg-dark-900 rounded-xl p-4 mb-3"
      onPress={onPress}
    >
      <View className="flex-row items-start">
        <View className="w-10 h-10 rounded-lg bg-dark-800 items-center justify-center mr-3">
          <IconComponent size={20} color={ICON_COLORS.muted} weight="fill" />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <Text className={`font-semibold ${getEventColor(event.type)}`}>
              {getEventLabel(event.type)}
            </Text>
            <Text className="text-dark-500 text-xs">
              {formatTimestamp(event.timestamp)}
            </Text>
          </View>
          <Text className="text-dark-300 text-sm" numberOfLines={2}>
            {event.description}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function AuditTrailScreen() {
  const { auditEvents, clearAuditTrail } = useCompliance()
  const { addToast } = useToastStore()

  const [filter, setFilter] = useState<FilterType>("all")
  const [refreshing, setRefreshing] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const filteredEvents = useMemo(
    () => filterEvents(auditEvents, filter),
    [auditEvents, filter]
  )

  const filterCounts = useMemo(() => {
    return {
      all: auditEvents.length,
      keys: filterEvents(auditEvents, "keys").length,
      transactions: filterEvents(auditEvents, "transactions").length,
      reports: filterEvents(auditEvents, "reports").length,
    }
  }, [auditEvents])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await new Promise((resolve) => setTimeout(resolve, 500))
    setRefreshing(false)
  }, [])

  const handleEventPress = useCallback((event: AuditEvent) => {
    setSelectedEvent(event)
    setShowDetailModal(true)
  }, [])

  const handleClearTrail = useCallback(() => {
    clearAuditTrail()
    setShowClearConfirm(false)
    addToast({
      type: "success",
      title: "Audit Trail Cleared",
      message: "All audit events have been removed",
    })
  }, [clearAuditTrail, addToast])

  const renderItem = useCallback(
    ({ item }: { item: AuditEvent }) => (
      <EventItem event={item} onPress={() => handleEventPress(item)} />
    ),
    [handleEventPress]
  )

  const keyExtractor = useCallback((item: AuditEvent) => item.id, [])

  const ListEmptyComponent = useMemo(
    () => (
      <View className="items-center py-16">
        <View className="w-24 h-24 rounded-full bg-dark-800 items-center justify-center mb-4">
          <ClipboardTextIcon size={48} color={ICON_COLORS.inactive} weight="fill" />
        </View>
        <Text className="text-white text-xl font-semibold mb-2">
          No Audit Events
        </Text>
        <Text className="text-dark-400 text-center px-8">
          {filter === "all"
            ? "Compliance events will appear here as you use the app"
            : `No ${filter} events found`}
        </Text>
      </View>
    ),
    [filter]
  )

  return (
    <SafeAreaView className="flex-1 bg-dark-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-dark-800">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-2 -ml-2">
            <ArrowLeftIcon size={24} color={ICON_COLORS.white} weight="bold" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">Audit Trail</Text>
        </View>
        {auditEvents.length > 0 && (
          <TouchableOpacity
            className="p-2"
            onPress={() => setShowClearConfirm(true)}
          >
            <Text className="text-red-400 text-sm">Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips */}
      <View className="px-4 py-3">
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={FILTERS}
          renderItem={({ item }) => (
            <TouchableOpacity
              className={`px-4 py-2 rounded-full mr-2 flex-row items-center ${
                filter === item.key ? "bg-brand-600" : "bg-dark-800"
              }`}
              onPress={() => setFilter(item.key)}
            >
              <Text
                className={`font-medium ${
                  filter === item.key ? "text-white" : "text-dark-300"
                }`}
              >
                {item.label}
              </Text>
              <View
                className={`ml-2 px-1.5 py-0.5 rounded-full ${
                  filter === item.key ? "bg-brand-500" : "bg-dark-700"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    filter === item.key ? "text-white" : "text-dark-400"
                  }`}
                >
                  {filterCounts[item.key]}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.key}
        />
      </View>

      {/* Event List */}
      <FlatList
        className="flex-1 px-4"
        data={filteredEvents}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8b5cf6"
            colors={["#8b5cf6"]}
          />
        }
      />

      {/* Event Detail Modal */}
      <Modal
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Event Details"
      >
        {selectedEvent && (
          <View>
            <View className="items-center py-4">
              <View className="w-16 h-16 rounded-xl bg-dark-800 items-center justify-center mb-4">
                {(() => {
                  const IconComp = getEventIcon(selectedEvent.type)
                  return <IconComp size={32} color={ICON_COLORS.brand} weight="fill" />
                })()}
              </View>
              <Text className={`text-xl font-semibold ${getEventColor(selectedEvent.type)}`}>
                {getEventLabel(selectedEvent.type)}
              </Text>
            </View>

            <View className="bg-dark-800 rounded-xl p-4 mb-4">
              <View className="mb-3">
                <Text className="text-dark-400 text-sm mb-1">Description</Text>
                <Text className="text-white">{selectedEvent.description}</Text>
              </View>

              <View className="mb-3">
                <Text className="text-dark-400 text-sm mb-1">Timestamp</Text>
                <Text className="text-white">
                  {new Date(selectedEvent.timestamp).toLocaleString()}
                </Text>
              </View>

              {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                <View>
                  <Text className="text-dark-400 text-sm mb-1">Metadata</Text>
                  <Text className="text-dark-300 text-xs font-mono">
                    {JSON.stringify(selectedEvent.metadata, null, 2)}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              className="bg-brand-600 py-3 rounded-xl items-center"
              onPress={() => setShowDetailModal(false)}
            >
              <Text className="text-white font-medium">Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>

      {/* Clear Confirmation Modal */}
      <Modal
        visible={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear Audit Trail"
      >
        <View className="items-center py-4">
          <View className="w-24 h-24 rounded-full bg-red-900/30 items-center justify-center mb-4">
            <TrashIcon size={48} color={ICON_COLORS.error} weight="fill" />
          </View>
          <Text className="text-white text-lg font-semibold text-center mb-2">
            Clear All Audit Events?
          </Text>
          <Text className="text-dark-400 text-center mb-6">
            This will remove all {auditEvents.length} audit events. This action
            cannot be undone.
          </Text>

          <View className="w-full flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-dark-800 py-3 rounded-xl items-center"
              onPress={() => setShowClearConfirm(false)}
            >
              <Text className="text-white font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-red-600 py-3 rounded-xl items-center"
              onPress={handleClearTrail}
            >
              <Text className="text-white font-medium">Clear All</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}
