<script lang="ts" setup>
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import TextButton from '@/components/ui/TextButton.vue'
import Tag from '@/components/ui/Tag.vue'
import BaseSelect from '@/components/BaseSelect.vue'
import { bytes, displayName } from '@/utils/format'
import { useCommunityContext } from './communityContext'

/**
 * 成员栏目：搜索栏 + 成员榜。角色下拉只改控制器上的 roleChange，确认对话框在视图里。
 */
const { community } = useCommunityContext()
const { members, q, total, busy, page, acting, roleOptions, load } = community
const { searchMembers, canChangeRole, changeRole, roleLabel } = community
</script>

<template>
  <div class="filter-bar">
    <form class="search-inline" @submit.prevent="searchMembers">
      <input
        v-model="q"
        aria-label="搜索成员"
        maxlength="100"
        placeholder="搜索用户名或昵称"
      /><Button variant="secondary">搜索</Button>
    </form>
    <span class="filter-count">共 {{ total }} 条</span>
    <TextButton :disabled="busy" @click="load">刷新</TextButton>
  </div>
  <Card class="member-list" v-if="members.length">
    <article v-for="(member, index) in members" :key="member.id">
      <span :class="['ranking', { top: page === 1 && index < 3 }]">
        {{ (page - 1) * 30 + index + 1 }}</span><img
        v-if="member.avatar"
        :src="member.avatar"
        alt=""
        class="avatar"
      /><span v-else class="avatar">{{ displayName(member).slice(0, 1) }}</span>
      <div class="member-name">
        <strong>{{ displayName(member) }}</strong>
        <BaseSelect
          v-if="canChangeRole(member)"
          :disabled="acting || busy"
          :label="`修改 ${displayName(member)} 的角色`"
          :model-value="member.role"
          :options="roleOptions"
          :searchable="false"
          class="member-role"
          @update:model-value="changeRole(member, $event)"
        />
        <Tag variant="default" class="member-role" v-else>{{ roleLabel(member.role) }}</Tag>
      </div>
      <div class="member-contribution">
        <strong>{{ bytes(member.size_upload) }}</strong><span class="hint">累计上传</span>
      </div>
    </article>
  </Card>
</template>

<style scoped>
@layer components {
  .member-list > article {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--line);
  }
  .member-list > article:last-child {
    border: 0;
  }
  .ranking {
    width: 22px;
    flex-shrink: 0;
    color: var(--text-muted);
    font-size: 12px;
    text-align: center;
  }
  .ranking.top {
    color: var(--warning-rank);
  }
  .member-name {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }
  .member-name strong {
    font-size: 13px;
    overflow-wrap: anywhere;
  }
  .member-role {
    align-self: flex-start;
  }
  .member-role :deep(.select-trigger) {
    width: auto;
    min-height: 0;
    gap: 4px;
    padding: 2px 6px;
    border: 0;
    border-radius: 4px;
    background: var(--brand-soft);
    color: var(--brand-strong);
    font-size: 11px;
    font-weight: 500;
    line-height: 1.6;
  }
  .member-role :deep(.select-trigger:hover:not(:disabled)) {
    background: var(--veil-hover);
  }
  .member-contribution {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 90px;
    text-align: right;
  }
  .member-contribution strong {
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  .member-contribution .hint {
    font-size: 11px;
  }
  @media (max-width: 680px) {
    .member-list > article {
      padding: 11px 10px;
      gap: 8px;
      flex-wrap: wrap;
    }
    .member-contribution {
      min-width: 74px;
    }
    .ranking {
      width: 16px;
    }
  }
}
</style>
