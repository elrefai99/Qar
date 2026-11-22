<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useScheduleStore } from './stores/store'
import { useCalendar } from './shared/useCalendar'
import { useTaskLogic } from './shared/useTaskLogic'
import { useTimer } from './shared/useTimer'
import { useNotifications } from './shared/useNotifications'

const store = useScheduleStore()
const { todayFormatted, selectedDate } = useCalendar()
const currentTime = ref(new Date())
const { currentActiveTask, checkAndCompletePassedTasks } = useTaskLogic(store, selectedDate, todayFormatted, currentTime)

const triggerNotification = ref(() => {})
const onTimerComplete = () => { triggerNotification.value() }
const { isBreakTime } = useTimer(currentActiveTask, onTimerComplete)
const { checkUpcomingTasks, checkTaskEndTimes, checkDayChange, showNotification } = useNotifications(store, todayFormatted, isBreakTime)
triggerNotification.value = showNotification

onMounted(async () => {
  if (!store.synced) await store.loadUserTasks()
  checkDayChange()
  setInterval(() => {
    currentTime.value = new Date()
    checkAndCompletePassedTasks()
    checkUpcomingTasks()
    checkTaskEndTimes()
  }, 1000)
  setInterval(checkDayChange, 60000)
})
</script>

<template>
  <navbar />
  <div class="min-h-screen bg-[#070c09] text-white font-sans">
    <div class="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      <div class="mt-4 sm:mt-6">
        <router-view />
      </div>

      <footer class="mt-6 text-center pb-6">
        <p class="text-xs text-[#2d4035]">&copy; {{ new Date().getFullYear() }} Qar · created by
          <a href="https://github.com/elrefai99" target="_blank" rel="noopener" class="text-[#4a6b58] hover:text-[#4ade80] transition-colors">elrefai99</a></p>
      </footer>
    </div>
  </div>
</template>
