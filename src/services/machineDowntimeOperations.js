import { db } from '../config/firebase';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';

export async function queryMachineDowntime({ date, shift, machineNumber, dayShiftStart = 7, nightShiftStart = 19 }) {
  const dayStart = new Date(date);
  dayStart.setHours(dayShiftStart, 0, 0, 0);

  let dayEnd;
  if (shift === 'DAY') {
    dayEnd = new Date(date);
    dayEnd.setHours(nightShiftStart - 1, 59, 59, 999);
  } else if (shift === 'NIGHT') {
    dayEnd = new Date(date);
    dayEnd.setDate(dayEnd.getDate() + 1);
    dayEnd.setHours(dayShiftStart - 1, 59, 59, 999);
  } else {
    dayEnd = new Date(date);
    dayEnd.setDate(dayEnd.getDate() + 1);
    dayEnd.setHours(dayShiftStart - 1, 59, 59, 999);
  }

  const constraints = [
    where('stoppedAt', '>=', Timestamp.fromDate(dayStart)),
    where('stoppedAt', '<=', Timestamp.fromDate(dayEnd)),
    orderBy('stoppedAt', 'asc'),
  ];

  if (machineNumber) {
    constraints.push(where('machineDisplayNumber', '==', machineNumber));
  }

  const q = query(collection(db, 'stopped_machines'), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
