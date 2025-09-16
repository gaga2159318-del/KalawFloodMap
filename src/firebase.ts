import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, push, remove, onValue, off } from 'firebase/database';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from "firebase/storage";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAd5ezb6CHDXcmZVrpoTUbbJyxdnLaM9Jw",
  authDomain: "floodmap-4f332.firebaseapp.com",
  databaseURL: "https://floodmap-4f332-default-rtdb.firebaseio.com", // ✅ use this
  projectId: "floodmap-4f332",
  storageBucket: "floodmap-4f332.appspot.com", // ✅ fix storage
  messagingSenderId: "1084370440686",
  appId: "1:1084370440686:web:f7cb89d3cea6674284beff",
  measurementId: "G-C01XXM1E9N"
};

// Initialize
const app = initializeApp(firebaseConfig);
const database = getDatabase(app); // ✅ no need to pass URL anymore


export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
});
export const storage = getStorage(app);

// Database references
const DB_KEYS = {
  MONITORED_AREAS: 'monitoredAreas',
  FLOOD_RECORDS: 'floodRecords',
  DISREGARD_RECORDS: 'disregardRecords',
  NOTIFICATIONS: 'notifications',
  THEME_PREFERENCE: 'themePreference',
  FLOOD_EVENTS: 'floodEvents'
};

// Utility function to clean data by removing undefined properties
const cleanData = (data: any): any => {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map(cleanData);
  }
  const cleaned: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleaned[key] = cleanData(value);
    }
  }
  return cleaned;
};

// Firebase service functions
export const firebaseService = {
  // Monitored Areas
  async saveMonitoredAreas(areas: any[]): Promise<void> {
    try {
      const cleanedAreas = cleanData(areas);
      await set(ref(database, DB_KEYS.MONITORED_AREAS), cleanedAreas);
      console.log('Monitored areas saved to Firebase');
    } catch (error) {
      console.error('Error saving monitored areas to Firebase:', error);
      throw error;
    }
  },

  async loadMonitoredAreas(): Promise<any[]> {
    try {
      const snapshot = await get(ref(database, DB_KEYS.MONITORED_AREAS));
      return snapshot.exists() ? snapshot.val() : [];
    } catch (error) {
      console.error('Error loading monitored areas from Firebase:', error);
      return [];
    }
  },

  // Flood Records
  async saveFloodRecord(record: any): Promise<void> {
    try {
      const newRecordRef = push(ref(database, DB_KEYS.FLOOD_RECORDS));
      const cleanedRecord = cleanData({
        ...record,
        id: newRecordRef.key,
        timestamp: new Date().toISOString()
      });
      await set(newRecordRef, cleanedRecord);
      console.log('Flood record saved to Firebase');
    } catch (error) {
      console.error('Error saving flood record to Firebase:', error);
      throw error;
    }
  },

  async loadFloodRecords(): Promise<any[]> {
    try {
      const snapshot = await get(ref(database, DB_KEYS.FLOOD_RECORDS));
      if (!snapshot.exists()) return [];
      
      const records = snapshot.val();
      return Object.keys(records).map(key => records[key]);
    } catch (error) {
      console.error('Error loading flood records from Firebase:', error);
      return [];
    }
  },

  // Disregard Records
  async saveDisregardRecord(record: any): Promise<void> {
    try {
      const newRecordRef = push(ref(database, DB_KEYS.DISREGARD_RECORDS));
      const cleanedRecord = cleanData({
        ...record,
        id: newRecordRef.key,
        timestamp: new Date().toISOString()
      });
      await set(newRecordRef, cleanedRecord);
      console.log('Disregard record saved to Firebase');
    } catch (error) {
      console.error('Error saving disregard record to Firebase:', error);
      throw error;
    }
  },

  async loadDisregardRecords(): Promise<any[]> {
    try {
      const snapshot = await get(ref(database, DB_KEYS.DISREGARD_RECORDS));
      if (!snapshot.exists()) return [];
      
      const records = snapshot.val();
      return Object.keys(records).map(key => records[key]);
    } catch (error) {
      console.error('Error loading disregard records from Firebase:', error);
      return [];
    }
  },

  // Flood Events (user-submitted reports via modal)
  async saveFloodEvent(event: any): Promise<string> {
    try {
      const newEventRef = push(ref(database, DB_KEYS.FLOOD_EVENTS));
      const key = newEventRef.key as string;
      const cleanedEvent = cleanData({
        ...event,
        id: key,
        submittedAt: new Date().toISOString()
      });
      await set(newEventRef, cleanedEvent);
      console.log('Flood event saved to Firebase with key:', key);
      return key;
    } catch (error) {
      console.error('Error saving flood event to Firebase:', error);
      throw error;
    }
  },

  async loadFloodEvents(): Promise<any[]> {
    try {
      const snapshot = await get(ref(database, DB_KEYS.FLOOD_EVENTS));
      if (!snapshot.exists()) return [];
      const obj = snapshot.val();
      return Object.keys(obj).map(k => obj[k]);
    } catch (error) {
      console.error('Error loading flood events from Firebase:', error);
      return [];
    }
  },
 
  // Notifications
  async saveNotifications(notifications: any[]): Promise<void> {
    try {
      const cleanedNotifications = cleanData(notifications);
      await set(ref(database, DB_KEYS.NOTIFICATIONS), cleanedNotifications);
      console.log('Notifications saved to Firebase');
    } catch (error) {
      console.error('Error saving notifications to Firebase:', error);
      throw error;
    }
  },

  async loadNotifications(): Promise<any[]> {
    try {
      const snapshot = await get(ref(database, DB_KEYS.NOTIFICATIONS));
      return snapshot.exists() ? snapshot.val() : [];
    } catch (error) {
      console.error('Error loading notifications from Firebase:', error);
      return [];
    }
  },

  async clearNotifications(): Promise<void> {
    try {
      await remove(ref(database, DB_KEYS.NOTIFICATIONS));
      console.log('Notifications cleared from Firebase');
    } catch (error) {
      console.error('Error clearing notifications from Firebase:', error);
      throw error;
    }
  },

  // Theme Preference
  async saveThemePreference(theme: string): Promise<void> {
    try {
      await set(ref(database, DB_KEYS.THEME_PREFERENCE), theme);
      console.log('Theme preference saved to Firebase');
    } catch (error) {
      console.error('Error saving theme preference to Firebase:', error);
      throw error;
    }
  },

  async loadThemePreference(): Promise<string | null> {
    try {
      const snapshot = await get(ref(database, DB_KEYS.THEME_PREFERENCE));
      return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
      console.error('Error loading theme preference from Firebase:', error);
      return null;
    }
  },

  // Real-time listeners
  onMonitoredAreasChange(callback: (areas: any[]) => void): () => void {
    const areasRef = ref(database, DB_KEYS.MONITORED_AREAS);
    onValue(areasRef, (snapshot) => {
      const areas = snapshot.exists() ? snapshot.val() : [];
      callback(Array.isArray(areas) ? areas : []);
    });

    return () => off(areasRef);
  },

  onFloodRecordsChange(callback: (records: any[]) => void): () => void {
    const recordsRef = ref(database, DB_KEYS.FLOOD_RECORDS);
    onValue(recordsRef, (snapshot) => {
      if (!snapshot.exists()) {
        callback([]);
        return;
      }
      
      const records = snapshot.val();
      const recordsArray = Object.keys(records).map(key => records[key]);
      callback(recordsArray);
    });

    return () => off(recordsRef);
  }
};

export default app;


