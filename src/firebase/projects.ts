import {
     collection,
     doc,
     setDoc,
     getDocs,
     deleteDoc,
     query,
     where,
     serverTimestamp
} from 'firebase/firestore'
import { db } from './config'

export interface Project {
     id: string
     name: string
     color: string
     userId: string
     createdAt?: any
     updatedAt?: any
}

export const PROJECT_COLORS = [
     '#4ade80', // green
     '#60a5fa', // blue
     '#f472b6', // pink
     '#fb923c', // orange
     '#a78bfa', // purple
     '#34d399', // emerald
     '#f87171', // red
     '#facc15', // yellow
]

export const saveProject = async (userId: string, project: Omit<Project, 'userId'>): Promise<Project> => {
     const projectRef = doc(db, 'projects', `${userId}_${project.id}`)
     const data: Project = {
          ...project,
          userId,
          updatedAt: serverTimestamp()
     }
     await setDoc(projectRef, data, { merge: true })
     return data
}

export const deleteProject = async (userId: string, projectId: string): Promise<void> => {
     const projectRef = doc(db, 'projects', `${userId}_${projectId}`)
     await deleteDoc(projectRef)
}

export const getAllUserProjects = async (userId: string): Promise<Project[]> => {
     const projectsRef = collection(db, 'projects')
     const q = query(projectsRef, where('userId', '==', userId))
     const snapshot = await getDocs(q)
     const projects: Project[] = []
     snapshot.forEach(d => projects.push(d.data() as Project))
     return projects
}
