export interface Intervention {
  id: string;
  reference: string;
  clientName: string;
  clientAddress: string;
  clientContactName?: string;
  clientContactPhone?: string;
  technicianName: string;
  type?: string;
  startTime?: string;
  endTime?: string;
  problemReported?: string;
  workDone?: string | Record<string, string>[];
  workDoneOther?: string;
  materialsUsed?: string;
  blowTemperature?: string | number;
  functioningTest?: boolean;
  photoBeforeUrl?: string;
  photoAfterUrl?: string;
  observations?: string;
  status: string;
  finalStatus?: boolean;
  signatureTechUrl?: string;
  signatureClientUrl?: string;
  createdAt: string;
}

export interface Technician {
  id: string;
  name: string;
  phone?: string;
  createdAt?: string;
}
