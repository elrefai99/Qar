export const getHourSlotHeight = (): number => {
     if (typeof window === 'undefined') return 56
     const width = window.innerWidth
     if (width < 640) return 48  // default (h-12 = 3rem = 48px)
     if (width < 768) return 56  // sm (h-14 = 3.5rem = 56px)
     if (width < 1024) return 64  // md (h-16 = 4rem = 64px)
     return 80  // lg+ (h-20 = 5rem = 80px)
}

export const getTaskPosition = (timeStr: string, hourSlotHeight: number = 60) => {
     const [hourStr, minuteStr] = timeStr.split(':')
     const hour = parseInt(hourStr) || 0
     const minute = parseInt(minuteStr) || 0

     // Start from 6 AM (hour 6)
     const startHour = 6
     if (hour < startHour) return { top: 0, height: hourSlotHeight, display: false }
     if (hour > 23) return { top: 0, height: hourSlotHeight, display: false }

     // Calculate position: each hour = hourSlotHeight px, each minute = hourSlotHeight/60 px
     const top = ((hour - startHour) * hourSlotHeight) + (minute * (hourSlotHeight / 60))
     // Default height: 1 hour slot
     const height = hourSlotHeight

     return { top, height, display: true }
}
