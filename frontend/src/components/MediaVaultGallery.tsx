/* eslint-disable */
'use client';

import React, { useState, useEffect } from 'react';
import {
  Folder,
  Image as ImageIcon,
  Scissors,
  Wand2,
  Volume2,
  Search,
  Download,
  Trash2,
  ZoomIn,
  Copy,
  Check,
  Filter,
  Grid,
  Sparkles,
  Layers,
  FileImage,
  X
} from 'lucide-react';

interface VaultItem {
  id: string;
  type: 'image' | 'edited' | 'audio';
  title: string;
  url: string;
  tool?: string;
  timestamp: string;
}

const IDB_NAME = 'AetherMindImageDB';
const IDB_STORE = 'images';

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject('IndexedDB unavailable');
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export default function MediaVaultGallery() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'image' | 'edited' | 'audio'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load items from IndexedDB and localStorage session history
  useEffect(() => {
    async function loadVaultItems() {
      const vaultList: VaultItem[] = [];

      // 1. Check IndexedDB stored images
      try {
        if (typeof window !== 'undefined' && window.indexedDB) {
          const db = await initDB();
          const tx = db.transaction(IDB_STORE, 'readonly');
          const store = tx.objectStore(IDB_STORE);
          const keysReq = store.getAllKeys();

          keysReq.onsuccess = () => {
            const keys = keysReq.result as string[];
            keys.forEach(key => {
              const getReq = store.get(key);
              getReq.onsuccess = () => {
                const dataUrl = getReq.result;
                if (dataUrl) {
                  vaultList.push({
                    id: key,
                    type: key.includes('output') ? 'edited' : 'image',
                    title: key.replace(/_/g, ' ').toUpperCase(),
                    url: dataUrl,
                    tool: key.includes('output') ? 'AI Edit Output' : 'Uploaded Source',
                    timestamp: new Date().toLocaleDateString()
                  });
                  setItems([...vaultList]);
                }
              };
            });
          };
        }
      } catch (e) {
        console.warn('Vault IDB load warning:', e);
      }

      // 2. Check localStorage gen history
      try {
        if (typeof window !== 'undefined') {
          const genHist = localStorage.getItem('aether_gen_history');
          if (genHist) {
            const parsed = JSON.parse(genHist);
            parsed.forEach((item: any, idx: number) => {
              vaultList.push({
                id: `gen_${idx}_${item.seed || idx}`,
                type: 'image',
                title: item.prompt || 'Generated Visual',
                url: item.imageUrl,
                tool: item.provider || 'Text-to-Image',
                timestamp: new Date().toLocaleDateString()
              });
            });
          }
        }
      } catch (e) {
        console.warn('Vault localStorage load warning:', e);
      }

      setItems(vaultList);
    }

    loadVaultItems();
  }, []);

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map(i => i.id));
    }
  };

  const handleDeleteSelected = async () => {
    const remaining = items.filter(i => !selectedItems.includes(i.id));
    setItems(remaining);
    setSelectedItems([]);

    // Remove from IndexedDB if applicable
    try {
      const db = await initDB();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      selectedItems.forEach(id => {
        try { store.delete(id); } catch(e){}
      });
    } catch(e){}
  };

  const handleBatchDownload = () => {
    const toDownload = items.filter(i => selectedItems.includes(i.id));
    toDownload.forEach((item, index) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = item.url;
        a.download = `aethermind_vault_${item.type}_${index + 1}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, index * 300);
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredItems = items.filter(item => {
    const matchesFilter = filterType === 'all' || item.type === filterType;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.tool && item.tool.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div id="media-vault-root" className="flex flex-col gap-6 max-w-6xl mx-auto py-2">
      {/* Vault Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/10 pb-4 gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Folder className="w-6 h-6 text-violet-400" />
            Visual Media Cloud Vault
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Personal media library to search, filter, preview, and batch download past artwork & AI edits.
          </p>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2">
          {selectedItems.length > 0 && (
            <>
              <button
                onClick={handleBatchDownload}
                className="px-3.5 py-2 bg-violet-600 hover:bg-violet-550 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-pointer transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                Download ({selectedItems.length})
              </button>
              <button
                onClick={handleDeleteSelected}
                className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected
              </button>
            </>
          )}

          <button
            onClick={handleSelectAll}
            className="px-3.5 py-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
          >
            {selectedItems.length === filteredItems.length && filteredItems.length > 0 ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-950 border border-slate-850 p-4 rounded-2xl shadow-xl">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vault creations by prompt or tool name..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Items', icon: Grid },
            { id: 'image', label: 'Generated Art', icon: Wand2 },
            { id: 'edited', label: 'AI Edits', icon: Scissors }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                filterType === f.id
                  ? 'bg-violet-600/20 border-violet-500 text-violet-300 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <f.icon className="w-3.5 h-3.5" />
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Vault Media Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredItems.map(item => {
            const isSelected = selectedItems.includes(item.id);
            return (
              <div
                key={item.id}
                className={`group relative bg-slate-950 border rounded-2xl overflow-hidden transition-all shadow-xl ${
                  isSelected ? 'border-violet-500 ring-2 ring-violet-500/40' : 'border-slate-850 hover:border-slate-700'
                }`}
              >
                {/* Image Thumbnail */}
                <div className="aspect-square bg-slate-900 relative overflow-hidden">
                  <img
                    src={item.url}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Selection Checkbox Overlay */}
                  <button
                    onClick={() => toggleSelectItem(item.id)}
                    className={`absolute top-2 left-2 w-6 h-6 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-violet-600 border-violet-500 text-white'
                        : 'bg-black/50 border-white/30 text-transparent group-hover:text-white/50'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>

                  {/* Hover Overlay Controls */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setFullscreenImage(item.url)}
                        className="p-1.5 rounded-lg bg-black/60 border border-white/10 hover:bg-white/20 text-white cursor-pointer"
                        title="Zoom Image"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => copyToClipboard(item.url, item.id)}
                        className="p-1.5 rounded-lg bg-black/60 border border-white/10 hover:bg-white/20 text-white cursor-pointer"
                        title="Copy Base64 / URL"
                      >
                        {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <a
                      href={item.url}
                      download={`vault_${item.id}.png`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-1.5 bg-violet-600 hover:bg-violet-550 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer shadow-md"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </a>
                  </div>
                </div>

                {/* Footer Info */}
                <div className="p-3">
                  <span className="text-[10px] font-mono text-cyan-400 font-bold block truncate">{item.tool || 'SAMRAT AI'}</span>
                  <p className="text-xs text-white font-medium truncate mt-0.5" title={item.title}>
                    {item.title}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-950 border border-slate-850 rounded-2xl p-12 text-center space-y-3">
          <Folder className="w-12 h-12 text-slate-700 mx-auto" />
          <h3 className="text-sm font-bold text-white">Vault is Empty</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Generations and edited photos will automatically populate here for persistent cloud access.
          </p>
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center justify-center">
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute -top-12 right-0 text-slate-400 hover:text-white p-2 rounded-full bg-white/10 cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            <img src={fullscreenImage} alt="Vault Zoom" className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain border border-white/10" />
          </div>
        </div>
      )}
    </div>
  );
}
