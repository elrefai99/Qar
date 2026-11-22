<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useScheduleStore } from '../stores/store';
import { formatDate } from '../utils/dateUtils'
import { useCalendar } from '../shared/useCalendar'
import { useTaskLogic } from '../shared/useTaskLogic'
import { useTimer } from '../shared/useTimer'
import { useNotifications } from '../shared/useNotifications';

    const store = useScheduleStore()
    const {todayFormatted,selectedDate} = useCalendar()
    const currentTime = ref(new Date())
    const {nextTask,currentActiveTask,checkAndCompletePassedTasks} = useTaskLogic(store, selectedDate, todayFormatted, currentTime)

    const triggerNotification = ref(() => {})
    const onTimerComplete = () => {triggerNotification.value()}
    const {isTimerRunning,isBreakTime,timerDisplay,startTimer,pauseTimer,resetTimer} = useTimer(currentActiveTask, onTimerComplete)
    const {checkUpcomingTasks,checkDayChange,showNotification} = useNotifications(store, todayFormatted, isBreakTime)
    triggerNotification.value = showNotification

    const currentTimeFormatted = computed(() => {
      const h = String(currentTime.value.getHours()).padStart(2,'0')
      const m = String(currentTime.value.getMinutes()).padStart(2,'0')
      const s = String(currentTime.value.getSeconds()).padStart(2,'0')
      return `${h}:${m}:${s}`
    })

    onMounted(async () => {
      if (!store.synced) await store.loadUserTasks()
      checkDayChange()
      setInterval(() => {
        currentTime.value = new Date()
        checkAndCompletePassedTasks()
        checkUpcomingTasks()
      }, 1000)
      setInterval(checkDayChange, 60000)
    })
</script>

<template>
  <!-- App Header -->
  <div class="home-header bg-[#0a0f0b] border-b border-[#1a2820] px-4 sm:px-6 py-4 sm:py-5">
    <div class="flex items-center justify-between flex-wrap gap-3">

      <!-- Title block -->
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#132218] border border-[#2a4035] flex items-center justify-center flex-shrink-0">
          <svg class="w-4 h-4 sm:w-5 sm:h-5 text-[#4ade80]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div>
          <h1 class="text-lg sm:text-xl font-bold text-white tracking-tight" style="font-family:'Georgia',serif">
            <span class="text-[#4ade80]">Qar</span>
          </h1>
          <div class="text-[10px] sm:text-xs text-[#4a6b58] font-mono mt-0.5">{{ todayFormatted }}</div>
        </div>
      </div>

      <!-- Clock -->
      <div class="text-right">
        <div class="text-lg sm:text-xl font-bold font-mono text-white tracking-wider">{{ currentTimeFormatted }}</div>
        <div class="text-[10px] text-[#4a6b58]">current time</div>
      </div>
    </div>

    <!-- Pomodoro Timer -->
    <div class="mt-4 rounded-2xl bg-[#0d1810] border border-[#1f3228] px-4 sm:px-5 py-3.5 sm:py-4">
      <div class="flex items-center justify-between flex-wrap gap-3">

        <!-- Timer display -->
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-[#132218] border border-[#2a4035] flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5 text-[#4ade80]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div>
            <div class="text-[10px] text-[#4a6b58] uppercase tracking-wider mb-0.5">
              {{ isBreakTime ? 'Break Time' : 'Focus Time' }}
            </div>
            <div class="text-2xl sm:text-3xl font-bold font-mono text-white tracking-wider leading-none">
              {{ timerDisplay }}
            </div>
          </div>
        </div>

        <!-- Controls -->
        <div class="flex gap-2">
          <button
            v-if="!isTimerRunning"
            @click="startTimer"
            class="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-[#4ade80]/10 border border-[#4ade80]/20 text-[#4ade80] text-xs sm:text-sm font-semibold hover:bg-[#4ade80]/20 active:scale-95 transition-all duration-150"
          >
            <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span class="hidden sm:inline">Start</span>
          </button>
          <button
            v-if="isTimerRunning"
            @click="pauseTimer"
            class="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs sm:text-sm font-semibold hover:bg-amber-500/20 active:scale-95 transition-all duration-150"
          >
            <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16"/>
              <rect x="14" y="4" width="4" height="16"/>
            </svg>
            <span class="hidden sm:inline">Pause</span>
          </button>
          <button
            @click="resetTimer"
            class="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-[#1a2820] border border-[#2a4035] text-[#8fb89f] text-xs sm:text-sm font-semibold hover:bg-[#1f3228] active:scale-95 transition-all duration-150"
          >
            <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="1 4 1 10 7 10"/>
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
            </svg>
            <span class="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      <!-- Active / Next task preview -->
      <div v-if="currentActiveTask || nextTask" class="mt-3 pt-3 border-t border-[#1a2820] flex flex-col gap-1.5">
        <div v-if="currentActiveTask" class="flex items-center gap-2 text-xs">
          <span class="px-2 py-0.5 rounded-md bg-[#4ade80]/15 border border-[#4ade80]/25 text-[#4ade80] font-bold text-[10px] uppercase tracking-wide flex-shrink-0">Active</span>
          <span class="text-[#4a6b58] font-mono">{{ currentActiveTask.time }}</span>
          <span class="text-[#c8ddd5] font-medium truncate">{{ currentActiveTask.title }}</span>
        </div>
        <div v-if="nextTask" class="flex items-center gap-2 text-xs">
          <span class="px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/25 text-blue-400 font-bold text-[10px] uppercase tracking-wide flex-shrink-0">Next</span>
          <span class="text-[#4a6b58] font-mono">{{ nextTask.time }}</span>
          <span class="text-[#8fb89f] font-medium truncate">{{ nextTask.title }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Break out of App.vue's padded container so header goes full-width edge-to-edge */
.home-header {
  margin: -1rem -0.75rem 0;
}
@media (min-width: 640px) {
  .home-header {
    margin: -1.5rem -1rem 0;
  }
}
</style>
