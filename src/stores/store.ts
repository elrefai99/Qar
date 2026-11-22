import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { saveTask, getTasksForDate, deleteTask as deleteTaskFromFirebase, getAllUserTasks, addDaysToDate, UNSCHEDULED_KEY } from '../firebase/tasks'

const todayKey = (): string => {
     const d = new Date()
     const y = d.getFullYear()
     const m = String(d.getMonth() + 1).padStart(2, '0')
     const day = String(d.getDate()).padStart(2, '0')
     return `${y}-${m}-${day}`
}

const nowTime = (): string => {
     const d = new Date()
     return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const useScheduleStore = defineStore('schedule', {
     state: () => ({
          schedules: {} as Record<string, any[]>,
          loading: false,
          synced: false,
          _nextTicketNumber: 1
     }),

     getters: {
          getTasksForDate: (state) => (dateKey: string) => {
               return state.schedules[dateKey] || []
          },

          /** Tasks that have not been started yet (no startDate). */
          unscheduledTasks: (state) => {
               return state.schedules[UNSCHEDULED_KEY] || []
          },

          /**
           * Tasks whose startDate is within the last `days` days (inclusive of today).
           * Sorted newest-first by startDate then by start time.
           */
          getRecentStartedTasks: (state) => (days: number = 3) => {
               const today = new Date()
               today.setHours(0, 0, 0, 0)
               const cutoff = new Date(today)
               cutoff.setDate(cutoff.getDate() - (days - 1))
               const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`
               const todayK = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

               const results: any[] = []
               for (const [dateKey, tasks] of Object.entries(state.schedules)) {
                    if (dateKey === UNSCHEDULED_KEY) continue
                    if (dateKey < cutoffKey || dateKey > todayK) continue
                    for (const t of tasks) results.push(t)
               }
               results.sort((a, b) => {
                    const da = a.startDate || a.date || ''
                    const db = b.startDate || b.date || ''
                    if (da !== db) return db.localeCompare(da)            // newer date first
                    return (b.time || '').localeCompare(a.time || '')     // later time first
               })
               return results
          },

          /** Returns all tasks that span across a given date (multi-day tasks included) */
          getTasksSpanningDate: (state) => (dateKey: string) => {
               const results: any[] = []
               const allDates = Object.keys(state.schedules)
               for (const dk of allDates) {
                    if (dk === UNSCHEDULED_KEY) continue
                    for (const task of state.schedules[dk]) {
                         if (dk === dateKey) {
                              if (!results.find(t => t.id === task.id)) results.push(task)
                              continue
                         }
                         // Explicit workDays list (preferred)
                         if (Array.isArray(task.workDays) && task.workDays.length > 0) {
                              if (task.workDays.includes(dateKey)) {
                                   if (!results.find(t => t.id === task.id)) results.push(task)
                              }
                              continue
                         }
                         // Legacy: contiguous startDate..endDate
                         if (task.startDate && task.endDate && task.durationDays && task.durationDays > 1) {
                              if (task.startDate <= dateKey && task.endDate >= dateKey) {
                                   if (!results.find(t => t.id === task.id)) results.push(task)
                              }
                         }
                    }
               }
               return results
          },

          /** Returns all tasks belonging to a specific project (across all dates) */
          getTasksForProject: (state) => (projectId: string) => {
               const results: any[] = []
               for (const tasks of Object.values(state.schedules)) {
                    for (const task of tasks) {
                         if (task.projectId === projectId) results.push(task)
                    }
               }
               return results
          },

          /**
           * Returns effective {time, endTime} for a task on a specific date.
           * Multi-day tasks can have per-day overrides in dailyTimes.
           */
          getTaskTimeForDate: () => (task: any, dateKey: string): { time: string; endTime: string } => {
               if (task.dailyTimes?.[dateKey]) {
                    return {
                         time: task.dailyTimes[dateKey].time || '09:00',
                         endTime: task.dailyTimes[dateKey].endTime || '10:00'
                    }
               }
               return {
                    time: task.time || '09:00',
                    endTime: task.endTime || '10:00'
               }
          }
     },

     actions: {
          async loadUserTasks() {
               const authStore = useAuthStore()
               if (!authStore.user) return

               try {
                    this.loading = true
                    const tasks = await getAllUserTasks(authStore.user.uid)

                    this.schedules = {}
                    tasks.forEach((task: any) => {
                         if (!this.schedules[task.date]) {
                              this.schedules[task.date] = []
                         }
                         if (task.order === undefined) {
                              task.order = this.schedules[task.date].length
                         }
                         this.schedules[task.date].push(task)
                    })

                    // Sort tasks by time (AM first → PM last), no-time tasks go to end
                    Object.keys(this.schedules).forEach(dateKey => {
                         this.schedules[dateKey].sort((a, b) => {
                              const ta = a.time || '99:99'
                              const tb = b.time || '99:99'
                              return ta.localeCompare(tb)
                         })
                    })

                    // Seed ticket number counter from existing data
                    let maxTicket = 0
                    tasks.forEach((task: any) => {
                         if (task.ticketNumber && task.ticketNumber > maxTicket) maxTicket = task.ticketNumber
                    })
                    this._nextTicketNumber = maxTicket + 1

                    this.synced = true
               } catch (error) {
                    console.error('Error loading tasks:', error)
               } finally {
                    this.loading = false
               }
          },

          async loadTasksForDate(dateKey: string) {
               const authStore = useAuthStore()
               if (!authStore.user) return

               try {
                    const tasks = await getTasksForDate(authStore.user.uid, dateKey)
                    this.schedules[dateKey] = tasks
               } catch (error) {
                    console.error('Error loading tasks for date:', error)
               }
          },

          async addTask(dateKey: string | null | undefined, task: any) {
               const authStore = useAuthStore()

               // Unscheduled: no dateKey => store under UNSCHEDULED_KEY
               const isUnscheduled = !dateKey
               const storeKey = isUnscheduled ? UNSCHEDULED_KEY : (dateKey as string)

               const durationDays = task.durationDays || 1
               const startDate = isUnscheduled ? '' : (dateKey as string)
               const endDate = isUnscheduled
                    ? ''
                    : (durationDays > 1 ? addDaysToDate(startDate, durationDays - 1) : startDate)

               const newTask = {
                    id: Date.now().toString(),
                    ticketNumber: this._nextTicketNumber++,
                    boardStatus: task.boardStatus || 'todo',
                    comments: [],
                    started: !isUnscheduled,
                    ...task,
                    date: storeKey,
                    startDate,
                    endDate,
                    durationDays,
                    time: isUnscheduled ? '' : (task.time ?? ''),
                    endTime: isUnscheduled ? '' : (task.endTime ?? ''),
                    order: (this.schedules[storeKey]?.length || 0)
               }
               if (!this.schedules[storeKey]) {
                    this.schedules[storeKey] = []
               }
               this.schedules[storeKey].unshift(newTask)
               this.schedules[storeKey].forEach((t, i) => { t.order = i })

               if (authStore.user) {
                    try {
                         const { date, userId, ...taskToSave } = newTask as any
                         await saveTask(authStore.user.uid, storeKey, taskToSave)
                    } catch (error) {
                         console.error('Error saving task to Firebase:', error)
                    }
               }
          },

          /**
           * Start an unscheduled task with a per-day work plan.
           * Each entry: { date: 'YYYY-MM-DD', time: 'HH:MM' } — task gets a 1-hour slot starting at `time`.
           * The Firestore record is keyed on the earliest workDay (startDate).
           */
          async startTask(taskId: string, workPlan: Array<{ date: string; time: string }>) {
               const authStore = useAuthStore()

               const fromList = this.schedules[UNSCHEDULED_KEY] || []
               const idx = fromList.findIndex((t: any) => t.id === taskId)
               if (idx === -1) return
               const task = fromList[idx]

               // Filter, normalise, sort plan
               const plan = (workPlan || [])
                    .filter(p => p && p.date)
                    .map(p => ({ date: p.date, time: p.time || nowTime() }))
                    .sort((a, b) => a.date.localeCompare(b.date))

               if (plan.length === 0) {
                    plan.push({ date: todayKey(), time: nowTime() })
               }

               const workDays = plan.map(p => p.date)
               const startDate = workDays[0]
               const endDate = workDays[workDays.length - 1]

               // Build dailyTimes: each day gets a 1-hour slot at the chosen time
               const dailyTimes: Record<string, { time: string; endTime: string }> = {}
               for (const p of plan) {
                    const [h, m] = p.time.split(':').map(Number)
                    const endH = (h + 1) % 24
                    dailyTimes[p.date] = {
                         time: p.time,
                         endTime: `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`
                    }
               }

               const startTime = dailyTimes[startDate].time
               const endTime = dailyTimes[endDate].endTime

               const started = {
                    ...task,
                    started: true,
                    date: startDate,
                    startDate,
                    endDate,
                    workDays,
                    dailyTimes,
                    time: startTime,
                    endTime,
                    durationDays: workDays.length,
                    order: (this.schedules[startDate]?.length || 0)
               }

               this.schedules[UNSCHEDULED_KEY] = fromList.filter((t: any) => t.id !== taskId)
               if (!this.schedules[startDate]) this.schedules[startDate] = []
               this.schedules[startDate].unshift(started)
               this.schedules[startDate].forEach((t, i) => { t.order = i })

               if (authStore.user) {
                    try {
                         await deleteTaskFromFirebase(authStore.user.uid, UNSCHEDULED_KEY, taskId)
                         const { date, userId, ...taskToSave } = started as any
                         await saveTask(authStore.user.uid, startDate, taskToSave)
                    } catch (error) {
                         console.error('Error starting task:', error)
                    }
               }
          },

          async updateTask(dateKey: string, task: any) {
               const authStore = useAuthStore()

               if (this.schedules[dateKey]) {
                    const index = this.schedules[dateKey].findIndex(t => t.id === task.id)
                    if (index !== -1) {
                         // Recalculate endDate if durationDays changed
                         const durationDays = task.durationDays || this.schedules[dateKey][index].durationDays || 1
                         const startDate = task.startDate || dateKey
                         const endDate = durationDays > 1
                              ? addDaysToDate(startDate, durationDays - 1)
                              : startDate

                         const updatedTask = {
                              ...this.schedules[dateKey][index],
                              ...task,
                              durationDays,
                              endDate
                         }
                         this.schedules[dateKey][index] = updatedTask

                         if (authStore.user) {
                              try {
                                   const { date, userId, ...taskToSave } = updatedTask
                                   await saveTask(authStore.user.uid, dateKey, taskToSave)
                              } catch (error) {
                                   console.error('Error updating task in Firebase:', error)
                              }
                         }
                    }
               }
          },

          async toggleTaskComplete(dateKey: string, taskId: string) {
               const authStore = useAuthStore()

               const tasks = this.schedules[dateKey]
               if (tasks) {
                    const task = tasks.find(t => t.id === taskId)
                    if (task) {
                         task.completed = !task.completed

                         if (authStore.user) {
                              try {
                                   await saveTask(authStore.user.uid, dateKey, task)
                              } catch (error) {
                                   console.error('Error updating task in Firebase:', error)
                              }
                         }
                    }
               }
          },

          async deleteTask(dateKey: string, taskId: string) {
               const authStore = useAuthStore()

               if (this.schedules[dateKey]) {
                    const taskToDelete = this.schedules[dateKey].find(t => t.id === taskId)

                    this.schedules[dateKey] = this.schedules[dateKey].filter(
                         task => task.id !== taskId
                    )

                    if (authStore.user) {
                         try {
                              await deleteTaskFromFirebase(authStore.user.uid, dateKey, taskId)
                         } catch (error) {
                              console.error('Error deleting task from Firebase:', error)
                              if (taskToDelete) {
                                   this.schedules[dateKey].push(taskToDelete)
                              }
                         }
                    }
               }
          },

          async updateBoardStatus(dateKey: string, taskId: string, boardStatus: string) {
               const authStore = useAuthStore()
               const tasks = this.schedules[dateKey]
               if (tasks) {
                    const task = tasks.find(t => t.id === taskId)
                    if (task) {
                         const prevStatus = task.boardStatus
                         task.boardStatus = boardStatus
                         // sync completed: done → true, leaving done → false
                         if (boardStatus === 'done') task.completed = true
                         else if (prevStatus === 'done') task.completed = false
                         if (authStore.user) {
                              try {
                                   const { date, userId, ...taskToSave } = task
                                   await saveTask(authStore.user.uid, dateKey, taskToSave)
                              } catch (error) {
                                   console.error('Error updating board status:', error)
                              }
                         }
                    }
               }
          },

          async addComment(dateKey: string, taskId: string, text: string) {
               const authStore = useAuthStore()
               const tasks = this.schedules[dateKey]
               if (tasks) {
                    const task = tasks.find(t => t.id === taskId)
                    if (task) {
                         if (!task.comments) task.comments = []
                         task.comments.push({
                              id: Date.now().toString(),
                              text,
                              createdAt: new Date().toISOString()
                         })
                         if (authStore.user) {
                              try {
                                   const { date, userId, ...taskToSave } = task
                                   await saveTask(authStore.user.uid, dateKey, taskToSave)
                              } catch (error) {
                                   console.error('Error saving comment:', error)
                              }
                         }
                    }
               }
          },

          async moveTaskToNextDay(dateKey: string, taskId: string) {
               const authStore = useAuthStore()
               const tasks = this.schedules[dateKey]
               if (!tasks) return
               const task = tasks.find((t: any) => t.id === taskId)
               if (!task || task.completed) return

               const tomorrow = addDaysToDate(dateKey, 1)

               // Remove from today locally and in Firestore
               this.schedules[dateKey] = tasks.filter((t: any) => t.id !== taskId)
               if (authStore.user) {
                    try {
                         await deleteTaskFromFirebase(authStore.user.uid, dateKey, taskId)
                    } catch (error) {
                         console.error('Error deleting task when moving to next day:', error)
                    }
               }

               // Create copy for tomorrow with new ID
               const newTask = {
                    ...task,
                    id: Date.now().toString(),
                    date: tomorrow,
                    startDate: tomorrow,
                    endDate: task.durationDays && task.durationDays > 1
                         ? addDaysToDate(tomorrow, (task.durationDays || 1) - 1)
                         : tomorrow,
                    completed: false,
                    order: (this.schedules[tomorrow]?.length || 0)
               }

               if (!this.schedules[tomorrow]) this.schedules[tomorrow] = []
               this.schedules[tomorrow].push(newTask)

               if (authStore.user) {
                    try {
                         const { date, userId, ...taskToSave } = newTask as any
                         await saveTask(authStore.user.uid, tomorrow, taskToSave)
                    } catch (error) {
                         console.error('Error saving moved task to next day:', error)
                    }
               }
          },

          async reorderTasks(dateKey: string, taskIds: string[]) {
               const authStore = useAuthStore()

               if (!this.schedules[dateKey]) return

               const tasksMap = new Map(this.schedules[dateKey].map(t => [t.id, t]))
               const reorderedTasks = taskIds
                    .map(id => tasksMap.get(id))
                    .filter(Boolean) as any[]

               reorderedTasks.forEach((task, index) => {
                    task.order = index
               })

               this.schedules[dateKey] = reorderedTasks

               if (authStore.user) {
                    try {
                         await Promise.all(
                              reorderedTasks.map(task => {
                                   const { date, userId, ...taskToSave } = task
                                   return saveTask(authStore.user!.uid, dateKey, taskToSave)
                              })
                         )
                    } catch (error) {
                         console.error('Error reordering tasks in Firebase:', error)
                    }
               }
          }
     }
})
