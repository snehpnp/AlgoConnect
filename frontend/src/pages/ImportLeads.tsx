import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { UploadCloud, FileSpreadsheet, ArrowLeft, CheckCircle2, Loader2, Target, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { leadsService } from '../services/leads.service';

export const ImportLeads = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<any>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  
  const [entityType, setEntityType] = useState('Research Analyst (RA)');
  const [importStatus, setImportStatus] = useState<{ success?: boolean; message?: string; count?: number } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    const validExtensions = ['.xls', '.xlsx', '.csv'];
    const extension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(extension)) {
      toast.error('Please upload a valid Excel or CSV file.');
      return;
    }

    setFile(selectedFile);
    processFileHeaders(selectedFile);
  };

  const processFileHeaders = async (uploadedFile: File) => {
    setIsProcessing(true);
    setImportStatus(null);
    try {
      // For massive files, we only slice the first 2MB to extract headers and preview data
      const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
      const blob = uploadedFile.slice(0, Math.min(CHUNK_SIZE, uploadedFile.size));
      const data = await blob.arrayBuffer();
      
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      let headerRowIndex = -1;
      let extractedHeaders: string[] = [];
      
      for (let i = 0; i < Math.min(rawJson.length, 20); i++) {
        const row = rawJson[i];
        if (!row) continue;
        const rowStrings = row.map(col => String(col || '').trim().toLowerCase());
        if (rowStrings.some(c => c.includes('name') || c.includes('email') || c.includes('registration') || c.includes('city'))) {
          headerRowIndex = i;
          extractedHeaders = row.map(col => String(col || '').trim());
          break;
        }
      }

      if (headerRowIndex === -1 || extractedHeaders.length === 0) {
        throw new Error("Could not find a valid header row in the file.");
      }

      setHeaders(extractedHeaders);

      const findColumn = (possibleNames: string[]) => {
        const idx = extractedHeaders.findIndex(h => h && possibleNames.some(p => String(h).toLowerCase().includes(p.toLowerCase())));
        return idx !== -1 ? idx : undefined;
      };

      const mapObj = {
        nameCol: findColumn(['name of entity', 'name', 'company name', 'broker name']),
        regNoCol: findColumn(['registration no', 'sebi reg no', 'reg no']),
        contactPersonCol: findColumn(['contact person', 'principal officer', 'director']),
        emailCol: findColumn(['email-id', 'email', 'e-mail']),
        phoneCol: findColumn(['telephone', 'phone', 'mobile', 'contact no']),
        cityCol: findColumn(['city', 'district']),
        stateCol: findColumn(['state']),
        pincodeCol: findColumn(['pincode', 'pin code', 'zip']),
        addressCol: findColumn(['correspondence address', 'address']),
        faxCol: findColumn(['fax']),
        validityCol: findColumn(['validity']),
        exchangeNameCol: findColumn(['exchange name', 'exchange']),
        tradeNameCol: findColumn(['trade name']),
      };

      setMappings(mapObj);

      // Extract some preview rows
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex });
      
      const preview = jsonData.map((row: any) => {
        const getVal = (colName?: string) => colName && row[colName] ? String(row[colName]) : undefined;
        
        return {
          name: mapObj.nameCol !== undefined ? getVal(extractedHeaders[mapObj.nameCol]) : 'Unknown Entity',
          registrationNo: mapObj.regNoCol !== undefined ? getVal(extractedHeaders[mapObj.regNoCol]) : undefined,
          contactPerson: mapObj.contactPersonCol !== undefined ? getVal(extractedHeaders[mapObj.contactPersonCol]) : undefined,
          email: mapObj.emailCol !== undefined ? getVal(extractedHeaders[mapObj.emailCol]) : undefined,
          phone: mapObj.phoneCol !== undefined ? getVal(extractedHeaders[mapObj.phoneCol]) : undefined,
          city: mapObj.cityCol !== undefined ? getVal(extractedHeaders[mapObj.cityCol]) : undefined,
          state: mapObj.stateCol !== undefined ? getVal(extractedHeaders[mapObj.stateCol]) : undefined,
          pincode: mapObj.pincodeCol !== undefined ? getVal(extractedHeaders[mapObj.pincodeCol]) : undefined,
          address: mapObj.addressCol !== undefined ? getVal(extractedHeaders[mapObj.addressCol]) : undefined,
          fax: mapObj.faxCol !== undefined ? getVal(extractedHeaders[mapObj.faxCol]) : undefined,
          validity: mapObj.validityCol !== undefined ? getVal(extractedHeaders[mapObj.validityCol]) : undefined,
          exchangeName: mapObj.exchangeNameCol !== undefined ? getVal(extractedHeaders[mapObj.exchangeNameCol]) : undefined,
          tradeName: mapObj.tradeNameCol !== undefined ? getVal(extractedHeaders[mapObj.tradeNameCol]) : undefined,
        };
      }).filter(lead => lead.name && lead.name !== 'Unknown Entity');

      setPreviewRows(preview);
    } catch (error: any) {
      toast.error(error.message || 'Error parsing headers');
      setFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!file || !mappings) return;
    setIsImporting(true);
    setUploadProgress(0);

    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    // Create a unique filename for this upload session
    const uniqueFilename = `${Date.now()}_${file.name}`;

    try {
      // 1. Upload in chunks
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);
        formData.append('filename', uniqueFilename);
        formData.append('chunkIndex', String(chunkIndex));
        formData.append('totalChunks', String(totalChunks));

        await leadsService.uploadChunk(formData);
        
        // Update progress (Upload phase is 50% of the work)
        const progress = Math.round(((chunkIndex + 1) / totalChunks) * 50);
        setUploadProgress(progress);
      }

      // 2. Trigger server-side processing
      setUploadProgress(75); // Processing phase
      const res = await leadsService.processFile({
        filename: uniqueFilename,
        entityType,
        mappings
      });

      setUploadProgress(100);
      setImportStatus({ success: true, message: 'Leads imported successfully!', count: res.count });
      toast.success(`Successfully processed and imported ${res.count} leads!`);
      
      setTimeout(() => {
        navigate('/leads');
      }, 2000);

    } catch (error: any) {
      toast.error('Failed to upload or process file. Check console.');
      setImportStatus({ success: false, message: 'Failed to import leads.' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="relative flex flex-col gap-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col gap-2">
        <button 
          onClick={() => navigate('/leads')}
          className="flex items-center gap-1.5 text-sm font-semibold text-[#64748B] hover:text-[#0F172A] w-fit transition-colors mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Leads
        </button>
        <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-emerald-500" />
          Streaming Excel Import (1GB+)
        </h1>
        <p className="text-[#64748B] text-sm">
          Upload massive SEBI/NSE lists (XLS, XLSX, CSV). The system automatically chunks the file and streams it directly to the database without crashing your browser.
        </p>
      </div>

      {!file && (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-12 text-center hover:bg-slate-50 transition-colors">
          <UploadCloud className="mx-auto h-16 w-16 text-[#94A3B8] mb-4" />
          <h3 className="text-lg font-bold text-[#0F172A] mb-2">Upload Massive File</h3>
          <p className="text-sm text-[#64748B] mb-6">Files up to 1GB are fully supported. We slice the file into 5MB chunks and stream it.</p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload}
            accept=".xls,.xlsx,.csv" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-600 transition-colors"
          >
            Select Huge File
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-[#E2E8F0] shadow-sm">
          <Loader2 className="h-10 w-10 text-emerald-500 animate-spin mb-4" />
          <p className="text-sm font-bold text-[#0F172A]">Analyzing file headers...</p>
        </div>
      )}

      {file && !isProcessing && previewRows.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-red-200 shadow-sm">
          <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
          <h3 className="text-lg font-bold text-[#0F172A] mb-2">No Valid Leads Found</h3>
          <p className="text-sm text-[#64748B] text-center mb-6 max-w-md">
            We couldn't find any rows containing a valid Entity Name. Please make sure the Excel file has proper column headers like "Name", "Registration No", etc.
          </p>
          <button 
            onClick={() => { setFile(null); setPreviewRows([]); setImportStatus(null); }}
            className="inline-flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-white px-6 py-2.5 text-sm font-bold text-[#0F172A] shadow-sm hover:bg-slate-50 transition-colors"
          >
            Upload a different file
          </button>
        </div>
      )}

      {file && !isProcessing && previewRows.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left: Configuration */}
            <div className="w-full md:w-1/3 space-y-4">
              <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2 mb-4">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  File Ready for Streaming
                </h3>
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg mb-4">
                  <p className="text-xs font-bold text-emerald-700 break-all">{file.name}</p>
                  <p className="text-xs font-semibold text-emerald-600 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB • Unlimited Leads</p>
                </div>
                
                <hr className="my-4 border-[#E2E8F0]" />
                
                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2 mb-4">
                  <Target className="h-5 w-5 text-blue-500" />
                  Targeting Configuration
                </h3>
                <label className="block text-xs font-bold text-[#64748B] uppercase tracking-wider mb-2">Entity Type for all rows</label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all"
                >
                  <option value="Research Analyst (RA)">Research Analyst (RA)</option>
                  <option value="Investment Advisor (IA)">Investment Advisor (IA)</option>
                  <option value="Sub Broker">Sub Broker</option>
                  <option value="Manual">General / Unknown</option>
                </select>
                <p className="text-[11px] text-[#64748B] mt-2">
                  This allows you to filter these leads efficiently in Segments later.
                </p>
                
                <div className="mt-8">
                  {isImporting && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs font-bold text-[#0F172A] mb-1">
                        <span>{uploadProgress < 50 ? 'Uploading file chunks...' : 'Server processing data...'}</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-300" 
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {importStatus ? (
                    importStatus.success ? (
                      <div className="bg-emerald-500 text-white rounded-lg p-3 text-center text-sm font-bold flex items-center justify-center gap-2">
                        <CheckCircle2 className="h-5 w-5" />
                        {importStatus.message}
                      </div>
                    ) : (
                      <div className="bg-red-500 text-white rounded-lg p-3 text-center text-sm font-bold flex items-center justify-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        {importStatus.message}
                      </div>
                    )
                  ) : (
                    <button
                      onClick={handleImport}
                      disabled={isImporting}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                      {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                      {isImporting ? 'Streaming...' : `Start Chunked Import`}
                    </button>
                  )}
                  <button
                    onClick={() => { setFile(null); setPreviewRows([]); setImportStatus(null); }}
                    disabled={isImporting}
                    className="w-full mt-3 rounded-lg border border-[#E2E8F0] px-4 py-3 text-sm font-bold text-[#64748B] hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Cancel & Upload Different File
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Data Preview */}
            <div className="w-full md:w-2/3">
              <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden flex flex-col h-full max-h-[600px]">
                <div className="border-b border-[#E2E8F0] p-4 bg-[#F8FAFC]">
                  <h3 className="text-sm font-bold text-[#0F172A]">Sample Data Preview</h3>
                  <p className="text-xs text-[#64748B] mt-0.5">We extracted headers from the first 2MB chunk to verify mapping.</p>
                </div>
                <div className="overflow-auto flex-1 p-0">
                  <table className="w-full text-left whitespace-nowrap">
                    <thead className="bg-white sticky top-0 border-b border-[#E2E8F0] shadow-sm z-10">
                      <tr>
                        <th className="py-3 px-4 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Entity Name</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Reg No</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Contact Person</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Email</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Phone / Fax</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">State / City / Pin</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Validity</th>
                        <th className="py-3 px-4 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Exchange / Trade Name</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {previewRows.slice(0, 50).map((lead, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 text-xs font-semibold text-[#0F172A] truncate max-w-[150px]" title={lead.name}>{lead.name}</td>
                          <td className="py-2.5 px-4 text-xs text-slate-600">{lead.registrationNo || '-'}</td>
                          <td className="py-2.5 px-4 text-xs text-slate-600 truncate max-w-[120px]" title={lead.contactPerson || ''}>{lead.contactPerson || '-'}</td>
                          <td className="py-2.5 px-4 text-xs text-slate-600 truncate max-w-[120px]" title={lead.email || ''}>{lead.email || '-'}</td>
                          <td className="py-2.5 px-4 text-xs text-slate-600">
                            <div>{lead.phone || '-'}</div>
                            {lead.fax && <div className="text-[10px] text-slate-400 mt-0.5">Fax: {lead.fax}</div>}
                          </td>
                          <td className="py-2.5 px-4 text-xs">
                            <div className="font-medium text-emerald-600">{lead.state || '-'}</div>
                            <div className="text-[10px] text-blue-600 mt-0.5">{lead.city || '-'} {lead.pincode ? `(${lead.pincode})` : ''}</div>
                          </td>
                          <td className="py-2.5 px-4 text-xs text-slate-600">{lead.validity || '-'}</td>
                          <td className="py-2.5 px-4 text-xs text-slate-600">
                            <div>{lead.exchangeName || '-'}</div>
                            {lead.tradeName && <div className="text-[10px] text-slate-400 mt-0.5">{lead.tradeName}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
};
