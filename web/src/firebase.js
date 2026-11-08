import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyCjS0Kk5ve0DeI3ijc-O59-jIUqo0hGiqQ',
  authDomain: 'sapienscampus-97b6a.firebaseapp.com',
  projectId: 'sapienscampus-97b6a',
  storageBucket: 'sapienscampus-97b6a.firebasestorage.app',
  messagingSenderId: '103400459966',
  appId: '1:103400459966:web:5532cb4192eab9c7c618ef',
  measurementId: 'G-W6RB06V7GZ',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)

export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
}
