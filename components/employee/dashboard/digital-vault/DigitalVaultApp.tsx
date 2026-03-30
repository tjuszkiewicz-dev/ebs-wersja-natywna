import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, File, Upload, Trash2, Search, Settings, 
  ChevronRight, HardDrive, Shield, Lock, Activity, 
  X, Grid, List as ListIcon, Plus, Info, CheckCircle, AlertTriangle 
} from 'lucide-react';
import { VaultFile } from './types';
import { getStoredFiles, saveStoredFiles, formatBytes, TOTAL_SPACE, getFileIcon } from './utils';

interface DigitalVaultAppProps {
  onClose: () => void;
  subscriptionActive?: boolean;
}

export const DigitalVaultApp: React.FC<DigitalVaultAppProps> = ({ onClose, subscriptionActive = true }) => {
  const [currentPath, setCurrentPath] = useState<VaultFile[]>([]); // Trail of folder objects
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    // Load initial files
    const stored = getStoredFiles();
    setFiles(stored);
  }, []);

  const totalUsedSpace = files.reduce((acc, file) => acc + (file.size || 0), 0);
  const percentUsed = (totalUsedSpace / TOTAL_SPACE) * 100;

  const currentFolderId = currentPath.length > 0 ? currentPath[currentPath.length - 1].id : null;
  const currentFolderFiles = files.filter(f => f.parentId === currentFolderId && (
     f.name.toLowerCase().includes(searchQuery.toLowerCase())
  ));

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (uploadedFiles) processFiles(Array.from(uploadedFiles));
  };

  const processFiles = (fileList: File[]) => {
      setUploadProgress(0);
      
      const newFiles: VaultFile[] = [];
      let currentProgress = 0;

      fileList.forEach((file, index) => {
          if (file.size > 100 * 1024 * 1024) {
              alert(`Plik ${file.name} przekracza limit 100MB.`);
              return;
          }
          if (totalUsedSpace + file.size > TOTAL_SPACE) {
              alert(`Brak miejsca na dysku dla pliku ${file.name}.`);
              return;
          }

          // Mock upload delay
          setTimeout(() => {
              setUploadProgress(((index + 1) / fileList.length) * 100);
              if (index === fileList.length - 1) setTimeout(() => setUploadProgress(null), 500);
          }, 500 * (index + 1));

          const newFile: VaultFile = {
              id: Date.now().toString() + Math.random(),
              name: file.name,
              type: 'file',
              size: file.size,
              parentId: currentFolderId,
              createdAt: Date.now(),
              extension: file.name.split('.').pop()
          };
          newFiles.push(newFile);
      });

      // Update state after "upload"
      setTimeout(() => {
        const updated = [...files, ...newFiles];
        setFiles(updated);
        saveStoredFiles(updated);
      }, 500 * fileList.length);
  };

  const handleCreateFolder = () => {
      const name = prompt("Podaj nazwę nowego folderu:");
      if (!name) return;
      
      const newFolder: VaultFile = {
          id: Date.now().toString(),
          name: name,
          type: 'folder',
          parentId: currentFolderId,
          createdAt: Date.now()
      };
      
      const updated = [...files, newFolder];
      setFiles(updated);
      saveStoredFiles(updated);
  };

  const handleDelete = (id: string) => {
      if (!confirm("Czy na pewno chcesz usunąć ten element? Operacja jest nieodwracalna.")) return;
      
      // Recursive delete logic would be needed for folders in real app, here simple
      const updated = files.filter(f => f.id !== id);
      setFiles(updated);
      saveStoredFiles(updated);
  };

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };


  return (
    <div className="flex flex-col h-full bg-[#f8fafc] animate-in fade-in duration-300 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col flex-shrink-0">
            <div className="p-6 border-b border-slate-100">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-lg mb-1">
                    <Shield className="w-6 h-6 text-indigo-600" />
                    Secure Vault
                </div>
                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    AES-256-CBC Encrypted
                </div>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                <button 
                    onClick={() => setCurrentPath([])}
                    className={`nav-item w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 text-sm font-medium transition-colors ${currentPath.length === 0 ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <HardDrive className="w-4 h-4" />
                    Mój Sejf
                </button>
                <div className="pt-4 pb-2 px-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Foldery</div>
                {files.filter(f => f.type === 'folder' && f.parentId === null).map(folder => (
                    <button 
                        key={folder.id}
                        onClick={() => {
                            setCurrentPath([folder]);
                        }}
                        className={`nav-item w-full text-left px-3 py-2 rounded-lg flex items-center gap-3 text-sm transition-colors ${currentFolderId === folder.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Folder className="w-4 h-4 fill-indigo-100 text-indigo-400" />
                        {folder.name}
                    </button>
                ))}
            </nav>
            
            {/* Storage Meter */}
            <div className="p-6 bg-slate-50 border-t border-slate-200">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Pojemność</span>
                    <span className="text-xs font-bold text-indigo-600">{percentUsed.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 mb-2 overflow-hidden">
                    <div 
                        className="bg-indigo-500 h-2 rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: `${Math.max(2, percentUsed)}%` }}
                    ></div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                    <span>{formatBytes(totalUsedSpace)}</span>
                    <span>10 GB</span>
                </div>
                
                {/* Subscription Status */}
                <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-3 h-3 text-emerald-500" />
                        <span className="text-xs font-bold text-slate-700">Subskrypcja Aktywna</span>
                    </div>
                    <p className="text-[10px] text-slate-400">Następna płatność: 50 pkt (za 12 dni)</p>
                </div>
            </div>
        </aside>

        {/* Main Content */}
        <main 
            className="flex-1 flex flex-col bg-slate-50 relative"
            onDragEnter={handleDrag} 
            onDragLeave={handleDrag} 
            onDragOver={handleDrag} 
            onDrop={handleDrop}
        >   
            {/* Drag Overlay */}
            {dragActive && (
                <div className="absolute inset-0 bg-indigo-500/10 z-50 border-4 border-indigo-500 border-dashed m-4 rounded-xl flex items-center justify-center backdrop-blur-sm transition-all pointer-events-none">
                    <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center animate-bounce">
                        <Upload className="w-16 h-16 text-indigo-500 mb-4" />
                        <h3 className="text-xl font-bold text-indigo-800">Upuść pliki tutaj</h3>
                        <p className="text-indigo-400 text-sm">Zostaną zaszyfrowane i dodane do sejfu</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm z-20">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setCurrentPath([])}
                        className={`p-2 rounded hover:bg-slate-100 text-slate-500 ${currentPath.length === 0 ? 'text-indigo-900 font-bold' : ''}`}
                    >
                        <HardDrive className="w-5 h-5" />
                    </button>
                    {currentPath.map((folder, index) => (
                        <React.Fragment key={folder.id}>
                            <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                            <button 
                                onClick={() => setCurrentPath(currentPath.slice(0, index + 1))}
                                className={`px-2 py-1 rounded hover:bg-slate-100 text-sm whitespace-nowrap ${index === currentPath.length - 1 ? 'font-bold text-slate-800' : 'text-slate-500'}`}
                            >
                                {folder.name}
                            </button>
                        </React.Fragment>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative hidden sm:block">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                            type="text" 
                            placeholder="Szukaj w sejfie..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 w-64 transition-all"
                        />
                    </div>
                    
                    <div className="h-6 w-px bg-slate-200 mx-1"></div>

                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <Grid className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <ListIcon className="w-4 h-4" />
                        </button>
                    </div>

                    <button 
                        onClick={onClose}
                        className="ml-2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Toolbar */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
                <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm hover:shadow active:translate-y-0.5">
                    <Upload className="w-4 h-4" />
                    <span>Wgraj plik</span>
                    <input type="file" className="hidden" multiple onChange={handleFileUpload} />
                </label>
                
                <button 
                    onClick={handleCreateFolder}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-medium text-sm transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    <span>Nowy folder</span>
                </button>

                {uploadProgress !== null && (
                    <div className="ml-auto w-48 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                         <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                )}
            </div>

            {/* File View */}
            <div className="flex-1 overflow-y-auto p-6">
                {currentFolderFiles.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 pb-20 pointer-events-none">
                        <div className="w-24 h-24 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                            <Folder className="w-10 h-10 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-600">Ten folder jest pusty</h3>
                        <p className="text-sm">Przeciągnij pliki tutaj lub użyj przycisku Wgraj</p>
                    </div>
                ) : (
                    <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4' : 'flex flex-col gap-2'}>
                        {currentFolderFiles.map(file => (
                            <div 
                                key={file.id}
                                className={`group relative cursor-pointer border rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md ${
                                    viewMode === 'grid' 
                                        ? 'bg-white p-4 flex flex-col items-center text-center aspect-[4/5] justify-between border-slate-200 hover:border-indigo-300' 
                                        : 'bg-white p-3 flex items-center gap-4 border-slate-200 hover:border-indigo-300'
                                }`}
                                onClick={() => {
                                    if (file.type === 'folder') {
                                        setCurrentPath([...currentPath, file]);
                                    }
                                }}
                            >
                                <div className={`relative flex items-center justify-center ${viewMode === 'grid' ? 'w-16 h-16 mb-3' : 'w-10 h-10'}`}>
                                    {file.type === 'folder' ? (
                                        <Folder className={`${viewMode === 'grid' ? 'w-16 h-16' : 'w-10 h-10'} text-amber-400 fill-amber-100`} />
                                    ) : (
                                        <File className={`${viewMode === 'grid' ? 'w-12 h-12' : 'w-8 h-8'} text-slate-400`} />
                                    )}
                                    
                                    {/* Encrypted Badge */}
                                    {file.type === 'file' && (
                                        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-slate-100" title="AES-256 Encrypted">
                                            <Shield className="w-3 h-3 text-emerald-500 fill-emerald-100" />
                                        </div>
                                    )}
                                </div>

                                <div className={`min-w-0 ${viewMode === 'grid' ? 'w-full' : 'flex-1'}`}>
                                    <h4 className="text-sm font-medium text-slate-700 truncate" title={file.name}>{file.name}</h4>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        {file.type === 'file' ? formatBytes(file.size || 0) : 'Folder'} • {new Date(file.createdAt).toLocaleDateString()}
                                    </p>
                                </div>

                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDelete(file.id); }}
                                    className={`text-slate-300 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50 ${viewMode === 'grid' ? 'absolute top-2 right-2 opacity-0 group-hover:opacity-100' : ''}`}
                                    title="Usuń (trwale)"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer Status Bar */}
            <footer className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex justify-between items-center text-[10px] text-slate-400 font-mono">
                <div className="flex gap-4">
                    <span>STATUS: ONLINE</span>
                    <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> ENCRYPTION: AES-256-CBC</span>
                    <span>SERVER: WAW-SECURE-01</span>
                </div>
                <div>
                   {files.length} elementów
                </div>
            </footer>
        </main>
      </div>
    </div>
  );
};
