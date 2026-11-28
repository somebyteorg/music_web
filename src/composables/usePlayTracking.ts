import { watch } from 'vue'
import { HISTORY_UPDATED_EVENT, recordPlay } from '@/features/home/playHistory'
import { usePlayerStore } from '@/stores/player'
import { useSignStore } from '@/stores/sign'

/**
 * 播放记录的唯一写入点：在 App 层挂一次，组件里不要再各自 watch。
 * 触发时机 = 切歌（song.id 变化）或开始播放（paused → playing）；
 * 同一首 30 分钟内重复播放由 playHistory 合并成 plays + 1，不会新增条目。
 */
export function usePlayTracking() {
  const player = usePlayerStore()
  const sign = useSignStore()

  watch(
    () => [player.song?.id, player.playing] as const,
    ([songId, playing], previous) => {
      const song = player.song
      const userId = sign.user?.id
      if (!songId || !playing || !song || !userId) return
      // 同一首从暂停恢复不算新的一次播放；切歌或从静止开始才记
      if (previous && previous[0] === songId && previous[1]) return
      recordPlay(userId, song, { position: player.time })
      window.dispatchEvent(new CustomEvent(HISTORY_UPDATED_EVENT))
    },
  )
}
