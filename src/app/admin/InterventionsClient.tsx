
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw, FileText, CheckCircle, XCircle, Search, Plus, X, Trash2, Edit, Users, MessageCircle, Bell } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ReportTemplate } from '@/components/ReportTemplate';
import { useLanguage } from '@/components/LanguageProvider';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Intervention } from '@/types';

const openWhatsAppBusiness = (phone: string, text: string) => {
  const isAndroid = /Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  
  if (isAndroid) {
    window.open(`intent://send?phone=${phone}&text=${text}#Intent;package=com.whatsapp.w4b;scheme=whatsapp;end`, '_blank');
  } else if (isIOS) {
    window.open(`whatsapp-business://send?phone=${phone}&text=${text}`, '_blank');
  } else {
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  }
};

import Link from 'next/link';
export default function InterventionsClient() {
  const { t } = useLanguage();
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // PDF State
  const [pdfData, setPdfData] = useState<Intervention | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);

  // Search State
  const [searchTerm, setSearchTerm] = useState('');

  // Planning Modal State
  const [isPlanning, setIsPlanning] = useState(false);
  const [planForm, setPlanForm] = useState({
    clientName: '',
    clientAddress: '',
    clientContactName: '',
    clientContactPhone: '',
    technicianName: ''
  });
  const [planSubmitting, setPlanSubmitting] = useState(false);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Intervention> | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Technicians Management State
  const [isManagingTechs, setIsManagingTechs] = useState(false);
  const [techs, setTechs] = useState<{id: string; name: string; phone?: string}[]>([]);
  const [newTechName, setNewTechName] = useState('');
  const [newTechPassword, setNewTechPassword] = useState('');
  const [newTechPhone, setNewTechPhone] = useState('');
  const [techLoading, setTechLoading] = useState(false);
  const [editingTechId, setEditingTechId] = useState<string | null>(null);

  // Admin Auth State
  const [isAdminAuthed, setIsAdminAuthed] = useState(false);
  const forceLogout = useCallback(() => {
    localStorage.removeItem('adminToken');
    setIsAdminAuthed(false);
    window.location.reload();
  }, []);
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const fetchTechs = useCallback(async () => {
    try {
      const res = await fetch('/api/technicians', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) setTechs(json.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSubmitTech = async (e: React.FormEvent) => {
    e.preventDefault();
    setTechLoading(true);
    try {
      if (editingTechId) {
        const res = await fetch('/api/technicians', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTechId, name: newTechName, password: newTechPassword, phone: newTechPhone })
        });
        const json = await res.json();
        if (!json.success) {
          if (res.status === 401 || res.status === 403) return forceLogout();
          throw new Error(json.error || "Erreur lors de la modification");
        }
      } else {
        const res = await fetch('/api/technicians', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', name: newTechName, password: newTechPassword, phone: newTechPhone })
        });
        const json = await res.json();
        if (!json.success) {
          if (res.status === 401 || res.status === 403) return forceLogout();
          throw new Error(json.error || "Erreur lors de l'ajout");
        }
      }
      setNewTechName('');
      setNewTechPassword('');
      setNewTechPhone('');
      setEditingTechId(null);
      fetchTechs();
    } catch (e: unknown) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setTechLoading(false);
    }
  };

  const editTech = (tech: {id: string; name: string; phone?: string}) => {
    setEditingTechId(tech.id);
    setNewTechName(tech.name);
    setNewTechPassword(''); // Leave empty unless they want to change it
    setNewTechPhone(tech.phone || '');
  };

  const cancelEditTech = () => {
    setEditingTechId(null);
    setNewTechName('');
    setNewTechPassword('');
    setNewTechPhone('');
  };

  const deleteTech = async (id: string) => {
    if (!confirm('Voulez-vous supprimer ce technicien ?')) return;
    try {
      const res = await fetch(`/api/technicians?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) {
        if (res.status === 401 || res.status === 403) return forceLogout();
        throw new Error(json.error || "Erreur de suppression");
      }
      fetchTechs();
    } catch (e: unknown) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Erreur inconnue");
    }
  };



  const deleteIntervention = async (reference: string) => {
    if (!confirm('Voulez-vous vraiment supprimer cette intervention ?')) return;
    try {
      const res = await fetch(`/api/interventions?admin=true&reference=${reference}`, { method: 'DELETE' });
      if (res.ok) {
        fetchInterventions();
      } else {
        if (res.status === 401 || res.status === 403) return forceLogout();
        alert("Erreur lors de la suppression");
      }
    } catch (e) {
      console.error(e);
      alert("Erreur reseau");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditSubmitting(true);
    try {
      const res = await fetch('/api/interventions?admin=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([editForm])
      });
      if (res.ok) {
        setIsEditing(false);
        setEditForm(null);
        fetchInterventions();
      } else {
        if (res.status === 401 || res.status === 403) return forceLogout();
        alert("Erreur lors de la modification.");
      }
    } catch (error) {
      console.error("Error editing intervention", error);
      alert("Erreur reseau.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const fetchInterventions = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/interventions?admin=true', { cache: 'no-store' });
      
      if (res.status === 401) {
        forceLogout(); return;
      }

      // Robust error handling: Handle 504 timeouts and server errors correctly
      if (!res.ok) {
        let errorMsg = `Erreur HTTP: ${res.status}`;
        let rawText = '';
        try {
          rawText = await res.text();
          const errorData = JSON.parse(rawText);
          if (errorData.error) errorMsg = errorData.error;
        } catch {
          errorMsg = `Impossible de charger les interventions. (Status: ${res.status}, Body: ${rawText.substring(0, 50)})`;
        }
        
        if (res.status === 401 || errorMsg === 'Non autorise') {
          forceLogout(); return;
        }
        
        throw new Error(errorMsg);
      }

      const json = await res.json();
      if (json.success) {
        setInterventions(json.data);
      } else {
        if (json.error === 'Non autorise' || json.error === 'Non autorise') {
          forceLogout(); return;
        }
        throw new Error(json.error || "Erreur de chargement");
      }
    } catch (error: unknown) {
      console.error("Failed to fetch interventions:", error);
      setFetchError(error instanceof Error ? error.message : "Impossible de charger les interventions.");
    } finally {
      setLoading(false);
    }
  }, [forceLogout]);

  useEffect(() => {
    if (localStorage.getItem('adminToken') === 'dkclim-authed') {
      setIsAdminAuthed(true);
      fetchInterventions();
      fetchTechs();
    } else {
      setLoading(false);
    }
  }, [fetchInterventions, fetchTechs]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: authPassword })
      });
      const json = await res.json();
      if (json.success) {
        localStorage.setItem('adminToken', 'dkclim-authed');
        const returnTo = new URLSearchParams(window.location.search).get('next');
        if (returnTo?.startsWith('/') && !returnTo.startsWith('//')) {
          window.location.assign(returnTo);
          return;
        }
        setIsAdminAuthed(true);
        fetchInterventions();
        fetchTechs();
      } else {
        setAuthError('Mot de passe incorrect');
      }
    } catch (error) {
      console.error("Erreur login:", error);
      setAuthError('Erreur reseau');
    } finally {
      setAuthLoading(false);
    }
  };

  const filteredInterventions = React.useMemo(() => {
    return interventions.filter(item => {
      const term = searchTerm.toLowerCase();
      return (
        item.reference.toLowerCase().includes(term) ||
        item.clientName.toLowerCase().includes(term) ||
        item.technicianName.toLowerCase().includes(term)
      );
    });
  }, [interventions, searchTerm]);

  if (!isAdminAuthed) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-brand-50 dark:bg-brand-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-brand-600 dark:text-brand-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Admin DK CLIM</h1>
            <p className="text-slate-500 mt-2">Veuillez entrer le mot de passe</p>
          </div>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <input
                type="password"
                required
                placeholder="Mot de passe..."
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4 outline-none focus:ring-2 focus:ring-brand-500 transition"
              />
            </div>
            {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-4 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold shadow-md transition disabled:opacity-70 flex justify-center items-center"
            >
              {authLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const generatePDF = async (intervention: Intervention) => {
    setIsGenerating(intervention.reference);
    
    try {
      // Fetch full intervention data (with base64 images)
      const res = await fetch(`/api/interventions?admin=true&reference=${intervention.reference}&full=true`);
      const json = await res.json();
      
      if (!json.success || !json.data) {
        throw new Error("Failed to load full intervention data");
      }
      
      const fullIntervention = json.data;

      // Convert workDone back to array if it's a string
      const formattedData = {
        ...fullIntervention,
        workDone: typeof fullIntervention.workDone === 'string' ? JSON.parse(fullIntervention.workDone) : fullIntervention.workDone
      };

      setPdfData(formattedData);

    // Wait for React to render the hidden template
    await new Promise(resolve => setTimeout(resolve, 300));

    const rootElement = document.getElementById('pdf-report-admin')?.firstElementChild as HTMLElement;
    if (rootElement) {
        const sections = rootElement.querySelectorAll('.pdf-section');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        
        // 48px padding out of 794px = ~6% margin
        const marginX = (48 / 794) * pdfWidth; 
        const printWidth = pdfWidth - (2 * marginX);
        let currentY = marginX; // Top margin equal to side margin

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
          
          // Smart Page Break: If section doesn't fit on current page, add new page
          if (currentY + imgHeight > pageHeight - marginX && currentY > marginX) {
            pdf.addPage();
            currentY = marginX;
          }
          
          pdf.addImage(imgData, 'JPEG', marginX, currentY, printWidth, imgHeight);
          currentY += imgHeight;
          // Add a small gap between sections
          currentY += 6;
        }
        
        pdf.save(`Rapport_${intervention.reference}.pdf`);
    }
    } catch (err) {
      console.error("Erreur lors de la generation du PDF", err);
      alert("Erreur lors de la generation du PDF.");
    } finally {
      setPdfData(null);
      setIsGenerating(null);
    }
  };

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlanSubmitting(true);
    
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const reference = `INT-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${randomStr}`;
    const newIntervention = {
      ...planForm,
      reference,
      status: 'PLANIFIEE'
    };

    try {
      const res = await fetch('/api/interventions?admin=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([newIntervention]) // API expects an array
      });
      if (res.ok) {
        setIsPlanning(false);
        setPlanForm({ clientName: '', clientAddress: '', clientContactName: '', clientContactPhone: '', technicianName: '' });
        fetchInterventions();
      } else {
        if (res.status === 401 || res.status === 403) return forceLogout();
        alert("Erreur lors de la planification.");
      }
    } catch (error) {
      console.error("Error planning intervention", error);
      alert("Erreur lors de la planification.");
    } finally {
      setPlanSubmitting(false);
    }
  };

  const exportToExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const dataToExport = filteredInterventions.map(inv => ({
        Reference: inv.reference || '',
        Date: inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : '',
        Client: inv.clientName || '',
        'Adresse Client': inv.clientAddress || '',
        Technicien: inv.technicianName || '',
        Statut: inv.status || '',
        'Travaux Realises': typeof inv.workDone === 'string' ? inv.workDone : JSON.stringify(inv.workDone || '')
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Interventions");
      
      XLSX.writeFile(workbook, `Interventions_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
    } catch (error) {
      console.error("Error exporting to Excel", error);
      alert("Erreur lors de l'exportation vers Excel.");
    }
  };

  const getTechMessage = (item: Intervention) => {
    const dateString = new Date(item.createdAt).toLocaleDateString('fr-FR');
    const timeString = item.startTime || ' definir';
    const typeStr = item.type || 'Non specifie';
    const detailsStr = item.problemReported || 'Aucun detail supplementaire';
    return `[Bell] NOUVELLE INTERVENTION - DK CLIM\n\nBonjour ${item.technicianName} [Hi]\n\nUne nouvelle intervention est programmee :\n\n[Date] Date : ${dateString}\n Heure : ${timeString}\n[User] Client : ${item.clientName}\n[Phone] Telephone : ${item.clientContactPhone || 'Non specifie'}\n Adresse : ${item.clientAddress}\n\n[Tool] Intervention :\n${typeStr}\n\n Details :\n${detailsStr}\n\nMerci et bon travail [Strong]\n\nai DK CLIM`;
  };

  const getClientMessage = (item: Intervention) => {
    const dateString = new Date(item.createdAt).toLocaleDateString('fr-FR');
    const typeStr = item.type || 'Non specifie';
    return `Bonjour ${item.clientName} [Hi]\n\nNous vous informons que l'intervention de notre technicien ${item.technicianName} a bien ete effectuee le ${dateString}.\n\n[Tool] Type d'intervention : ${typeStr}\n[Doc] Rapport d'intervention : le compte rendu detaille de l'intervention est disponible en piece jointe.\n\nNous vous invitons a prendre connaissance du rapport et restons a votre disposition pour toute question ou information complementaire.\n\nMerci pour votre confiance \n\nai DK CLIM - Climatisation & Services\n[Phone] 0612-54-00-85\n[Email] dkclimatisation@gmail.com\n\nVotre confort, notre priorite.`;
  };

  const handleWhatsApp = (item: Intervention) => {
    const tech = techs.find(t => t.name === item.technicianName);
    if (!tech || !tech.phone) {
      alert("Ce technicien n'a pas de numero de telephone enregistre.");
      return;
    }
    let phone = tech.phone.replace(/\s+/g, '');
    if (!phone.startsWith('+')) {
      if (phone.startsWith('0')) {
        phone = '+212' + phone.substring(1);
      }
    }
    
    const message = getTechMessage(item);
    const encodedMessage = encodeURIComponent(message);
    openWhatsAppBusiness(phone, encodedMessage);
  };

  const handleWhatsAppClient = async (item: Intervention) => {
    let phone = item.clientContactPhone?.replace(/\s+/g, '') || '';
    
    if (!phone) {
      alert("Ce client n'a pas de numero de telephone enregistre.");
      return;
    }

    if (!phone.startsWith('+')) {
      if (phone.startsWith('0')) {
        phone = '+212' + phone.substring(1);
      } else {
        phone = '+212' + phone;
      }
    }
    
    const message = getClientMessage(item);
    const encodedMessage = encodeURIComponent(message);
    
    // Ouvre WhatsApp dans un nouvel onglet d'abord (pour eviter le blocage des pop-ups)
    openWhatsAppBusiness(phone, encodedMessage);
    
    // Puis genere et telecharge le PDF
    await generatePDF(item);
  };

  const handleTechReminder = (item: Intervention) => {
    const tech = techs.find(t => t.name === item.technicianName);
    if (!tech || !tech.phone) {
      alert("Ce technicien n'a pas de numero de telephone enregistre.");
      return;
    }
    let phone = tech.phone.replace(/\s+/g, '');
    if (!phone.startsWith('+')) {
      if (phone.startsWith('0')) {
        phone = '+212' + phone.substring(1);
      }
    }
    
    const timeString = item.startTime || 'a definir';
    const message = `[Bell] RAPPEL D'INTERVENTION [Bell]\n\nBonjour ${item.technicianName},\n\nCeci est un rappel pour votre intervention prevue.\n\n[Pin] Ref: ${item.reference}\n[User] Client: ${item.clientName}\na Heure: ${timeString}\n Adresse: ${item.clientAddress}\n\nMerci de confirmer la bonne reception.`;
    const encodedMessage = encodeURIComponent(message);
    openWhatsAppBusiness(phone, encodedMessage);
  };


  return (
    <>
      {/* Main Dashboard */}
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          <LanguageSwitcher />
            <Link href="/inventory" className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition font-medium text-sm">
              Gerer le Stock & Ventes
            </Link>
          <button 
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              forceLogout();
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition font-medium"
          >
            Deconnexion
          </button>
        </div>
        <div className="flex justify-between items-end bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
              <FileText className="w-8 h-8 text-brand-600" />
              {t('adminDashboard')}
            </h1>
            <p className="text-slate-500 mt-2">{t('adminDesc')}</p>
          </div>
          <div className="flex gap-3 flex-wrap justify-end mt-4 lg:mt-0">
            <button 
              onClick={() => setIsManagingTechs(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg transition font-medium h-[42px]"
            >
              <Users className="w-4 h-4" />
              Techniciens
            </button>
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition font-medium h-[42px]"
            >
              <Download className="w-4 h-4" />
              Excel
            </button>
            <button 
              onClick={() => setIsPlanning(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition font-medium h-[42px]"
            >
              <Plus className="w-4 h-4" />
              {t('plan')}
            </button>
            <button 
              onClick={fetchInterventions}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition font-medium h-[42px]"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm outline-none focus:ring-2 focus:ring-brand-500 transition"
          />
        </div>
        
        {fetchError && interventions.length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              <span>Derniere actualisation echouee: {fetchError}</span>
            </div>
            <button onClick={fetchInterventions} className="text-sm font-medium hover:underline">
              Reessayer
            </button>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{t('reference')}</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{t('client')}</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{t('technician')}</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{t('date')}</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{t('status')}</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300 text-right">{t('action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {loading && interventions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-500" />
                      {t('loading')}
                    </td>
                  </tr>
                ) : fetchError && interventions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-red-500">
                      <div className="flex flex-col items-center justify-center space-y-4">
                        <XCircle className="w-8 h-8 mx-auto text-red-500" />
                        <span className="font-semibold">{fetchError}</span>
                        <button onClick={fetchInterventions} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition">
                          Reessayer
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : interventions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      {t('noInterventions')}
                    </td>
                  </tr>
                ) : filteredInterventions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      {t('noResults')} &quot;{searchTerm}&quot;.
                    </td>
                  </tr>
                ) : (
                  filteredInterventions.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/80 transition group">
                      <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200">{item.reference}</td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{item.clientName}</p>
                        <p className="text-sm text-slate-500">{item.clientAddress}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{item.technicianName}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString('fr-FR', {
                          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4">
                        {item.status === 'REPORTEE' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                            Reportee
                          </span>
                        ) : item.status === 'ANNULEE' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            Annulee
                          </span>
                        ) : item.status === 'PLANIFIEE' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            {t('planned')}
                          </span>
                        ) : item.status === 'EN_COURS' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                            En cours
                          </span>
                        ) : item.finalStatus ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="w-3 h-3" /> {t('conform')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            <XCircle className="w-3 h-3" /> {t('nonConform')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {item.status === 'PLANIFIEE' && (
                            <button
                              onClick={() => handleTechReminder(item)}
                              className="p-2 text-slate-400 hover:text-amber-600 bg-slate-100 hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition"
                              title="Rappel Technicien (WhatsApp)"
                            >
                              <Bell className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleWhatsApp(item)}
                            className="p-2 text-slate-400 hover:text-green-600 bg-slate-100 hover:bg-green-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition"
                            title={`Envoyer au Technicien (WhatsApp)\n\nMessage prevu :\n${getTechMessage(item)}`}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditForm(item);
                              setIsEditing(true);
                            }}
                            className="p-2 text-slate-400 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition"
                            title="Modifier"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteIntervention(item.reference)}
                            className="p-2 text-slate-400 hover:text-red-600 bg-slate-100 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          {item.status === 'TERMINEE' && (
                            <>
                              <button
                                onClick={() => handleWhatsAppClient(item)}
                                disabled={isGenerating === item.reference}
                                className="p-2 bg-green-500 hover:bg-green-600 text-white shadow-sm rounded-lg transition disabled:opacity-70 disabled:cursor-not-allowed"
                                title={`Envoyer au Client (WhatsApp)\n\nMessage prevu :\n${getClientMessage(item)}`}
                              >
                                {isGenerating === item.reference ? <RefreshCw className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => generatePDF(item)}
                                disabled={isGenerating === item.reference}
                                className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg shadow-sm transition disabled:opacity-70 disabled:cursor-not-allowed"
                              >
                                {isGenerating === item.reference ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Download className="w-4 h-4" />
                                )}
                                PDF
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Hidden PDF Template Container */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
        {pdfData && (
          <div id="pdf-report-admin">
            <ReportTemplate data={pdfData} />
          </div>
        )}
      </div>

      {/* Planning Modal */}
      {isPlanning && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('planIntervention')}</h2>
              <button onClick={() => setIsPlanning(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handlePlanSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('clientName')}</label>
                <input required value={planForm.clientName} onChange={e => setPlanForm({...planForm, clientName: e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('address')}</label>
                <input required value={planForm.clientAddress} onChange={e => setPlanForm({...planForm, clientAddress: e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('contact')}</label>
                  <input value={planForm.clientContactName} onChange={e => setPlanForm({...planForm, clientContactName: e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('phone')}</label>
                  <input value={planForm.clientContactPhone} onChange={e => setPlanForm({...planForm, clientContactPhone: e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('assignedTo')}</label>
                <select required value={planForm.technicianName} onChange={e => setPlanForm({...planForm, technicianName: e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="" disabled>Selectionner un technicien</option>
                  {techs.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsPlanning(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition">
                  {t('cancel')}
                </button>
                <button type="submit" disabled={planSubmitting} className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium transition flex items-center justify-center gap-2">
                  {planSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : t('plan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditing && editForm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Modifier l&apos;intervention</h2>
              <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Infos Admin */}
              <h3 className="font-semibold text-slate-800 dark:text-white border-b pb-2">Informations Generales</h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('clientName')}</label>
                <input required value={editForm.clientName || ''} onChange={e => setEditForm({...editForm, clientName: e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('address')}</label>
                <input required value={editForm.clientAddress || ''} onChange={e => setEditForm({...editForm, clientAddress: e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('contact')}</label>
                  <input value={editForm.clientContactName || ''} onChange={e => setEditForm({...editForm, clientContactName: e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('phone')}</label>
                  <input value={editForm.clientContactPhone || ''} onChange={e => setEditForm({...editForm, clientContactPhone: e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('assignedTo')}</label>
                <select required value={editForm.technicianName || ''} onChange={e => setEditForm({...editForm, technicianName: e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="" disabled>Selectionner un technicien</option>
                  {editForm.technicianName && !techs.find(t => t.name === editForm.technicianName) && (
                    <option value={editForm.technicianName}>{editForm.technicianName} (Supprime)</option>
                  )}
                  {techs.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Statut de la visite</label>
                <select value={editForm.status || 'PLANIFIEE'} onChange={e => setEditForm({...editForm, status: e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="PLANIFIEE">Planifiee</option>
                  <option value="EN_COURS">En cours</option>
                  <option value="TERMINEE">Terminee</option>
                  <option value="REPORTEE">Reportee</option>
                  <option value="ANNULEE">Annulee</option>
                </select>
              </div>

              {/* Infos Technicien */}
              <h3 className="font-semibold text-slate-800 dark:text-white border-b pb-2 pt-4">Rapport Technicien</h3>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type d&apos;intervention</label>
                <select value={editForm.type || ''} onChange={e => setEditForm({...editForm, type: e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">Selectionner</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="DEPANNAGE">Depannage</option>
                  <option value="INSTALLATION">Installation</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Probleme signale</label>
                <textarea value={editForm.problemReported || ''} onChange={e => setEditForm({...editForm, problemReported: e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 outline-none focus:ring-2 focus:ring-brand-500" rows={2}></textarea>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Observations / Remarques</label>
                <textarea value={editForm.observations || ''} onChange={e => setEditForm({...editForm, observations: e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 outline-none focus:ring-2 focus:ring-brand-500" rows={3}></textarea>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Temperature soufflage ( degC)</label>
                  <input type="number" value={editForm.blowTemperature || ''} onChange={e => setEditForm({...editForm, blowTemperature: e.target.value})} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                {editForm.status === 'TERMINEE' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Statut Final</label>
                    <select value={editForm.finalStatus !== undefined ? (editForm.finalStatus ? 'true' : 'false') : ''} onChange={e => setEditForm({...editForm, finalStatus: e.target.value === 'true'})} className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 outline-none focus:ring-2 focus:ring-brand-500">
                      <option value="">Selectionner</option>
                      <option value="true">Conforme</option>
                      <option value="false">Non Conforme</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition">
                  {t('cancel')}
                </button>
                <button type="submit" disabled={editSubmitting} className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium transition flex items-center justify-center gap-2">
                  {editSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Techs Management Modal */}
      {isManagingTechs && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Gerer les techniciens</h2>
              <button onClick={() => setIsManagingTechs(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <form onSubmit={handleSubmitTech} className="flex gap-2 items-end mb-8 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 relative">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Nom du technicien</label>
                  <input required value={newTechName} onChange={e => setNewTechName(e.target.value)} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">{editingTechId ? 'Nouveau mot de passe' : 'Mot de passe'}</label>
                  <input required={!editingTechId} value={newTechPassword} onChange={e => setNewTechPassword(e.target.value)} placeholder={editingTechId ? '(Inchange)' : ''} className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Telephone</label>
                  <input value={newTechPhone} onChange={e => setNewTechPhone(e.target.value)} placeholder="06..." className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div className="flex gap-1">
                  <button type="submit" disabled={techLoading || !newTechName || (!editingTechId && !newTechPassword)} className={`px-4 py-2 text-white rounded-lg font-medium transition disabled:opacity-50 flex items-center justify-center h-[42px] ${editingTechId ? 'bg-green-600 hover:bg-green-700' : 'bg-brand-600 hover:bg-brand-700'}`}>
                    {techLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : (editingTechId ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />)}
                  </button>
                  {editingTechId && (
                    <button type="button" onClick={cancelEditTech} className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-lg transition flex items-center justify-center h-[42px]" title="Annuler">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </form>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Liste des techniciens ({techs.length})</h3>
                {techs.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">Aucun technicien pour le moment.</p>
                ) : (
                  techs.map(tech => (
                    <div key={tech.id} className={`flex justify-between items-center p-3 rounded-lg border transition ${editingTechId === tech.id ? 'border-brand-500 bg-brand-50' : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                      <span className="font-medium text-slate-700 dark:text-slate-200">{tech.name}</span>
                      <div className="flex gap-1">
                        <button onClick={() => editTech(tech)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg transition" title="Modifier">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteTech(tech.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg transition" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

        {/* INJECTED INVENTORY UI */}
        <div className="max-w-7xl mx-auto mt-12">
          
        </div>
      </div>
    </>
  );
}



