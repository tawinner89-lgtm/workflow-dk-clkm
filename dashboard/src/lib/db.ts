import Dexie, { Table } from 'dexie';

export interface InterventionDraft {
  id?: number;
  reference: string;
  clientName: string;
  clientAddress: string;
  clientContactName: string;
  clientContactPhone: string;
  technicianName: string;
  status: string; // 'PLANIFIEE' or 'TERMINEE'
  type?: string;
  startTime?: string;
  endTime?: string;
  problemReported: string;
  workDone: string[];
  workDoneOther: string;
  materialsUsed: string;
  blowTemperature: number | '';
  functioningTest: boolean | null;
  photoBeforeUrl?: string; // base64 or local object URL if offline
  photoAfterUrl?: string; // base64 or local object URL
  observations: string;
  finalStatus: boolean | null;
  signatureTechUrl?: string; // base64
  signatureClientUrl?: string; // base64
  synced: boolean;
  createdAt: string;
}

export class InterventionDB extends Dexie {
  interventions!: Table<InterventionDraft, number>;

  constructor() {
    super('InterventionDB');
    this.version(2).stores({
      interventions: '++id, reference, synced, status, technicianName, createdAt'
    });
  }
}

export const db = new InterventionDB();
