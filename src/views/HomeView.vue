<script lang="ts" setup>
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import HomeRow from '@/components/home/HomeRow.vue'
import { useHomeFloors } from '@/features/home/useHomeFloors'

/**
 * 首页：只做渲染。楼层数据、推荐规则与请求参数都在 features/home/useHomeFloors 里，
 * 空数据的楼层由那里直接不产出，所以这里只处理「一层都没有」的整页空态。
 */
const { rows, busy, error, playRow, reshuffle, refresh } = useHomeFloors()
</script>

<template>
  <div class="page-heading">
    <div>
      <div class="heading-title"><h1>首页</h1></div>
      <p class="home-intro">按本机播放记录与曲库现有数据拼出的推荐，不需要后端统计接口。</p>
    </div>
    <Button :busy="busy" variant="secondary" @click="refresh">刷新</Button>
  </div>
  <p v-if="error" class="error-text">{{ error }}</p>
  <HomeRow
    v-for="row in rows"
    :key="row.key"
    :row="row"
    @play="playRow(row)"
    @play-item="(index) => playRow(row, index)"
    @reshuffle="reshuffle"
  />
  <EmptyState v-if="rows.length === 0 && !busy" panel symbol="♫" title="还没有可以推荐的曲目">
    先在曲库听几首，这里会按你的本机播放记录生成「继续听」和「猜你喜欢」。
    <template #actions>
      <Button to="/songs" variant="primary">去看看歌曲</Button>
    </template>
  </EmptyState>
</template>

<style scoped>
@layer components {
  .home-intro {
    margin-top: 10px;
    color: var(--text-muted);
    font-size: 13px;
  }
}
</style>
