export const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
     'July', 'August', 'September', 'October', 'November', 'December']

export const formatDate = (date: Date): string => {
     const year = date.getFullYear()
     const month = String(date.getMonth() + 1).padStart(2, '0')
     const day = String(date.getDate()).padStart(2, '0')
     return `${year}-${month}-${day}`
}

export const getCurrentTimeString = (date: Date = new Date()): string => {
     const hours = String(date.getHours()).padStart(2, '0')
     const minutes = String(date.getMinutes()).padStart(2, '0')
     return `${hours}:${minutes}`
}

export const getMinutesFromTime = (timeStr: string): number => {
     if (!timeStr) return 0
     const [hours, minutes] = timeStr.split(':').map(Number)
     return hours * 60 + minutes
}

export const getWeekStart = (date: Date): Date => {
     const d = new Date(date)
     const day = d.getDay()
     d.setDate(d.getDate() - day)
     d.setHours(0, 0, 0, 0)
     return d
}

export const formatHour = (hour: number): string => {
     if (hour === 0) return '12 AM'
     if (hour < 12) return `${hour} AM`
     if (hour === 12) return '12 PM'
     return `${hour - 12} PM`
}

export const isDateDisabled = (date: Date): boolean => {
     const today = new Date()
     today.setHours(0, 0, 0, 0)

     const checkDate = new Date(date)
     checkDate.setHours(0, 0, 0, 0)
     return checkDate < today
}
