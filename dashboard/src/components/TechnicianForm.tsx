/* eslint-disable */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import SignatureCanvas from 'react-signature-canvas';
import { Camera, Save, CheckCircle, XCircle, PenTool, UploadCloud, RefreshCw } from 'lucide-react';
import { db } from '@/lib/db';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { compressImage } from '@/lib/imageUtils';
import { ReportTemplate } from './ReportTemplate';
import { useLanguage } from './LanguageProvider';

const WORK_DONE_OPTIONS = [
  "Vérification générale",
  "Nettoyage filtres",
  "Contrôle électrique",
  "Appoint charge fluide",
  "Remplacement pièce",
  "Tests de fonctionnement"
];

export default function TechnicianForm({ draft, onComplete }: { draft?: any, onComplete?: () => void }) {
  const { t } = useLanguage();
  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      clientName: draft?.clientName || '',
      clientAddress: draft?.clientAddress || '',
      clientContactName: draft?.clientContactName || '',
      clientContactPhone: draft?.clientContactPhone || '',
      technicianName: draft?.technicianName || '',
      type: draft?.type || 'Maintenance',
      startTime: draft?.startTime || '',
      endTime: draft?.endTime || '',
      problemReported: draft?.problemReported || '',
      workDone: (typeof draft?.workDone === 'string' ? JSON.parse(draft.workDone) : draft?.workDone) || ([] as string[]),
      workDoneOther: draft?.workDoneOther || '',
      materialsUsed: draft?.materialsUsed || '',
      blowTemperature: draft?.blowTemperature || '',
      functioningTest: draft?.functioningTest ?? true,
      observations: draft?.observations || '',
      finalStatus: draft?.finalStatus ?? true,
    }
  });

  const [photoBefore, setPhotoBefore] = useState<string | null>(draft?.photoBeforeUrl || null);
  const [photoAfter, setPhotoAfter] = useState<string | null>(draft?.photoAfterUrl || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  
  // Data for the hidden PDF template
  const [pdfData, setPdfData] = useState<any>({});

  const sigTechRef = useRef<any>(null);
  const sigClientRef = useRef<any>(null);

  // Sync Logic
  const syncOfflineData = async () => {
    if (isSyncing || !navigator.onLine) return;
    
    try {
      setIsSyncing(true);
      const allDrafts = await db.interventions.toArray();
      // Only sync records that belong to the current logged-in technician
      // to avoid mixing records on shared devices
      const techName = typeof window !== 'undefined' ? localStorage.getItem('techName') : null;
      const pending = allDrafts.filter(d => d.synced === false && (!techName || d.technicianName === techName));
      
      if (pending.length > 0) {
        setSyncStatus(`Synchronisation de ${pending.length} rapport(s)...`);
        
        const response = await fetch('/api/interventions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pending)
        });
        
        if (response.status === 401 || response.status === 403) {
          for (const item of pending) {
            await db.interventions.delete(item.id!);
          }
          setSyncStatus('Rapports annulés (réassignés).');
          setTimeout(() => setSyncStatus(null), 3000);
          return;
        }

        const result = await response.json();
        
        if (result.success) {
          // Only mark items as synced if they successfully saved on the server
          const successRefs = new Set(result.results?.map((r: any) => r.reference) || []);
          for (const item of pending) {
            if (successRefs.has(item.reference)) {
              await db.interventions.update(item.id!, { synced: true });
            }
          }
          if (result.errors && result.errors.length > 0) {
            setSyncStatus(`Certains rapports ont échoué.`);
          } else {
            setSyncStatus('Tous les rapports sont synchronisés.');
            setTimeout(() => setSyncStatus(null), 3000);
          }
        } else {
          setSyncStatus('Erreur de synchronisation.');
        }
      }
    } catch (error) {
      console.error("Sync error:", error);
      setSyncStatus('Échec de la connexion au serveur.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    // Attempt sync on mount
    syncOfflineData();
    
    // Add listeners for online status
    window.addEventListener('online', syncOfflineData);
    return () => window.removeEventListener('online', syncOfflineData);
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, setPhoto: React.Dispatch<React.SetStateAction<string | null>>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file, 1024, 0.8);
        setPhoto(compressedBase64);
      } catch (err) {
        console.error("Erreur de compression d'image:", err);
      }
    }
  };

  const clearSignature = (ref: React.RefObject<any>) => {
    ref.current?.clear();
  };

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const sigTechUrl = sigTechRef.current?.isEmpty() ? null : sigTechRef.current?.getCanvas().toDataURL('image/png');
      const sigClientUrl = sigClientRef.current?.isEmpty() ? null : sigClientRef.current?.getCanvas().toDataURL('image/png');

      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const reference = draft?.reference || `INT-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${randomStr}`;

      const interventionData = {
        ...data,
        reference,
        photoBeforeUrl: photoBefore || undefined,
        photoAfterUrl: photoAfter || undefined,
        signatureTechUrl: sigTechUrl,
        signatureClientUrl: sigClientUrl,
        blowTemperature: data.blowTemperature ? parseFloat(data.blowTemperature) : '',
        synced: false,
        status: 'TERMINEE', // Workflow update
        createdAt: draft?.createdAt || new Date().toISOString(),
      };

      // Set data for PDF render
      setPdfData(interventionData);

      // We need a tiny delay to allow React to render the hidden ReportTemplate with the new pdfData
      await new Promise((resolve) => setTimeout(resolve, 300));

      const rootElement = document.getElementById('pdf-report');
      if (rootElement) {
        try {
          const sections = rootElement.querySelectorAll('.pdf-section');
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          
          const marginX = (48 / 794) * pdfWidth; 
          const printWidth = pdfWidth - (2 * marginX);
          let currentY = marginX;

          for (let i = 0; i < sections.length; i++) {
            const section = sections[i] as HTMLElement;
            const canvas = await html2canvas(section, { 
              scale: 2, 
              useCORS: true, 
              allowTaint: true,
              backgroundColor: '#ffffff'
            });
            
            if (!canvas || canvas.width === 0 || canvas.height === 0) continue;

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            if (!imgData || imgData === 'data:,') continue;

            const imgHeight = (canvas.height * printWidth) / canvas.width;
            
            if (currentY + imgHeight > pageHeight - marginX && currentY > marginX) {
              pdf.addPage();
              currentY = marginX;
            }
            
            pdf.addImage(imgData, 'JPEG', marginX, currentY, printWidth, imgHeight);
            currentY += imgHeight;
            currentY += 6;
          }
          
          pdf.save(`Rapport_${reference}.pdf`);
        } catch (pdfErr) {
          console.error("PDF generation failed", pdfErr);
        }
      }

      // Save to IndexedDB (Offline Support)
      if (draft?.id) {
        await db.interventions.update(draft.id, interventionData);
      } else {
        await db.interventions.add(interventionData);
      }
      
      // Attempt immediate sync
      if (navigator.onLine) {
        syncOfflineData();
      }

      setSubmitSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error("Error saving intervention:", error);
      alert("Erreur lors de la sauvegarde du rapport.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4">
        <CheckCircle className="w-20 h-20 text-green-500" />
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('reportSaved')}</h2>
        <p className="text-slate-500 dark:text-slate-400">
          {t('reportSavedDesc')}
        </p>
        <button 
          onClick={() => {
            if (onComplete) onComplete();
            else window.location.reload();
          }}
          className="mt-6 px-6 py-3 bg-brand-600 text-white rounded-xl font-medium shadow-lg hover:bg-brand-700 transition"
        >
          {t('backHome')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-slate-50 dark:bg-slate-900 min-h-screen">
      {syncStatus && (
        <div className="bg-brand-100 text-brand-700 px-4 py-2 text-sm flex items-center justify-center gap-2 mb-4 rounded-b-xl shadow-sm">
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {syncStatus}
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 pb-12">
        {/* Header */}
      <div className={`text-white -mx-4 -mt-4 px-6 py-8 rounded-b-3xl shadow-md mb-8 ${draft?.status && draft.status !== 'PLANIFIEE' && draft.status !== 'EN_COURS' ? 'bg-slate-600' : 'bg-brand-600'}`}>
        <h1 className="text-2xl font-bold">
          {draft?.status && draft.status !== 'PLANIFIEE' && draft.status !== 'EN_COURS' ? `Historique - ${draft.status}` : t('newReport')}
        </h1>
        <p className="text-white/80 mt-1 opacity-90 text-sm">
          {draft?.status && draft.status !== 'PLANIFIEE' && draft.status !== 'EN_COURS' ? 'Consultation en mode lecture seule.' : t('fillDetails')}
        </p>
      </div>

      {/* Client Info */}
      <section className="glass rounded-2xl p-5 shadow-sm space-y-4 mx-2">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300 flex items-center justify-center text-sm">1</span>
          {t('clientInfo')}
        </h2>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('clientName')}</label>
            <input readOnly={!!draft} {...register('clientName', { required: true })} className={`w-full rounded-xl border border-slate-200 p-3 outline-none ${draft ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-white/50 dark:bg-slate-800/50 focus:ring-2 focus:ring-brand-500'}`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('address')}</label>
            <input readOnly={!!draft} {...register('clientAddress', { required: true })} className={`w-full rounded-xl border border-slate-200 p-3 outline-none ${draft ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-white/50 dark:bg-slate-800/50 focus:ring-2 focus:ring-brand-500'}`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('contact')}</label>
              <input readOnly={!!draft} {...register('clientContactName')} className={`w-full rounded-xl border border-slate-200 p-3 outline-none ${draft ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-white/50 dark:bg-slate-800/50 focus:ring-2 focus:ring-brand-500'}`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('phone')}</label>
              <input readOnly={!!draft} {...register('clientContactPhone')} type="tel" className={`w-full rounded-xl border border-slate-200 p-3 outline-none ${draft ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-white/50 dark:bg-slate-800/50 focus:ring-2 focus:ring-brand-500'}`} />
            </div>
          </div>
        </div>
      </section>

      {/* Intervention Details */}
      <section className="glass rounded-2xl p-5 shadow-sm space-y-4 mx-2">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300 flex items-center justify-center text-sm">2</span>
          {t('interventionDetails')}
        </h2>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('techName')}</label>
            <input readOnly={!!draft} {...register('technicianName', { required: true })} className={`w-full rounded-xl border border-slate-200 p-3 outline-none ${draft ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-white/50 dark:bg-slate-800/50 focus:ring-2 focus:ring-brand-500'}`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('interventionType')}</label>
            <select {...register('type')} className="w-full rounded-xl border-slate-200 bg-white/50 dark:bg-slate-800/50 p-3 outline-none focus:ring-2 focus:ring-brand-500">
              <option value="Maintenance">Maintenance</option>
              <option value="Dépannage">Dépannage</option>
              <option value="Installation">Installation</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('startTime')}</label>
              <input type="time" {...register('startTime', { required: true })} className="w-full rounded-xl border-slate-200 bg-white/50 dark:bg-slate-800/50 p-3 outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('endTime')}</label>
              <input type="time" {...register('endTime', { required: true })} className="w-full rounded-xl border-slate-200 bg-white/50 dark:bg-slate-800/50 p-3 outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
        </div>
      </section>

      {/* Work Done */}
      <section className="glass rounded-2xl p-5 shadow-sm space-y-4 mx-2">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300 flex items-center justify-center text-sm">3</span>
          {t('workDone')}
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('problemReported')}</label>
            <textarea {...register('problemReported')} rows={2} className="w-full rounded-xl border-slate-200 bg-white/50 dark:bg-slate-800/50 p-3 outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('actionsDone')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {WORK_DONE_OPTIONS.map((option) => (
                <label key={option} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white/40 dark:hover:bg-slate-800/40 transition">
                  <input type="checkbox" value={option} {...register('workDone')} className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{option}</span>
                </label>
              ))}
            </div>
            <div className="mt-3">
              <input {...register('workDoneOther')} className="w-full rounded-xl border-slate-200 bg-white/50 dark:bg-slate-800/50 p-3 text-sm outline-none focus:ring-2 focus:ring-brand-500" placeholder={t('other')} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('materials')}</label>
            <textarea {...register('materialsUsed')} rows={2} className="w-full rounded-xl border-slate-200 bg-white/50 dark:bg-slate-800/50 p-3 outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>
        </div>
      </section>

      {/* Measurements & Photos */}
      <section className="glass rounded-2xl p-5 shadow-sm space-y-4 mx-2">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300 flex items-center justify-center text-sm">4</span>
          {t('measurements')}
        </h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('blowTemp')}</label>
            <input type="number" step="0.1" {...register('blowTemperature')} className="w-full rounded-xl border-slate-200 bg-white/50 dark:bg-slate-800/50 p-3 outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('funcTest')}</label>
            <Controller
              name="functioningTest"
              control={control}
              render={({ field }) => (
                <div className="flex bg-white/50 dark:bg-slate-800/50 rounded-xl overflow-hidden p-1">
                  <button type="button" onClick={() => field.onChange(true)} className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${field.value ? 'bg-green-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>{t('conform')}</button>
                  <button type="button" onClick={() => field.onChange(false)} className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${!field.value ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>{t('nonConform')}</button>
                </div>
              )}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          {/* Photo Avant */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('photoBefore')}</label>
            <div className="relative aspect-square rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 overflow-hidden flex flex-col items-center justify-center group hover:bg-slate-100 dark:hover:bg-slate-700 transition">
              {photoBefore ? (
                <img src={photoBefore} alt="Avant" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Camera className="w-8 h-8 text-slate-400 mb-2 group-hover:text-brand-500 transition" />
                  <span className="text-xs text-slate-500">{t('add')}</span>
                </>
              )}
              <input type="file" accept="image/*" capture="environment" onChange={(e) => handlePhotoUpload(e, setPhotoBefore)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            </div>
          </div>
          
          {/* Photo Après */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('photoAfter')}</label>
            <div className="relative aspect-square rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 overflow-hidden flex flex-col items-center justify-center group hover:bg-slate-100 dark:hover:bg-slate-700 transition">
              {photoAfter ? (
                <img src={photoAfter} alt="Après" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Camera className="w-8 h-8 text-slate-400 mb-2 group-hover:text-brand-500 transition" />
                  <span className="text-xs text-slate-500">{t('add')}</span>
                </>
              )}
              <input type="file" accept="image/*" capture="environment" onChange={(e) => handlePhotoUpload(e, setPhotoAfter)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            </div>
          </div>
        </div>
      </section>

      {/* Observations */}
      <section className="glass rounded-2xl p-5 shadow-sm space-y-4 mx-2">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300 flex items-center justify-center text-sm">5</span>
          {t('observationsTitle')}
        </h2>
        <div>
          <textarea {...register('observations')} rows={3} className="w-full rounded-xl border-slate-200 bg-white/50 dark:bg-slate-800/50 p-3 outline-none focus:ring-2 focus:ring-brand-500 resize-none" placeholder={t('observationsPlaceholder')} />
        </div>
      </section>

      {/* Validation & Signatures */}
      <section className="glass rounded-2xl p-5 shadow-sm space-y-6 mx-2">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-300 flex items-center justify-center text-sm">6</span>
          {t('validation')}
        </h2>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('finalStatus')}</label>
          <Controller
            name="finalStatus"
            control={control}
            render={({ field }) => (
              <div className="flex bg-white/50 dark:bg-slate-800/50 rounded-xl overflow-hidden p-1 shadow-inner">
                <button type="button" onClick={() => field.onChange(true)} className={`flex-1 py-3 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 ${field.value ? 'bg-green-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                  <CheckCircle className="w-4 h-4" /> {t('conform')}
                </button>
                <button type="button" onClick={() => field.onChange(false)} className={`flex-1 py-3 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 ${!field.value ? 'bg-red-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                  <XCircle className="w-4 h-4" /> {t('nonConform')}
                </button>
              </div>
            )}
          />
        </div>

        <div className="space-y-4">
          {/* Tech Signature */}
          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('sigTech')}</label>
              <button type="button" onClick={() => clearSignature(sigTechRef)} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">{t('clear')}</button>
            </div>
            <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden touch-none h-32">
              <SignatureCanvas ref={sigTechRef} canvasProps={{ className: 'w-full h-full' }} backgroundColor="transparent" penColor="currentColor" />
            </div>
          </div>
          
          {/* Client Signature */}
          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('sigClient')}</label>
              <button type="button" onClick={() => clearSignature(sigClientRef)} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">{t('clear')}</button>
            </div>
            <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden touch-none h-32">
              <SignatureCanvas ref={sigClientRef} canvasProps={{ className: 'w-full h-full' }} backgroundColor="transparent" penColor="currentColor" />
            </div>
          </div>
        </div>
      </section>

      {/* Submit Button */}
      {(!draft?.status || draft.status === 'PLANIFIEE' || draft.status === 'EN_COURS') && (
        <div className="px-4 pt-4 pb-8 sticky bottom-0 z-10 bg-gradient-to-t from-background via-background to-transparent">
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-brand-500/30 flex items-center justify-center gap-2 transition disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-5 h-5" />
                {t('saveAndClose')}
              </>
            )}
          </button>
        </div>
      )}
    </form>
    
    {/* Hidden PDF Template */}
    <ReportTemplate data={pdfData} />
    
    </div>
  );
}
