import { ref } from 'vue'
import { getCurrentTimeString, formatDate } from '../utils/dateUtils'

export function useNotifications(store: any, todayFormatted: any, isBreakTime: any) {
     const notifiedTasks = ref<Set<string>>(new Set())
     // Tracks tasks already processed at end-time (to avoid repeated actions every second)
     const endTimeProcessedTasks = ref<Set<string>>(new Set())
     const lastBreakNotification = ref<number>(0)

     // Create audio context for notification sounds
     const playNotificationSound = (type: 'break' | 'task' = 'task') => {
          try {
               const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
               if (!AudioContextClass) return

               const audioContext = new AudioContextClass()
               const oscillator = audioContext.createOscillator()
               const gainNode = audioContext.createGain()

               oscillator.connect(gainNode)
               gainNode.connect(audioContext.destination)

               if (type === 'break') {
                    // Break sound: two-tone chime
                    oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
                    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1)
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
                    oscillator.start(audioContext.currentTime)
                    oscillator.stop(audioContext.currentTime + 0.5)
               } else {
                    // Task start sound: gentle beep
                    oscillator.frequency.setValueAtTime(600, audioContext.currentTime)
                    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
                    oscillator.start(audioContext.currentTime)
                    oscillator.stop(audioContext.currentTime + 0.3)
               }
          } catch (error) {
               console.warn('Could not play notification sound:', error)
          }
     }

     const showNotification = () => {
          const now = Date.now()
          // Prevent duplicate notifications within 2 seconds
          if (now - lastBreakNotification.value < 2000) return

          lastBreakNotification.value = now

          const message = isBreakTime.value
               ? 'Break time is over! Ready to get back to work?'
               : 'Time for a break! You have completed 50 minutes of focused work.'

          // Play notification sound
          playNotificationSound('break')

          if ('Notification' in window && Notification.permission === 'granted') {
               new Notification('Schedule Manager', { body: message })
          } else if ('Notification' in window && Notification.permission !== 'denied') {
               Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                         new Notification('Schedule Manager', { body: message })
                    }
               })
          }

          alert(message)
     }

     // Check for upcoming tasks and play notification
     // Includes multi-day tasks scheduled for today via their per-day work hour.
     const checkUpcomingTasks = () => {
          const dateKey = todayFormatted.value
          const tasks = store.getTasksSpanningDate(dateKey)
               .filter((task: any) => !task.completed)

          if (tasks.length === 0) return

          const now = new Date()
          const currentTimeStr = getCurrentTimeString(now)
          const [currentHour, currentMin] = currentTimeStr.split(':').map(Number)
          const currentTotalMinutes = currentHour * 60 + currentMin

          tasks.forEach((task: any) => {
               // Effective start time for THIS day (multi-day tasks have per-day overrides)
               const { time } = store.getTaskTimeForDate(task, dateKey)
               if (!time) return

               // Dedupe per task per day so multi-day tasks notify on each work day
               const notifyKey = `${task.id}_${dateKey}`
               if (notifiedTasks.value.has(notifyKey)) return

               const [taskHour, taskMin] = time.split(':').map(Number)
               const taskTotalMinutes = taskHour * 60 + taskMin

               // Play sound exactly when task time is reached
               if (taskTotalMinutes === currentTotalMinutes) {
                    playNotificationSound('task')
                    notifiedTasks.value.add(notifyKey)

                    // Show notification
                    const message = `Task starting now: ${task.title}`
                    if ('Notification' in window && Notification.permission === 'granted') {
                         new Notification('Schedule Manager', { body: message })
                    } else if ('Notification' in window && Notification.permission !== 'denied') {
                         Notification.requestPermission().then(permission => {
                              if (permission === 'granted') {
                                   new Notification('Schedule Manager', { body: message })
                              }
                         })
                    }
               }
          })
     }

     // Urgent multi-beep sound for critical tasks
     const playCriticalSound = () => {
          try {
               const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
               if (!AudioContextClass) return
               const audioContext = new AudioContextClass()
               const times = [0, 0.25, 0.5]
               times.forEach((offset) => {
                    const osc = audioContext.createOscillator()
                    const gain = audioContext.createGain()
                    osc.connect(gain)
                    gain.connect(audioContext.destination)
                    osc.frequency.setValueAtTime(880, audioContext.currentTime + offset)
                    gain.gain.setValueAtTime(0.5, audioContext.currentTime + offset)
                    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + offset + 0.2)
                    osc.start(audioContext.currentTime + offset)
                    osc.stop(audioContext.currentTime + offset + 0.2)
               })
          } catch (error) {
               console.warn('Could not play critical sound:', error)
          }
     }

     // Called every second from App.vue — handles end-time for uncompleted tasks
     const checkTaskEndTimes = () => {
          const dateKey = todayFormatted.value
          const tasks = store.getTasksSpanningDate(dateKey)
               .filter((task: any) => !task.completed)

          if (tasks.length === 0) return

          const now = new Date()
          const currentTimeStr = getCurrentTimeString(now)
          const [currentHour, currentMin] = currentTimeStr.split(':').map(Number)
          const currentTotalMinutes = currentHour * 60 + currentMin

          tasks.forEach((task: any) => {
               // Effective end time for THIS day (per-day override for multi-day tasks)
               const { endTime } = store.getTaskTimeForDate(task, dateKey)
               if (!endTime) return

               const processKey = `${task.id}_${dateKey}_${endTime}`
               if (endTimeProcessedTasks.value.has(processKey)) return

               const [endHour, endMin] = endTime.split(':').map(Number)
               const endTotalMinutes = endHour * 60 + endMin

               // Trigger exactly at end time (within the current minute)
               if (currentTotalMinutes !== endTotalMinutes) return

               endTimeProcessedTasks.value.add(processKey)

               const priority = task.priority || 'medium'
               const isMultiDay = task.durationDays && task.durationDays > 1

               if (priority === 'critical') {
                    // Play urgent sound and notify — do NOT move the task
                    playCriticalSound()
                    const message = `⚠️ Critical task time ended: "${task.title}" — please mark it done or it will remain open.`
                    if ('Notification' in window && Notification.permission === 'granted') {
                         new Notification('Qar — Critical Task', { body: message })
                    } else if ('Notification' in window && Notification.permission !== 'denied') {
                         Notification.requestPermission().then(permission => {
                              if (permission === 'granted') {
                                   new Notification('Qar — Critical Task', { body: message })
                              }
                         })
                    }
               } else if (!isMultiDay) {
                    // medium / low single-day task — silently move to next day.
                    // Multi-day tasks keep their own work-day plan, so don't move them.
                    store.moveTaskToNextDay(dateKey, task.id)
               }
          })
     }

     // Reset notified tasks at the start of each day
     const checkDayChange = () => {
          const todayKey = formatDate(new Date())
          const storedDay = localStorage.getItem('lastNotificationDay')

          if (storedDay !== todayKey) {
               notifiedTasks.value.clear()
               endTimeProcessedTasks.value.clear()
               localStorage.setItem('lastNotificationDay', todayKey)
          }
     }

     return {
          notifiedTasks,
          playNotificationSound,
          showNotification,
          checkUpcomingTasks,
          checkTaskEndTimes,
          checkDayChange
     }
}
