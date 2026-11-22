import { defineStore } from 'pinia'
import { useAuthStore } from './auth'
import { saveProject, deleteProject as deleteProjectFromFirebase, getAllUserProjects, PROJECT_COLORS } from '../firebase/projects'
import type { Project } from '../firebase/projects'

export const useProjectsStore = defineStore('projects', {
     state: () => ({
          projects: [] as Project[],
          selectedProjectId: null as string | null,
          loading: false,
          synced: false
     }),

     getters: {
          selectedProject: (state) => state.projects.find(p => p.id === state.selectedProjectId) ?? null,

          getProjectById: (state) => (id: string) => state.projects.find(p => p.id === id) ?? null
     },

     actions: {
          async loadUserProjects() {
               const authStore = useAuthStore()
               if (!authStore.user) return
               try {
                    this.loading = true
                    const projects = await getAllUserProjects(authStore.user.uid)
                    this.projects = projects.sort((a, b) => a.name.localeCompare(b.name))
                    this.synced = true
               } catch (e) {
                    console.error('Error loading projects:', e)
               } finally {
                    this.loading = false
               }
          },

          async addProject(name: string, color?: string) {
               const authStore = useAuthStore()
               if (!authStore.user || !name.trim()) return

               const newProject: Project = {
                    id: Date.now().toString(),
                    name: name.trim(),
                    color: color || PROJECT_COLORS[this.projects.length % PROJECT_COLORS.length],
                    userId: authStore.user.uid
               }

               this.projects.push(newProject)
               this.projects.sort((a, b) => a.name.localeCompare(b.name))

               try {
                    const { userId, ...toSave } = newProject
                    await saveProject(authStore.user.uid, toSave)
               } catch (e) {
                    console.error('Error saving project:', e)
                    this.projects = this.projects.filter(p => p.id !== newProject.id)
               }

               return newProject
          },

          async deleteProject(projectId: string) {
               const authStore = useAuthStore()
               const prev = [...this.projects]
               this.projects = this.projects.filter(p => p.id !== projectId)
               if (this.selectedProjectId === projectId) this.selectedProjectId = null

               if (authStore.user) {
                    try {
                         await deleteProjectFromFirebase(authStore.user.uid, projectId)
                    } catch (e) {
                         console.error('Error deleting project:', e)
                         this.projects = prev
                    }
               }
          },

          selectProject(id: string | null) {
               this.selectedProjectId = id
          }
     }
})
