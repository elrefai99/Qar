import { ref, computed } from 'vue'
import { formatDate, getMinutesFromTime, getCurrentTimeString, isDateDisabled } from '../utils/dateUtils'
import { addDaysToDate, DEFAULT_TASK_START_TIME, DEFAULT_TASK_END_TIME } from '../firebase/tasks'

export function useTaskLogic(store: any, selectedDate: any, todayFormatted: any, currentTime: any) {
     const showAddForm = ref(false)
     const editingTaskId = ref<string | null>(null)
     // Tracks the ORIGINAL date key of the task being edited (may differ from selectedDate for multi-day tasks)
     const editingTaskDateKey = ref<string | null>(null)
     const showTodoList = ref(false)

     const newTask = ref<any>({
          title: '',
          time: '',
          endTime: '',
          description: '',
          completed: false,
          priority: 'medium' as 'critical' | 'medium' | 'low',
          meetingType: 'none',
          meetingUrl: '',
          guestEmailsText: '',
          durationDays: 1,
          useTimeRange: true,
          dailyTimes: {} as Record<string, { time: string; endTime: string }>,
          projectId: ''
     })


     // Computed end date preview when durationDays > 1
     const endDatePreview = computed(() => {
          if (!selectedDate.value) return ''
          const days = Number(newTask.value.durationDays) || 1
          if (days <= 1) return ''
          const startStr = formatDate(selectedDate.value)
          return addDaysToDate(startStr, days - 1)
     })

     // Get current tasks for selected date (including multi-day tasks that span this date)
     const currentTasks = computed(() => {
          if (!selectedDate.value) return []
          const dateKey = formatDate(selectedDate.value)
          const tasks = store.getTasksSpanningDate(dateKey)
          // Sort by time AM → PM, tasks with no time go to end
          return tasks.sort((a: any, b: any) => {
               const ta = a.time || '99:99'
               const tb = b.time || '99:99'
               return ta.localeCompare(tb)
          })
     })

     // Categorize tasks for kanban board
     const categorizedTasks = computed(() => {
          if (!selectedDate.value) return { workedOn: [], willStart: [], ended: [] }

          const dateKey = formatDate(selectedDate.value)
          const isToday = dateKey === todayFormatted.value
          const tasks = currentTasks.value
          const currentTimeStr = getCurrentTimeString(currentTime.value)
          const currentMinutes = getMinutesFromTime(currentTimeStr)

          const workedOn: any[] = []
          const willStart: any[] = []
          const ended: any[] = []

          tasks.forEach((task: any) => {
               // Multi-day task: if it spans multiple days, treat as whole-day 'willStart' on non-start dates
               if (task.durationDays && task.durationDays > 1 && task.startDate !== dateKey) {
                    if (task.completed) ended.push(task)
                    else willStart.push(task)
                    return
               }

               // Use per-day time overrides if available (for multi-day tasks)
               const { time: effectiveTime, endTime: effectiveEndTime } = store.getTaskTimeForDate(task, dateKey)
               const startMinutes = effectiveTime ? getMinutesFromTime(effectiveTime) : 0
               const endMinutes = effectiveEndTime ? getMinutesFromTime(effectiveEndTime) : startMinutes + 60

               if (task.completed) {
                    ended.push(task)
               } else if (isToday) {
                    if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
                         workedOn.push(task)
                    } else {
                         // Past end time but not completed — keep in willStart (not auto-ended)
                         willStart.push(task)
                    }
               } else {
                    willStart.push(task)
               }
          })

          return { workedOn, willStart, ended }
     })

     const nextTask = computed(() => {
          const dateKey = todayFormatted.value
          const tasks = store.getTasksForDate(dateKey)
               .filter((task: any) => !task.completed)
               .sort((a: any, b: any) => (a.time || '99:99').localeCompare(b.time || '99:99'))

          const currentTimeStr = getCurrentTimeString(currentTime.value)
          return tasks.find((task: any) => task.time && task.time > currentTimeStr) || null
     })

     const currentActiveTask = computed(() => {
          const dateKey = todayFormatted.value
          const tasks = store.getTasksForDate(dateKey)
               .filter((task: any) => !task.completed)
               .sort((a: any, b: any) => (a.time || '99:99').localeCompare(b.time || '99:99'))

          const currentTimeStr = getCurrentTimeString(currentTime.value)
          const currentMinutes = getMinutesFromTime(currentTimeStr)

          return tasks.find((task: any) => {
               if (!task.time) return false
               const startMinutes = getMinutesFromTime(task.time)
               const endMinutes = task.endTime ? getMinutesFromTime(task.endTime) : startMinutes + 60
               return currentMinutes >= startMinutes && currentMinutes <= endMinutes
          }) || null
     })

     // Tasks are no longer auto-completed when their end time passes.
     // End-time handling (notify critical / move others to next day) is done in useNotifications.checkTaskEndTimes.
     const checkAndCompletePassedTasks = () => {
          // intentionally empty — kept for API compatibility
     }

     const handleAddTask = () => {
          if (!newTask.value.title) return

          // Editing path keeps the task on its original date.
          // Add path: tasks are unscheduled by default (dateKey = null).
          const editing = !!editingTaskId.value
          const dateKey = editing
               ? (editingTaskDateKey.value || (selectedDate.value ? formatDate(selectedDate.value) : null))
               : null

          const guests = (newTask.value.guestEmailsText || '')
               .split(/[,;]+/)
               .map((e: string) => e.trim())
               .filter((e: string) => e.length > 0)

          const durationDays = Number(newTask.value.durationDays) || 1

          if (editing) {
               const existingDailyTimes: Record<string, { time: string; endTime: string }> =
                    { ...(newTask.value.dailyTimes || {}) }
               if (durationDays > 1 && dateKey) {
                    existingDailyTimes[dateKey] = {
                         time: newTask.value.time || DEFAULT_TASK_START_TIME,
                         endTime: newTask.value.endTime || DEFAULT_TASK_END_TIME
                    }
               }
               const startDate = newTask.value.startDate || dateKey || ''
               const taskPayload = {
                    ...newTask.value,
                    guestEmails: guests,
                    durationDays,
                    startDate,
                    endDate: startDate
                         ? (durationDays > 1 ? addDaysToDate(startDate, durationDays - 1) : startDate)
                         : '',
                    time: durationDays > 1 ? DEFAULT_TASK_START_TIME : (newTask.value.time || ''),
                    endTime: durationDays > 1 ? DEFAULT_TASK_END_TIME : (newTask.value.endTime || ''),
                    dailyTimes: existingDailyTimes
               }
               store.updateTask(dateKey, { id: editingTaskId.value, ...taskPayload })
          } else {
               // Unscheduled add: only the descriptive fields. Start info is set later via Start.
               const taskPayload = {
                    title: newTask.value.title,
                    description: newTask.value.description,
                    completed: false,
                    priority: newTask.value.priority,
                    meetingType: newTask.value.meetingType,
                    meetingUrl: newTask.value.meetingUrl,
                    guestEmails: guests,
                    projectId: newTask.value.projectId,
                    durationDays: 1,
                    time: '',
                    endTime: '',
                    dailyTimes: {}
               }
               store.addTask(null, taskPayload)
          }

          newTask.value = {
               title: '',
               time: '',
               endTime: '',
               description: '',
               completed: false,
               priority: 'medium',
               meetingType: 'none',
               meetingUrl: '',
               guestEmailsText: '',
               durationDays: 1,
               useTimeRange: true,
               dailyTimes: {},
               projectId: ''
          }
          showAddForm.value = false
          editingTaskId.value = null
          editingTaskDateKey.value = null
     }

     // ── Start-task flow (multi-day calendar picker + per-day hour) ───────────
     const showStartForm = ref(false)
     const startingTaskId = ref<string | null>(null)
     const startCalendarMonth = ref(new Date())   // currently displayed month
     // Map of selected YYYY-MM-DD → start time HH:MM (1-hour slot)
     const selectedWorkDays = ref<Record<string, string>>({})

     const openStartTask = (taskId: string) => {
          startingTaskId.value = taskId
          const now = new Date()
          startCalendarMonth.value = new Date(now.getFullYear(), now.getMonth(), 1)
          const y = now.getFullYear()
          const m = String(now.getMonth() + 1).padStart(2, '0')
          const d = String(now.getDate()).padStart(2, '0')
          const hh = String(now.getHours()).padStart(2, '0')
          const mm = String(now.getMinutes()).padStart(2, '0')
          selectedWorkDays.value = { [`${y}-${m}-${d}`]: `${hh}:${mm}` }
          showStartForm.value = true
     }

     const toggleWorkDay = (dateKey: string) => {
          if (selectedWorkDays.value[dateKey]) {
               const next = { ...selectedWorkDays.value }
               delete next[dateKey]
               selectedWorkDays.value = next
          } else {
               // Default new day to 09:00, unless it's today — then use the current hour
               const today = new Date()
               const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
               const time = dateKey === todayKey
                    ? `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`
                    : '09:00'
               selectedWorkDays.value = { ...selectedWorkDays.value, [dateKey]: time }
          }
     }

     const setWorkDayTime = (dateKey: string, time: string) => {
          if (!selectedWorkDays.value[dateKey]) return
          selectedWorkDays.value = { ...selectedWorkDays.value, [dateKey]: time }
     }

     const moveStartMonth = (delta: number) => {
          const m = startCalendarMonth.value
          startCalendarMonth.value = new Date(m.getFullYear(), m.getMonth() + delta, 1)
     }

     /** Sorted list of selected work days for rendering the per-day time-picker list. */
     const selectedWorkDaysSorted = computed(() =>
          Object.entries(selectedWorkDays.value)
               .map(([date, time]) => ({ date, time }))
               .sort((a, b) => a.date.localeCompare(b.date))
     )

     const cancelStartTask = () => {
          showStartForm.value = false
          startingTaskId.value = null
          selectedWorkDays.value = {}
     }

     const confirmStartTask = async () => {
          if (!startingTaskId.value) return
          const plan = selectedWorkDaysSorted.value
          if (plan.length === 0) return
          await store.startTask(startingTaskId.value, plan)
          showStartForm.value = false
          startingTaskId.value = null
          selectedWorkDays.value = {}
     }

     const handleEditTask = (task: any, forDateKey?: string) => {
          editingTaskId.value = task.id
          // Capture the task's original stored date for correct update routing
          editingTaskDateKey.value = task.date || task.startDate || forDateKey || null

          const durationDays = task.durationDays || 1
          const dailyTimes: Record<string, { time: string; endTime: string }> = { ...(task.dailyTimes || {}) }

          // For multi-day tasks: load this day's specific time if it exists,
          // otherwise fall back to the task's default (09:00/10:00)
          let editTime = task.time || DEFAULT_TASK_START_TIME
          let editEndTime = task.endTime || DEFAULT_TASK_END_TIME
          if (forDateKey && durationDays > 1) {
               const dayOverride = dailyTimes[forDateKey]
               if (dayOverride) {
                    editTime = dayOverride.time
                    editEndTime = dayOverride.endTime
               } else {
                    editTime = DEFAULT_TASK_START_TIME
                    editEndTime = DEFAULT_TASK_END_TIME
               }
          }

          newTask.value = {
               title: task.title,
               time: editTime,
               endTime: editEndTime,
               description: task.description || '',
               completed: task.completed,
               priority: task.priority || 'medium',
               meetingType: task.meetingType || 'none',
               meetingUrl: task.meetingUrl || '',
               guestEmailsText: (task.guestEmails || []).join(', '),
               durationDays,
               startDate: task.startDate,
               useTimeRange: true,
               dailyTimes,
               projectId: task.projectId || ''
          }
          showAddForm.value = true
     }

     const toggleComplete = (taskId: string, dateKey?: string) => {
          const dk = dateKey || (selectedDate.value ? formatDate(selectedDate.value) : null)
          if (!dk) return
          store.toggleTaskComplete(dk, taskId)
     }

     const deleteTaskItem = (taskId: string, dateKey?: string) => {
          const dk = dateKey || (selectedDate.value ? formatDate(selectedDate.value) : null)
          if (!dk) return
          store.deleteTask(dk, taskId)
     }

     const openGoogleCalendarForTask = () => {
          if (!selectedDate.value) return

          const title = newTask.value.title || 'Meeting'

          const descriptionParts: string[] = []
          if (newTask.value.description) descriptionParts.push(newTask.value.description)
          if (newTask.value.meetingUrl) descriptionParts.push(`Meeting link: ${newTask.value.meetingUrl}`)
          const details = descriptionParts.join('\\n\\n')

          const [hourStr, minuteStr] = (newTask.value.time || '09:00').split(':')
          const hour = Number(hourStr) || 9
          const minute = Number(minuteStr) || 0

          const start = new Date(selectedDate.value)
          start.setHours(hour, minute, 0, 0)
          const end = new Date(start)
          end.setMinutes(start.getMinutes() + 30)

          const formatForGoogle = (d: Date) => {
               const pad = (n: number) => String(n).padStart(2, '0')
               return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`
          }

          const datesParam = `${formatForGoogle(start)}/${formatForGoogle(end)}`

          const guests = (newTask.value.guestEmailsText || '')
               .split(/[,;]+/)
               .map((e: string) => e.trim())
               .filter((e: string) => e.length > 0)

          const baseUrl = 'https://calendar.google.com/calendar/u/0/r/eventedit'
          const params = new URLSearchParams()
          params.set('text', title)
          params.set('dates', datesParam)
          if (details) params.set('details', details)
          if (guests.length) params.set('add', guests.join(','))
          if (newTask.value.meetingUrl) params.set('location', newTask.value.meetingUrl)

          const url = `${baseUrl}?${params.toString()}`
          window.open(url, '_blank')
     }

     const isCurrentTask = (taskId: string) => {
          return currentActiveTask.value?.id === taskId
     }

     const isNextTask = (taskId: string) => {
          return nextTask.value?.id === taskId
     }

     return {
          showAddForm,
          editingTaskId,
          editingTaskDateKey,
          showTodoList,
          newTask,
          endDatePreview,
          currentTasks,
          categorizedTasks,
          nextTask,
          currentActiveTask,
          handleAddTask,
          handleEditTask,
          toggleComplete,
          deleteTaskItem,
          openGoogleCalendarForTask,
          checkAndCompletePassedTasks,
          isCurrentTask,
          isNextTask,
          // Start-task modal
          showStartForm,
          startingTaskId,
          startCalendarMonth,
          selectedWorkDays,
          selectedWorkDaysSorted,
          openStartTask,
          toggleWorkDay,
          setWorkDayTime,
          moveStartMonth,
          cancelStartTask,
          confirmStartTask
     }
}
