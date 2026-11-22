import { ref, computed } from 'vue'
import { getMinutesFromTime } from '../utils/dateUtils'

const WORK_MINUTES = 40
const BREAK_MINUTES = 10

/** Persisted session total work seconds (resets per browser session) */
const totalWorkSeconds = ref(0)

export function useTimer(currentActiveTask: any, onTimerComplete: () => void) {
     const timerMinutes = ref(WORK_MINUTES)
     const timerSeconds = ref(0)
     const isTimerRunning = ref(false)
     const isBreakTime = ref(false)
     const timerInterval = ref<any>(null)
     const sessionWorkSeconds = ref(0)   // seconds accumulated in current work block
     const workSessionCount = ref(0)     // how many full work sessions completed

     const pauseTimer = () => {
          isTimerRunning.value = false
          if (timerInterval.value) {
               clearInterval(timerInterval.value)
               timerInterval.value = null
          }
     }

     /** Called when a work or break block finishes naturally */
     const stopTimer = () => {
          pauseTimer()
          // Toggle between break and work
          isBreakTime.value = !isBreakTime.value
          if (isBreakTime.value) {
               // Just finished work → enter break
               workSessionCount.value++
               timerMinutes.value = BREAK_MINUTES
          } else {
               // Just finished break → enter new work block
               timerMinutes.value = WORK_MINUTES
          }
          timerSeconds.value = 0
     }

     const resetTimer = () => {
          pauseTimer()
          timerMinutes.value = isBreakTime.value ? BREAK_MINUTES : WORK_MINUTES
          timerSeconds.value = 0
     }

     /** forceWork: when manually switching to work mode */
     const switchToWork = () => {
          pauseTimer()
          isBreakTime.value = false
          timerMinutes.value = WORK_MINUTES
          timerSeconds.value = 0
     }

     /** forceBreak: when manually switching to break mode */
     const switchToBreak = () => {
          pauseTimer()
          isBreakTime.value = true
          timerMinutes.value = BREAK_MINUTES
          timerSeconds.value = 0
     }

     const startTimer = () => {
          if (isTimerRunning.value) return

          // If starting a work session and there's an active task, sync to task end time
          if (!isBreakTime.value && currentActiveTask && currentActiveTask.value) {
               const now = new Date()
               const currentHours = now.getHours()
               const currentMinutesVal = now.getMinutes()
               const currentSeconds = now.getSeconds()

               const currentTotalMinutes = currentHours * 60 + currentMinutesVal

               const task = currentActiveTask.value
               const startTotalMinutes = getMinutesFromTime(task.time)
               const endTotalMinutes = task.endTime ? getMinutesFromTime(task.endTime) : startTotalMinutes + 60

               let remainingMinutes = endTotalMinutes - currentTotalMinutes

               // Clamp: respect max 40 min work block
               if (remainingMinutes > 0) {
                    remainingMinutes = Math.min(remainingMinutes, WORK_MINUTES)
                    if (currentSeconds > 0) {
                         timerMinutes.value = remainingMinutes - 1
                         timerSeconds.value = 60 - currentSeconds
                    } else {
                         timerMinutes.value = remainingMinutes
                         timerSeconds.value = 0
                    }
               }
          }

          isTimerRunning.value = true

          // Track when this interval started for total work hours
          const blockStartTime = Date.now()
          const blockWasWork = !isBreakTime.value

          // Calculate target end time
          const targetTime = Date.now() + (timerMinutes.value * 60 + timerSeconds.value) * 1000

          timerInterval.value = setInterval(() => {
               const now = Date.now()
               const remainingMs = targetTime - now

               // Accumulate work seconds live
               if (blockWasWork) {
                    const elapsed = Math.floor((now - blockStartTime) / 1000)
                    sessionWorkSeconds.value = elapsed
               }

               if (remainingMs <= 0) {
                    // Finalize work seconds for this block
                    if (blockWasWork) {
                         const finalElapsed = Math.floor((Date.now() - blockStartTime) / 1000)
                         totalWorkSeconds.value += finalElapsed
                         sessionWorkSeconds.value = 0
                    }

                    timerMinutes.value = 0
                    timerSeconds.value = 0
                    stopTimer()
                    onTimerComplete()
                    return
               }

               const totalSecondsLeft = Math.ceil(remainingMs / 1000)
               timerMinutes.value = Math.floor(totalSecondsLeft / 60)
               timerSeconds.value = totalSecondsLeft % 60
          }, 1000)
     }

     const timerDisplay = computed(() => {
          const mins = String(timerMinutes.value).padStart(2, '0')
          const secs = String(timerSeconds.value).padStart(2, '0')
          return `${mins}:${secs}`
     })

     /** Total work time including current running block */
     const totalWorkDisplay = computed(() => {
          const total = totalWorkSeconds.value + (isTimerRunning.value && !isBreakTime.value ? sessionWorkSeconds.value : 0)
          const h = Math.floor(total / 3600)
          const m = Math.floor((total % 3600) / 60)
          const s = total % 60
          if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
          return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
     })

     const totalWorkMinutes = computed(() => {
          const total = totalWorkSeconds.value + (isTimerRunning.value && !isBreakTime.value ? sessionWorkSeconds.value : 0)
          return Math.floor(total / 60)
     })

     return {
          timerMinutes,
          timerSeconds,
          isTimerRunning,
          isBreakTime,
          timerDisplay,
          totalWorkDisplay,
          totalWorkMinutes,
          workSessionCount,
          startTimer,
          pauseTimer,
          resetTimer,
          stopTimer,
          switchToWork,
          switchToBreak,
          WORK_MINUTES,
          BREAK_MINUTES
     }
}
