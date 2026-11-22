import { ref } from 'vue'
import { isDateDisabled, formatDate } from '../utils/dateUtils'

export function useDragDrop(selectedDate: any, store: any, currentTasks: any, getTasksForColumn: (colId: string) => any[]) {
     const draggedTaskId = ref<string | null>(null)
     const draggedOverTaskId = ref<string | null>(null)
     const draggedOverColumn = ref<string | null>(null)

     const handleDragStart = (e: DragEvent, taskId: string) => {
          if (!selectedDate.value || isDateDisabled(selectedDate.value)) return
          draggedTaskId.value = taskId
          if (e.dataTransfer) {
               e.dataTransfer.effectAllowed = 'move'
               e.dataTransfer.setData('text/plain', taskId)
          }
     }

     const handleDragOver = (e: DragEvent, taskId: string) => {
          if (!selectedDate.value || isDateDisabled(selectedDate.value)) return
          e.preventDefault()
          if (e.dataTransfer) {
               e.dataTransfer.dropEffect = 'move'
          }
          draggedOverTaskId.value = taskId
     }

     const handleDragLeave = () => {
          draggedOverTaskId.value = null
     }

     const handleColumnDragOver = (e: DragEvent, columnId: string) => {
          if (!selectedDate.value || isDateDisabled(selectedDate.value)) return
          e.preventDefault()
          if (e.dataTransfer) {
               e.dataTransfer.dropEffect = 'move'
          }
          draggedOverColumn.value = columnId
     }

     const handleColumnDragLeave = () => {
          draggedOverColumn.value = null
     }

     const handleDragEnd = () => {
          draggedTaskId.value = null
          draggedOverTaskId.value = null
          draggedOverColumn.value = null
     }

     const handleDrop = (e: DragEvent, targetTaskId?: string, targetColumn?: string) => {
          if (!selectedDate.value || isDateDisabled(selectedDate.value)) return
          e.preventDefault()

          const sourceTaskId = draggedTaskId.value
          if (!sourceTaskId) {
               handleDragEnd()
               return
          }

          const dateKey = formatDate(selectedDate.value)
          // Create a copy of tasks to manipulate
          const tasks = [...currentTasks.value]
          const sourceTask = tasks.find((t: any) => t.id === sourceTaskId)

          if (!sourceTask) {
               handleDragEnd()
               return
          }

          // If dropping on a column (not a specific task)
          if (targetColumn && !targetTaskId) {
               // Move task to the end of the target column
               const targetColumnTasks = getTasksForColumn(targetColumn)
               const newOrder = targetColumnTasks.length

               // Update task order
               sourceTask.order = newOrder

               // Save to Firebase
               store.reorderTasks(dateKey, tasks.map((t: any) => t.id))
          }
          // If dropping on a specific task
          else if (targetTaskId) {
               const sourceIndex = tasks.findIndex((t: any) => t.id === sourceTaskId)
               const targetIndex = tasks.findIndex((t: any) => t.id === targetTaskId)

               if (sourceIndex === -1 || targetIndex === -1) {
                    handleDragEnd()
                    return
               }

               // Reorder tasks
               const [removed] = tasks.splice(sourceIndex, 1)
               tasks.splice(targetIndex, 0, removed)

               // Update order values
               tasks.forEach((task: any, index: number) => {
                    task.order = index
               })

               // Save new order
               const taskIds = tasks.map((t: any) => t.id)
               store.reorderTasks(dateKey, taskIds)
          }

          handleDragEnd()
     }

     return {
          draggedTaskId,
          draggedOverTaskId,
          draggedOverColumn,
          handleDragStart,
          handleDragOver,
          handleDragLeave,
          handleColumnDragOver,
          handleColumnDragLeave,
          handleDragEnd,
          handleDrop
     }
}
