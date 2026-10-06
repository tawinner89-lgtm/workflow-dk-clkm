/* eslint-disable */
import React from 'react';
import { InterventionDraft } from '@/lib/db';
import { useLanguage } from './LanguageProvider';

interface ReportTemplateProps {
  data: Partial<InterventionDraft> & any;
}

export const ReportTemplate: React.FC<ReportTemplateProps> = ({ data }) => {
  const { t } = useLanguage();

  return (
    <div 
      id="pdf-report" 
      className="bg-white text-slate-800 p-12 mx-auto"
      style={{ width: '794px', minHeight: '1123px', position: 'absolute', left: '-9999px', top: '-9999px' }}
    >
      {/* Header */}
      <div className="pdf-section bg-white flex justify-between items-start border-b-4 border-brand-600 pb-6 mb-8">
        <div>
          <h1 className="text-4xl font-black text-brand-700 tracking-tighter">DK CLIM</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Expertise Climatisation & Maintenance</p>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-slate-800">{t('interventionReport')}</h2>
          <p className="text-slate-600 font-medium mt-1">{t('ref')}: {data.reference || 'Brouillon'}</p>
          <p className="text-slate-600">{t('date')}: {new Date().toLocaleDateString('fr-FR')}</p>
        </div>
      </div>

      <div className="pdf-section bg-white grid grid-cols-2 gap-8 mb-8">
        {/* Client Info */}
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
          <h3 className="text-lg font-bold text-brand-700 mb-3 border-b border-slate-200 pb-2">{t('clientInfo')}</h3>
          <div className="space-y-2">
            <p><span className="text-slate-500 font-medium">{t('clientName')} :</span> <span className="font-semibold">{data.clientName}</span></p>
            <p><span className="text-slate-500 font-medium">{t('address')} :</span> <span className="font-semibold">{data.clientAddress}</span></p>
            <p><span className="text-slate-500 font-medium">{t('contact')} :</span> <span className="font-semibold">{data.clientContactName || '-'} ({data.clientContactPhone || '-'})</span></p>
          </div>
        </div>

        {/* Intervention Info */}
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
          <div className="flex justify-between items-start mb-3 border-b border-slate-200 pb-2">
            <h3 className="text-lg font-bold text-brand-700">{t('interventionDetails')}</h3>
            <div className={`text-xs px-2 py-1 rounded-md font-bold border ${data.finalStatus ? 'text-green-700 border-green-600 bg-green-100' : 'text-red-700 border-red-600 bg-red-100'}`}>
              {data.finalStatus ? 'CONFORME' : 'NON CONFORME'}
            </div>
          </div>
          <div className="space-y-2">
            <p><span className="text-slate-500 font-medium">{t('technician')} :</span> <span className="font-semibold">{data.technicianName}</span></p>
            <p><span className="text-slate-500 font-medium">Type :</span> <span className="font-semibold">{data.type || '-'}</span></p>
            <p><span className="text-slate-500 font-medium">{t('horaires')} :</span> <span className="font-semibold">{data.startTime || '-'} à {data.endTime || '-'}</span></p>
          </div>
        </div>
      </div>

      {/* Work Done */}
      <div className="pdf-section bg-white mb-8">
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b-2 border-brand-200 pb-2">{t('workDone')}</h3>
        
        {data.problemReported && (
          <div className="mb-5 bg-slate-50 p-4 rounded-lg border border-slate-100">
            <h4 className="font-semibold text-slate-700 text-sm mb-1">{t('problemReported')} :</h4>
            <p className="text-slate-800">{data.problemReported}</p>
          </div>
        )}

        <div className="mb-5">
          <h4 className="font-semibold text-slate-700 mb-2">{t('actions')} :</h4>
          {(data.workDone && data.workDone.length > 0) || data.workDoneOther ? (
            <ul className="list-disc pl-5 bg-slate-50 p-4 rounded-lg border border-slate-100 text-slate-700 space-y-1">
              {data.workDone?.map((work: string, i: number) => (
                <li key={i}>{work}</li>
              ))}
              {data.workDoneOther && <li>{t('other')}: {data.workDoneOther}</li>}
            </ul>
          ) : (
             <p className="text-slate-500 italic bg-slate-50 p-4 rounded-lg border border-slate-100 text-sm">Aucune action spécifiée.</p>
          )}
        </div>

        {data.materialsUsed && (
          <div className="mb-5 bg-slate-50 p-4 rounded-lg border border-slate-100">
            <h4 className="font-semibold text-slate-700 text-sm mb-1">{t('materials')} :</h4>
            <p className="text-slate-800">{data.materialsUsed}</p>
          </div>
        )}
      </div>

      {/* Measurements & Tests */}
      <div className="pdf-section bg-white mb-8">
        <h3 className="text-xl font-bold text-slate-800 mb-4 border-b-2 border-brand-200 pb-2">{t('controlsMeasurements')}</h3>
        <div className="flex gap-6">
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex-1 text-center">
            <span className="block text-sm text-slate-500 mb-1">{t('blowTemp')}</span>
            <span className="font-bold text-xl text-slate-800">{data.blowTemperature ? `${data.blowTemperature} °C` : 'N/A'}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex-1 text-center">
            <span className="block text-sm text-slate-500 mb-1">{t('funcTest')}</span>
            <span className={`font-bold text-xl ${data.functioningTest ? 'text-green-600' : 'text-red-600'}`}>
              {data.functioningTest ? t('conform') : t('nonConform')}
            </span>
          </div>
        </div>
      </div>

      {/* Photos */}
      {(data.photoBeforeUrl || data.photoAfterUrl) && (
        <div className="pdf-section bg-white mb-8" style={{ pageBreakInside: 'avoid' }}>
          <h3 className="text-xl font-bold text-slate-800 mb-4 border-b-2 border-brand-200 pb-2">{t('photoDocs')}</h3>
          <div className="flex gap-8 justify-center">
            {data.photoBeforeUrl && (
              <div className="text-center w-1/2">
                <p className="font-medium text-slate-600 mb-2 text-sm">{t('beforeIntervention')}</p>
                <div className="h-48 rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm">
                  <img src={data.photoBeforeUrl} alt="Avant" className="w-full h-full object-cover" />
                </div>
              </div>
            )}
            {data.photoAfterUrl && (
              <div className="text-center w-1/2">
                <p className="font-medium text-slate-600 mb-2 text-sm">{t('afterIntervention')}</p>
                <div className="h-48 rounded-xl overflow-hidden border-2 border-slate-200 shadow-sm">
                  <img src={data.photoAfterUrl} alt="Après" className="w-full h-full object-cover" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Observations */}
      {data.observations && (
        <div className="pdf-section bg-white mb-8" style={{ pageBreakInside: 'avoid' }}>
          <h3 className="text-xl font-bold text-slate-800 mb-4 border-b-2 border-brand-200 pb-2">{t('observationsTitle')}</h3>
          <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl">
            <p className="text-slate-800 italic leading-relaxed">"{data.observations}"</p>
          </div>
        </div>
      )}

      {/* Signatures */}
      <div className="pdf-section bg-white mt-8 pt-8 border-t border-slate-300 pb-12" style={{ pageBreakInside: 'avoid' }}>
        <h3 className="text-lg font-bold text-slate-800 mb-10 text-center uppercase tracking-wider">{t('interventionValidation')}</h3>
        <div className="flex justify-around items-end px-12">
          
          {/* Tech Signature */}
          <div className="text-center w-[40%]">
            <p className="font-semibold text-slate-700 mb-4">{t('theTechnician')}</p>
            <div className={`h-28 flex flex-col justify-end pb-2 mb-4 ${!data.signatureTechUrl ? 'border-b-2 border-dashed border-slate-400' : ''}`}>
              {data.signatureTechUrl ? (
                <img src={data.signatureTechUrl} alt="Signature Tech" className="h-full object-contain mx-auto mix-blend-multiply" />
              ) : (
                <span className="text-slate-300 text-sm italic mb-2">Signature absente</span>
              )}
            </div>
            <p className="font-bold text-slate-800 text-lg">{data.technicianName}</p>
          </div>

          {/* Client Signature */}
          <div className="text-center w-[40%]">
            <p className="font-semibold text-slate-700 mb-4">{t('theClient')}</p>
            <div className={`h-28 flex flex-col justify-end pb-2 mb-4 ${!data.signatureClientUrl ? 'border-b-2 border-dashed border-slate-400' : ''}`}>
              {data.signatureClientUrl ? (
                <img src={data.signatureClientUrl} alt="Signature Client" className="h-full object-contain mx-auto mix-blend-multiply" />
              ) : (
                <span className="text-slate-300 text-sm italic mb-2">Signature absente</span>
              )}
            </div>
            <p className="font-bold text-slate-800 text-lg">{data.clientName}</p>
          </div>

        </div>
      </div>
      
      {/* Footer */}
      <div className="pdf-section bg-white text-center text-sm font-medium text-slate-400 py-8">
        <p>DK CLIM — {t('generatedReport')} — {new Date().getFullYear()}</p>
      </div>
    </div>
  );
};
