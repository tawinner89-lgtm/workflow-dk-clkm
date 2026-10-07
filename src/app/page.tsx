
'use client';

import React, { useEffect, useState } from 'react';
import TechnicianForm from '@/components/TechnicianForm';
import { db } from '@/lib/db';
import { Calendar, User, ChevronRight, LogOut, Wifi, WifiOff, CheckCircle } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Intervention } from '@/types';

export default function Home() {
  const { t } = useLanguage();
  const [techName, setTechName] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [activeTab, setActiveTab] = useState<'A_FAIRE' | 'HISTORIQUE'>('A_FAIRE');
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Auth States
  const [availableTechs, setAvailableTechs] = useState<{name: string}[]>([]);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('techName');
    if (saved) {
      setTechName(saved);
      setIsLogged(true);
      fetchTasks(saved);
    }

    // Fetch technicians list
    const fetchTechs = async () => {
      try {
        const res = await fetch('/api/technicians', { cache: 'no-store' });
        const json = await res.json();
        if (json.success) {
          setAvailableTechs(json.data);
          if (!saved && json.data.length > 0) {
            setTechName(json.data[0].name);
          }
        }
      } catch (err) {
        console.error("Failed to load technicians", err);
      }
    };
    fetchTechs();
  }, []);

  const fetchTasks = async (name: string) => {
    // 1. If online, fetch from API and put in Dexie
    if (navigator.onLine) {
      try {
        const res = await fetch(`/api/interventions?technicianName=${encodeURIComponent(name)}`, { cache: 'no-store' });
        
        if (res.status === 401) {
          handleLogout();
          return;
        }

        const json = await res.json();
        if (json.success) {
          const apiRefs = new Set(json.data.map((item: Intervention) => item.reference));
          
          for (const item of json.data) {
            // Upsert in Dexie (prevent overwriting local offline progress, but update core admin fields)
            const exists = await db.interventions.where('reference').equals(item.reference).first();
            if (!exists) {
              await db.interventions.add({ ...item, synced: true });
            } else if (exists.synced !== false) {
              // Only overwrite local data with server data if there are no pending offline changes
              await db.interventions.update(exists.id!, {
                technicianName: item.technicianName,
                clientName: item.clientName,
                clientAddress: item.clientAddress,
                clientContactName: item.clientContactName,
                clientContactPhone: item.clientContactPhone,
                type: item.type,
                startTime: item.startTime,
                endTime: item.endTime,
                problemReported: item.problemReported,
                status: item.status
              });
            }
          }
          
          // Cleanup: Only remove local PLANIFIEE/EN_COURS that are no longer on the server.
          // NEVER delete TERMINEE/REPORTEE/ANNULEE from local â€” the technician's Historique
          // should persist even if admin cleans up the DB.
          const allLocal = await db.interventions
            .where('technicianName').equals(name)
            .toArray();
            
          for (const local of allLocal) {
            const isActive = local.status === 'PLANIFIEE' || local.status === 'EN_COURS';
            if (isActive && !apiRefs.has(local.reference)) {
              await db.interventions.delete(local.id!);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch down sync", err);
      }
    }

    // 2. Read from Dexie
    const localTasks = await db.interventions
      .where('technicianName')
      .equals(name)
      .toArray();
      
    setInterventions(localTasks as unknown as Intervention[]);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!techName || !password) return;

    try {
      const res = await fetch('/api/technicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: techName, password })
      });
      const json = await res.json();
      
      if (json.success) {
        localStorage.setItem('techName', techName);
        setIsLogged(true);
        fetchTasks(techName);
      } else {
        setLoginError(json.error || 'Identifiants incorrects');
      }
    } catch {
      setLoginError('Erreur de connexion');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('techName');
    setTechName('');
    setIsLogged(false);
    setInterventions([]);
  };

  if (selectedIntervention) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 pt-4 relative">
        <div className="absolute top-0 inset-x-0 h-40 bg-brand-500/20 blur-3xl -z-10 rounded-full" />
        <div className="max-w-md mx-auto px-4 mb-4">
          <button 
            onClick={() => {
              setSelectedIntervention(null);
              fetchTasks(techName);
            }} 
            className="text-brand-600 font-medium hover:underline flex items-center gap-1"
          >
            â† Retour Ã  la liste
          </button>
        </div>
        <TechnicianForm draft={selectedIntervention} onComplete={() => {
          setSelectedIntervention(null);
          fetchTasks(techName);
        }} />
      </main>
    );
  }

  if (!isLogged) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6 relative">
        <div className="absolute top-6 right-6">
          <LanguageSwitcher />
        </div>
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">DK CLIM</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-red-100 text-red-600 rounded-lg text-sm text-center">
                {loginError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('whoAreYou')}</label>
              <select 
                required 
                value={techName}
                onChange={e => setTechName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="" disabled>
                  {availableTechs.length > 0 ? "SÃ©lectionnez votre nom" : "Aucun technicien disponible"}
                </option>
                {availableTechs.map(t => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mot de passe</label>
              <input 
                required 
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Votre mot de passe"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 outline-none focus:ring-2 focus:ring-brand-500" 
              />
            </div>
            <button type="submit" className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold transition">
              {t('login')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex justify-between items-start mb-4">
          <LanguageSwitcher />
        </div>
        <div className="flex justify-between items-center bg-brand-600 text-white p-6 rounded-3xl shadow-lg">
          <div>
            <h2 className="text-2xl font-bold">{techName}</h2>
          </div>
          <div className="flex flex-col items-end gap-3">
            {isOnline ? (
              <span className="flex items-center gap-1 text-xs bg-brand-500 px-2 py-1 rounded-full"><Wifi className="w-3 h-3" /> {t('online')}</span>
            ) : (
              <span className="flex items-center gap-1 text-xs bg-red-500 px-2 py-1 rounded-full"><WifiOff className="w-3 h-3" /> {t('offline')}</span>
            )}
            <button onClick={handleLogout} className="text-brand-200 hover:text-white transition" title={t('logout')}>
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-end mb-2">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-600" />
              {t('myInterventions')}
            </h3>
          </div>

          <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl mb-4">
            <button 
              onClick={() => setActiveTab('A_FAIRE')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'A_FAIRE' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Ã€ Faire
            </button>
            <button 
              onClick={() => setActiveTab('HISTORIQUE')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'HISTORIQUE' ? 'bg-white dark:bg-slate-700 text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Historique
            </button>
          </div>
          
          {(() => {
            const displayed = activeTab === 'A_FAIRE' 
              ? interventions.filter(i => i.status === 'PLANIFIEE' || i.status === 'EN_COURS')
              : interventions.filter(i => i.status !== 'PLANIFIEE' && i.status !== 'EN_COURS');
              
            if (displayed.length === 0) {
              return (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center shadow-sm border border-slate-200 dark:border-slate-700">
                  <CheckCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500">{activeTab === 'A_FAIRE' ? t('noPlannedTasks') : 'Historique vide'}</p>
                </div>
              );
            }
            
            return (
              <div className="space-y-3">
                {displayed.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedIntervention(item)}
                    className="w-full text-left bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-1 rounded-md ${item.status === 'PLANIFIEE' || item.status === 'EN_COURS' ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{item.reference}</span>
                        {item.status !== 'PLANIFIEE' && (
                          <span className={`text-[10px] font-bold uppercase tracking-wider border rounded px-1.5 py-0.5 ${item.status === 'EN_COURS' ? 'text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-700' : 'text-slate-500 border-slate-200 dark:border-slate-600'}`}>
                            {item.status.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-brand-600 transition" />
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-lg">{item.clientName}</h4>
                    <p className="text-sm text-slate-500 mt-1 line-clamp-1">{item.clientAddress}</p>
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}


