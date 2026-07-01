import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();
const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    console.error("Error signing in with Google", error);
    if (error.code === 'auth/cancelled-popup-request') {
      console.warn("User cancelled the popup request.");
    } else {
      alert("ログイン中にエラーが発生しました: " + (error.message || error));
    }
  }
};

export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
};

export const saveScore = async (userId: string, difficulty: string, correctCount: number, totalQuestions: number) => {
  try {
    const scoresRef = collection(db, 'scores');
    await addDoc(scoresRef, {
      userId,
      difficulty,
      correctCount,
      totalQuestions,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error saving score", error);
    throw error;
  }
};

export const getMyScores = async (userId: string) => {
  try {
    const scoresRef = collection(db, 'scores');
    const q = query(scoresRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const scores: any[] = [];
    querySnapshot.forEach((doc) => {
      scores.push({ id: doc.id, ...doc.data() });
    });
    // Sort manually as we might need an index for orderBy
    return scores.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
  } catch (error) {
    console.error("Error fetching scores", error);
    return [];
  }
};
