import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { Attachment } from '@/types'

export const useAttachmentsStore = defineStore('attachments', () => {
  const attachments = ref<Attachment[]>([
    {
      id: 'mower',
      name: 'Rotary Mower',
      type: 'Mower',
      status: 'available',
      hours: 127,
      lastService: '2024-11-15'
    },
    {
      id: 'sprayer',
      name: 'Spot Sprayer',
      type: 'Sprayer',
      status: 'available',
      hours: 43,
      lastService: '2024-12-01'
    },
    {
      id: 'aerator',
      name: 'Core Aerator',
      type: 'Aerator',
      status: 'maintenance',
      hours: 89,
      lastService: '2024-10-20'
    },
    {
      id: 'spreader',
      name: 'Fertilizer Spreader',
      type: 'Spreader',
      status: 'available',
      hours: 56,
      lastService: '2024-11-28'
    }
  ])

  const currentAttachment = ref<Attachment | null>(attachments.value[0])

  function setCurrentAttachment(attachment: Attachment) {
    currentAttachment.value = attachment
  }

  function updateAttachment(id: string, updates: Partial<Attachment>) {
    const index = attachments.value.findIndex(a => a.id === id)
    if (index !== -1) {
      attachments.value[index] = { ...attachments.value[index], ...updates }
    }
  }

  function incrementHours(id: string, hours: number) {
    const attachment = attachments.value.find(a => a.id === id)
    if (attachment) {
      attachment.hours += hours
    }
  }

  return {
    attachments,
    currentAttachment,
    setCurrentAttachment,
    updateAttachment,
    incrementHours
  }
})
