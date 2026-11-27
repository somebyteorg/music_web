<script lang="ts" setup>
import Card from '@/components/ui/Card.vue'
import TextButton from '@/components/ui/TextButton.vue'
import { date } from '@/utils/format'
import { useCommunityContext } from './communityContext'

/**
 * 消息栏目：消息卡片列表。标为已读走控制器的 read（负责重新拉取与广播）。
 */
const { community } = useCommunityContext()
const { messages, acting, read } = community
</script>

<template>
  <div v-if="messages.length" class="message-list">
    <Card
      v-for="message in messages"
      :key="message.id"
      as="article"
      :class="['message', { unread: !message.read_at }]"
    >
      <span class="message-icon">✉</span>
      <div>
        <h3>{{ message.title }}</h3>
        <p>{{ message.body }}</p>
        <span class="hint">{{ date(message.created_at) }}</span>
        <RouterLink
          v-if="message.link?.startsWith('/')"
          :to="message.link"
          class="text-link"
          @click="read(message.id)"
          >查看详情 ↗</RouterLink
        >
      </div>
      <TextButton v-if="!message.read_at" :disabled="acting" @click="read(message.id)">
        标为已读
      </TextButton>
    </Card>
  </div>
</template>

<style scoped>
@layer components {
  .message-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .message {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
  }
  .message.unread {
    background: var(--surface-unread);
    border-color: var(--brand-line-unread);
  }
  .message-icon {
    font-size: 22px;
    color: var(--brand);
  }
  .message > div {
    min-width: 0;
    flex: 1;
  }
  .message h3 {
    font-size: 14px;
  }
  .message p {
    margin: 6px 0;
    color: var(--text-muted);
    font-size: 13px;
    white-space: pre-line;
  }
  .message .hint {
    font-size: 11px;
  }
  .message .text-link {
    margin-left: 12px;
  }
  .message .text-button {
    white-space: nowrap;
  }
  @media (max-width: 680px) {
    .message {
      padding: 12px;
      gap: 10px;
      flex-wrap: wrap;
    }
    .message .text-button {
      margin-left: 32px;
    }
  }
}
</style>
