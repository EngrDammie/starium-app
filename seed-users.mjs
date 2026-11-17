import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const TEST_USERS = [
  { email: 'procurement.officer@starium.com', password: 'success123', displayName: 'Procurement Officer', departmentRoles: ['procurement_staff'], actionRoles: [] },
  { email: 'procurement.head@starium.com', password: 'success123', displayName: 'Procurement Head', departmentRoles: ['procurement_manager'], actionRoles: ['procurement_head'] },
  { email: 'finance.mgr@starium.com', password: 'success123', displayName: 'Finance Manager', departmentRoles: ['finance_manager'], actionRoles: ['finance_manager'] },
  { email: 'warehouse.clerk@starium.com', password: 'success123', displayName: 'Warehouse Clerk', departmentRoles: ['warehouse_clerk'], actionRoles: [] },
  { email: 'warehouse.mgr@starium.com', password: 'success123', displayName: 'Warehouse Manager', departmentRoles: ['warehouse_manager'], actionRoles: ['warehouse_manager'] },
  { email: 'prod.supervisor@starium.com', password: 'success123', displayName: 'Production Supervisor', departmentRoles: ['production_supervisor'], actionRoles: [] },
  { email: 'prod.operator@starium.com', password: 'success123', displayName: 'Production Operator', departmentRoles: ['production_operator'], actionRoles: [] },
  { email: 'recipe.mgr@starium.com', password: 'success123', displayName: 'Recipe Manager', departmentRoles: ['recipe_manager'], actionRoles: ['recipe_manager'] },
  { email: 'packing.operator@starium.com', password: 'success123', displayName: 'Packing Operator', departmentRoles: ['packing_operator'], actionRoles: [] },
];

async function seedUsers() {
  console.log('🌱 Seeding ERP test users...');
  
  for (const user of TEST_USERS) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
      const uid = userCredential.user.uid;
      
      await setDoc(doc(db, 'user_roles', uid), {
        uid,
        email: user.email,
        displayName: user.displayName,
        departmentRoles: user.departmentRoles,
        actionRoles: user.actionRoles,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      console.log(`✅ ${user.email} (${user.displayName})`);
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        console.log(`⏭️  ${user.email} already exists`);
      } else {
        console.error(`❌ ${user.email}:`, e.message);
      }
    }
  }
  
  console.log('🎉 ERP user seeding complete!');
  process.exit(0);
}

seedUsers().catch(e => { console.error(e); process.exit(1); });
