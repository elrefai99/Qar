import { ref, computed } from 'vue'
import { monthNames, weekDays, formatDate, getWeekStart, isDateDisabled } from '../utils/dateUtils'

export function useCalendar() {
     const currentDate = ref<Date>(new Date())
     const selectedDate = ref<Date | null>(new Date())
     const calendarView = ref<'day' | 'week' | 'month'>('month')

     const today = new Date()
     today.setHours(0, 0, 0, 0)

     const todayFormatted = computed(() => formatDate(today))
     const monthName = computed(() => monthNames[currentDate.value.getMonth()])
     const currentYear = computed(() => currentDate.value.getFullYear())

     const calendarDays = computed(() => {
          const year = currentDate.value.getFullYear()
          const month = currentDate.value.getMonth()
          const firstDay = new Date(year, month, 1)
          const lastDay = new Date(year, month + 1, 0)
          const daysInMonth = lastDay.getDate()
          const startingDayOfWeek = firstDay.getDay()

          const days = []
          for (let i = 0; i < startingDayOfWeek; i++) {
               days.push(null)
          }
          for (let i = 1; i <= daysInMonth; i++) {
               days.push(new Date(year, month, i))
          }
          return days
     })

     const weekCalendarDays = computed(() => {
          const base = selectedDate.value || today
          const start = getWeekStart(base)
          const days: (Date | null)[] = []
          for (let i = 0; i < 7; i++) {
               const current = new Date(start)
               current.setDate(start.getDate() + i)
               days.push(current)
          }
          return days
     })

     const dayCalendarDays = computed(() => {
          if (!selectedDate.value) return []
          return [selectedDate.value]
     })

     const displayedCalendarDays = computed(() => {
          if (calendarView.value === 'month') return calendarDays.value
          if (calendarView.value === 'week') return weekCalendarDays.value
          if (calendarView.value === 'day') return dayCalendarDays.value
          return calendarDays.value
     })

     const calendarTitle = computed(() => {
          if (calendarView.value === 'month') {
               return `${monthName.value} ${currentYear.value}`
          }

          if (calendarView.value === 'week') {
               const base = selectedDate.value || today
               const start = getWeekStart(base)
               const end = new Date(start)
               end.setDate(start.getDate() + 6)
               return `Week ${formatDate(start)} - ${formatDate(end)}`
          }

          const base = selectedDate.value || today
          return `Day ${formatDate(base)}`
     })

     const changeMonth = (delta: number) => {
          if (calendarView.value === 'month') {
               currentDate.value = new Date(
                    currentDate.value.getFullYear(),
                    currentDate.value.getMonth() + delta,
                    1
               )
               return
          }

          // For week/day views, move the selected date
          const base = selectedDate.value || today
          const newDate = new Date(base)

          if (calendarView.value === 'week') {
               newDate.setDate(newDate.getDate() + delta * 7)
          } else {
               // day view
               newDate.setDate(newDate.getDate() + delta)
          }

          selectedDate.value = newDate
          currentDate.value = newDate
     }

     const handleDateClick = (date: Date) => {
          // Allow selecting past dates for view-only mode
          selectedDate.value = date
          // Note: showAddForm logic was here (showAddForm.value = false). 
          // This is a cross-concern. We can't set showAddForm here directly if it's in another composable.
          // The component using this can watch selectedDate or handle the click and do multiple things.
          // However, for now, we just return the change.
     }

     // Time slots for Google Calendar-style views (6 AM to 11 PM)
     const timeSlots = computed(() => {
          const slots = []
          for (let hour = 6; hour <= 23; hour++) {
               slots.push(hour)
          }
          return slots
     })

     return {
          today,
          todayFormatted,
          currentDate,
          selectedDate,
          calendarView,
          calendarDays,
          weekCalendarDays,
          dayCalendarDays,
          displayedCalendarDays,
          monthName,
          currentYear,
          calendarTitle,
          changeMonth,
          handleDateClick,
          timeSlots
     }
}
