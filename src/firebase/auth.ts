import {
     signInWithPopup,
     signOut,
     onAuthStateChanged,
     type User
} from 'firebase/auth'
import {
     doc,
     setDoc,
     getDoc,
     serverTimestamp
} from 'firebase/firestore'
import { auth, googleProvider, db } from './config'

export interface UserData {
     uid: string
     email: string | null
     displayName: string | null
     photoURL: string | null
     createdAt?: any
     lastLogin?: any
}

// Sign in with Google
export const signInWithGoogle = async () => {
     try {
          const result = await signInWithPopup(auth, googleProvider)
          const user = result.user

          // Save user data to Firestore
          await saveUserData(user)

          return user
     } catch (error: any) {
          console.error('Error signing in with Google:', error)
          throw error
     }
}

// Save user data to Firestore
export const saveUserData = async (user: User) => {
     try {
          const userRef = doc(db, 'users', user.uid)
          const userSnap = await getDoc(userRef)

          const userData: UserData = {
               uid: user.uid,
               email: user.email,
               displayName: user.displayName,
               photoURL: user.photoURL,
               lastLogin: serverTimestamp()
          }

          if (!userSnap.exists()) {
               // New user - add createdAt
               userData.createdAt = serverTimestamp()
          }

          await setDoc(userRef, userData, { merge: true })

          return userData
     } catch (error) {
          console.error('Error saving user data:', error)
          throw error
     }
}

// Sign out
export const logout = async () => {
     try {
          await signOut(auth)
     } catch (error) {
          console.error('Error signing out:', error)
          throw error
     }
}

// Get current user data from Firestore
export const getUserData = async (uid: string): Promise<UserData | null> => {
     try {
          const userRef = doc(db, 'users', uid)
          const userSnap = await getDoc(userRef)

          if (userSnap.exists()) {
               return userSnap.data() as UserData
          }
          return null
     } catch (error) {
          console.error('Error getting user data:', error)
          throw error
     }
}

// Listen to auth state changes
export const onAuthChange = (callback: (user: User | null) => void) => {
     return onAuthStateChanged(auth, callback)
}
