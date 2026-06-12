import React, { useState, useRef } from 'react';
import { ChevronLeft, Upload, X, HelpCircle, FileCheck, CircleSlash } from 'lucide-react';
import { Screen } from './types';
import { uploadImageToSupabase, getSupabaseConfigError } from '../supabase';
import { logUserAction } from '../firebase';

interface Props { onNavigate: (s: Screen) => void; profile?: any; }

const categories = ['Vegetables', 'Grains', 'Fruits', 'Spices', 'Tubers', 'Legumes'];
const units = ['kg', 'pack', 'bunch', 'piece', 'bag', 'crate'];

export function AddListing({ onNavigate, profile }: Props) {
  const configError = getSupabaseConfigError();
  // We can track real image URLs returned from Supabase bucket
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('Vegetables');
  const [unit, setUnit] = useState('kg');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [description, setDescription] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // File Upload Handlers (conforming to Usability Patterns)
  const processUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const url = await uploadImageToSupabase(file);
      setImageUrls(prev => [...prev, url]);
      
      // Save metadata about this interaction to audit log
      await logUserAction('IMAGE_UPLOAD', 'Uploaded agricultural crop image file to bucket storage', {
        name: file.name,
        size: file.size,
        type: file.type
      });
    } catch (error) {
      console.error('File upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processUpload(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUpload(e.dataTransfer.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleSave = async () => {
    if (!productName || !price || !quantity) {
      alert('Please fill out all required crop details');
      return;
    }

    setSaved(true);

    // Save customized listing to localStorage for dynamic loading
    try {
      const userKey = `my_custom_listings_${profile?.uid || 'guest'}`;
      const stored = localStorage.getItem(userKey);
      const existingListings = stored ? JSON.parse(stored) : [];
      
      const newId = `L_${Date.now()}`;
      const newListing = {
        id: newId,
        name: productName,
        category,
        price: Number(price),
        unit,
        qty: Number(quantity),
        sold: 0,
        status: 'in_stock',
        img: imageUrls[0] || '🌾'
      };

      localStorage.setItem(userKey, JSON.stringify([...existingListings, newListing]));
    } catch (err) {
      console.warn('Failed to persist dynamic listing to localStorage:', err);
    }

    // Save Action to continuous system audit log
    await logUserAction('PUBLISH_CROP_LISTING', 'Farmer successfully published a new crop listing', {
      productName,
      category,
      price: Number(price),
      quantity: Number(quantity),
      imagesCount: imageUrls.length
    });

    setTimeout(() => onNavigate('my-listings'), 1200);
  };

  return (
    <div className="p-5 lg:p-6 max-w-3xl mx-auto" id="add-listing-container">
      <button onClick={() => onNavigate('my-listings')} className="flex items-center gap-1.5 mb-5 cursor-pointer text-xs transition hover:text-black"
        style={{ color: '#5F5E5A' }}>
        <ChevronLeft size={15} /> Back to listings
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Add new listing</h1>
          <p className="text-xs text-gray-500 mt-1">Your product details will be broadcasted to consumers nationally</p>
        </div>
        {configError ? (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 font-semibold">
            <CircleSlash size={12} className="text-amber-600 animate-pulse" />
            <span>Image Sync: Sandbox Fallback Enabled</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[10px] text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 font-medium">
            <HelpCircle size={12} />
            <span>Image Sync Mode: Supabase Bucket Real-time</span>
          </div>
        )}
      </div>

      <div className="space-y-5">
        {configError && (
          <div className="rounded-2xl p-4 border border-rose-200 bg-rose-50/80 text-rose-900 shadow-sm text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <span className="text-sm">⚠️</span>
              <h4 className="text-rose-800 font-bold">Supabase Project Key Configuration Issue</h4>
            </div>
            <p className="leading-relaxed text-rose-700">
              {configError}
            </p>
            <div className="pt-1.5 text-[11px] font-sans text-gray-600 border-t border-rose-200/50">
              💡 <span className="font-semibold text-gray-800">How to Fix:</span> Go to the top-right <span className="font-semibold">Gear Settings menu</span>, replace <code className="bg-black/5 px-1 py-0.5 rounded font-mono font-bold text-rose-700">VITE_SUPABASE_ANON_KEY</code> with your real standard <span className="font-bold">anon/public API key</span> (the long JWT starting with <code className="bg-black/5 px-0.5 py-0.5 rounded font-mono">eyJ...</code>), restart your dev server or reload the page, and try listing your crop again.
            </div>
          </div>
        )}
        {/* Usability Optimized Supabase Image Upload container (Supporting Drag-and-Drop) */}
        <div className="rounded-2xl p-5 border border-black/10 bg-white shadow-sm">
          <label className="text-xs font-semibold text-gray-700 block mb-3">
            Product Images <span className="font-normal text-gray-400">(up to 5 images hosted on Supabase storage)</span>
          </label>
          
          <div className="flex gap-3 flex-wrap mb-4">
            {imageUrls.map((url, i) => (
              <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-black/10 group">
                <img src={url} alt="Product preview" className="w-full h-full object-cover" />
                <button 
                  onClick={() => setImageUrls(p => p.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center bg-red-650 hover:bg-red-700 transition cursor-pointer" 
                  aria-label="Remove image"
                >
                  <X size={10} className="text-white" />
                </button>
              </div>
            ))}

            {imageUrls.length < 5 && (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                className={`w-full max-w-sm h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 cursor-pointer transition ${dragActive ? 'border-emerald-600 bg-emerald-50/50' : 'border-gray-300 hover:border-emerald-600 bg-gray-50'}`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept="image/*" 
                />
                
                {isUploading ? (
                  <div className="flex flex-col items-center">
                    <span className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Uploading to Supabase...</span>
                  </div>
                ) : (
                  <>
                    <Upload size={24} className="text-emerald-700 mb-2" />
                    <span className="text-xs font-semibold text-gray-700">Drag images here or click to browse</span>
                    <span className="text-[10px] text-gray-400 mt-1 font-sans">Supports JPEG, PNG, or WebP up to 5MB</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Details fields */}
        <div className="rounded-2xl p-5 border border-black/10 bg-white shadow-sm space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-2">Product name</label>
            <input 
              type="text" 
              placeholder="e.g. Kaduna Roma Tomatoes" 
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-black/15 text-xs text-gray-800 outline-none focus:ring-1 focus:ring-emerald-700 bg-slate-50" 
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-2">Category</label>
              <select 
                className="w-full h-10 px-3.5 rounded-xl border border-black/15 text-xs text-gray-800 bg-slate-50 outline-none"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-2">Unit</label>
              <select 
                className="w-full h-10 px-3.5 rounded-xl border border-black/15 text-xs text-gray-800 bg-slate-50 outline-none"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                {units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-2">Price per unit (₦)</label>
              <input 
                type="number" 
                placeholder="700" 
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-black/15 text-xs text-gray-800 outline-none focus:ring-1 focus:ring-emerald-700 bg-slate-50 font-mono" 
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-2">Available quantity</label>
              <input 
                type="number" 
                placeholder="500" 
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-black/15 text-xs text-gray-800 outline-none focus:ring-1 focus:ring-emerald-700 bg-slate-50 font-mono" 
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-2">
              Description <span className="font-normal text-gray-400">(max 500 characters)</span>
            </label>
            <textarea 
              rows={4} 
              placeholder="Describe crop freshness, organic cultivation methods, soil notes, or haulage prep..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className="w-full px-3.5 py-3 rounded-xl border border-black/15 text-xs text-gray-800 bg-slate-50 outline-none resize-none leading-relaxed" 
            />
          </div>
        </div>

        {/* Actions button controls */}
        <div className="flex gap-3 pb-8">
          <button
            onClick={handleSave}
            disabled={saved}
            className="flex-1 rounded-xl py-3 transition-all active:scale-[0.98] cursor-pointer font-semibold text-xs flex items-center justify-center gap-1.5"
            style={{ 
              background: saved ? '#EAF3DE' : '#27500A', 
              color: saved ? '#27500A' : '#fff' 
            }}
          >
            {saved ? (
              <>
                <FileCheck size={14} />
                <span>Publishing Completed & Synced!</span>
              </>
            ) : (
              <span>Publish Listing to AgriMarket</span>
            )}
          </button>
          <button onClick={() => onNavigate('my-listings')} className="px-5 rounded-xl py-3 font-semibold text-xs text-gray-500 border border-black/10 hover:bg-slate-50 transition cursor-pointer">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
