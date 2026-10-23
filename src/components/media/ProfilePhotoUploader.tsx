/**
 * @license
 * SiEpang - Canonical Profile Photo Uploader & Cropper Component (Requirements 25 - 34, 60 - 62)
 * Features:
 * - Device camera stream (Ambil Foto) with front camera preference
 * - Permission denied / unavailable fallback to gallery upload
 * - File picker (Pilih dari Galeri / Upload File) supporting JPG, PNG, WEBP
 * - 1:1 square Interactive Crop Editor:
 *   - Pan / Drag positioning
 *   - Zoom slider (1.0x - 3.0x)
 *   - Rotate (90° steps)
 *   - Reset
 *   - Visual Face Overlay Guide: "Posisikan wajah di tengah"
 *   - Warning if below 600x600 px resolution without hard rejection
 *   - 5 MB file size limit
 * - Generates 512x512 optimized WebP/PNG and 128x128 thumbnail
 * - Mobile responsive down to 320px without horizontal overflow
 * - Android back gesture / ESC key support
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  RotateCw,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Check,
  X,
  AlertTriangle,
  User,
  Trash2,
  Image as ImageIcon,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { PhotoEntityType } from '../../types';
import { profilePhotoService } from '../../services/profilePhotoService';
import { resolveGoogleDriveImageUrl } from '../../utils/googleDriveImage';

interface ProfilePhotoUploaderProps {
  entityType: PhotoEntityType;
  entityId: string;
  entityName: string;
  currentPhotoUrl?: string;
  onPhotoSaved?: (record: any) => void;
  onPhotoRemoved?: () => void;
  required?: boolean;
  className?: string;
  /** Enables GAS-side auto-approval only for an authorized edit-photo workflow. */
  autoApproveOnUpload?: boolean;
}

export const ProfilePhotoUploader: React.FC<ProfilePhotoUploaderProps> = ({
  entityType,
  entityId,
  entityName,
  currentPhotoUrl,
  onPhotoSaved,
  onPhotoRemoved,
  required = false,
  className = '',
  autoApproveOnUpload = false,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(resolveGoogleDriveImageUrl(currentPhotoUrl, undefined, 512) || undefined);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [mode, setMode] = useState<'CHOOSER' | 'CAMERA' | 'CROPPER'>('CHOOSER');

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);

  // Raw Image state for Cropper
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [resolutionWarning, setResolutionWarning] = useState<string | null>(null);
  const [sizeWarning, setSizeWarning] = useState<string | null>(null);

  // Crop transforms
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number }>({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropperContainerRef = useRef<HTMLDivElement>(null);

  // Sync current photo url
  useEffect(() => {
    setPhotoUrl(resolveGoogleDriveImageUrl(currentPhotoUrl, undefined, 512) || undefined);
  }, [currentPhotoUrl]);

  // Clean camera stream on unmount or mode exit
  const stopCameraStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

  // Handle Android back button / Esc key for modal
  useEffect(() => {
    if (!modalOpen) return;

    const handlePopState = () => {
      closeModal();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };

    window.history.pushState({ profilePhotoModal: true }, '');
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modalOpen]);

  const closeModal = () => {
    stopCameraStream();
    setModalOpen(false);
    setMode('CHOOSER');
    setRawImageSrc(null);
    setCameraError(null);
  };

  // Start device camera
  const startCamera = async () => {
    setCameraLoading(true);
    setCameraError(null);
    setMode('CAMERA');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Kamera tidak didukung oleh browser ini.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      setCameraError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Izin kamera ditolak. Izinkan akses kamera atau pilih foto dari galeri.'
          : 'Kamera tidak dapat diakses pada perangkat ini. Silakan gunakan foto dari galeri.'
      );
    } finally {
      setCameraLoading(false);
    }
  };

  // Snap photo from video feed
  const captureFromCamera = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    stopCameraStream();
    loadRawImage(dataUrl, canvas.width, canvas.height);
  };

  // Handle gallery file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setSizeWarning('Ukuran berkas melebihi 5 MB. Rekomendasi di bawah 5 MB.');
    } else {
      setSizeWarning(null);
    }

    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      if (result) {
        const img = new Image();
        img.onload = () => {
          loadRawImage(result, img.naturalWidth, img.naturalHeight);
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Initialize cropper with selected image
  const loadRawImage = (dataUrl: string, width: number, height: number) => {
    setRawImageSrc(dataUrl);
    setNaturalDimensions({ width, height });

    if (width < 600 || height < 600) {
      setResolutionWarning(`Resolusi asli (${width}x${height} px) di bawah 600x600 px. Foto mungkin terlihat kurang tajam di cetakan ID Card.`);
    } else {
      setResolutionWarning(null);
    }

    // Reset crop state
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setMode('CROPPER');
  };

  // Pan / drag handlers for cropper
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, offsetX: offset.x, offsetY: offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setOffset({
      x: dragStartRef.current.offsetX + dx,
      y: dragStartRef.current.offsetY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      dragStartRef.current = { x: touch.clientX, y: touch.clientY, offsetX: offset.x, offsetY: offset.y };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStartRef.current.x;
    const dy = touch.clientY - dragStartRef.current.y;
    setOffset({
      x: dragStartRef.current.offsetX + dx,
      y: dragStartRef.current.offsetY + dy,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Render final 512x512 crop
  const handleSaveCrop = async () => {
    if (isUploading) return;
    if (!rawImageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = 512;
      outputCanvas.height = 512;
      const ctx = outputCanvas.getContext('2d');
      if (!ctx) return;

      // Fill background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 512, 512);

      ctx.save();
      ctx.translate(256, 256);
      ctx.rotate((rotation * Math.PI) / 180);

      // Render image centered with offset and zoom.
      // Scale the shorter source dimension to the full 512px canvas so the
      // saved square photo fills the crop frame instead of leaving large white margins.
      const containerSize = 240; // Reference preview square size
      const outputSize = 512;
      const baseScale = outputSize / Math.min(img.naturalWidth, img.naturalHeight);
      const renderW = img.naturalWidth * baseScale * zoom;
      const renderH = img.naturalHeight * baseScale * zoom;

      ctx.drawImage(
        img,
        -renderW / 2 + offset.x * (512 / containerSize),
        -renderH / 2 + offset.y * (512 / containerSize),
        renderW,
        renderH
      );

      ctx.restore();

      const optimizedWebp = outputCanvas.toDataURL('image/webp', 0.88);

      // Thumbnail 128x128
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 128;
      thumbCanvas.height = 128;
      const tCtx = thumbCanvas.getContext('2d');
      if (tCtx) {
        tCtx.drawImage(outputCanvas, 0, 0, 128, 128);
      }
      const thumbUrl = thumbCanvas.toDataURL('image/webp', 0.80);

      // Store in profilePhotoService
      setIsUploading(true);
      setUploadError('');
      try {
      const saved = await profilePhotoService.uploadPhoto({
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        data_url: optimizedWebp,
        thumbnail_url: thumbUrl,
        width: 512,
        height: 512,
        auto_approve: autoApproveOnUpload,
      });

      setPhotoUrl(resolveGoogleDriveImageUrl(saved.profile_photo_url, saved.profile_photo_file_id, 512) || undefined);
      if (onPhotoSaved) {
        onPhotoSaved(saved);
      }

      closeModal();
      } catch (error: any) {
        setUploadError(error?.message || 'Gagal menyimpan foto ke Drive.');
      } finally {
        setIsUploading(false);
      }
    };
    img.src = rawImageSrc;
  };

  const handleDeletePhoto = () => {
    if (confirm('Hapus foto profil ini?')) {
      const existing = profilePhotoService.getPhotoByEntity(entityType, entityId);
      if (existing) {
        profilePhotoService.deletePhoto(existing.id);
      }
      setPhotoUrl(undefined);
      if (onPhotoRemoved) {
        onPhotoRemoved();
      }
    }
  };

  const placeholderFallback = profilePhotoService.getPlaceholderUrl(entityName);

  return (
    <div className={`space-y-2.5 ${className}`}>
      {isUploading && <div role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">Mengunggah foto ke Google Drive…</div>}
      {uploadError && <div role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{uploadError}</div>}
      {/* Hidden file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Main Avatar Row */}
      <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-black/30 border border-white/10">
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-slate-900 border-2 border-emerald-500/40 shrink-0 shadow-md">
          <img
            src={photoUrl || placeholderFallback}
            alt={entityName}
            className="w-full h-full object-cover"
            onError={e => {
              (e.currentTarget as HTMLImageElement).src = placeholderFallback;
            }}
          />
          {required && !photoUrl && (
            <span className="absolute bottom-0 inset-x-0 bg-red-600/90 text-white text-[9px] font-bold text-center py-0.5">
              Wajib
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white truncate">{entityName}</span>
            {photoUrl ? (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-bold border border-emerald-500/30 flex items-center gap-0.5">
                <Check className="w-2.5 h-2.5" /> Ada Foto
              </span>
            ) : required ? (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 text-[9px] font-bold border border-rose-500/30">
                Belum Unggah
              </span>
            ) : (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-500/20 text-slate-300 text-[9px] font-bold">
                Opsional
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 leading-tight line-clamp-1">
            {photoUrl ? 'Foto siap digunakan untuk verifikasi & ID Card' : 'Foto resmi seragam Pramuka atau pakaian rapi'}
          </p>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => {
                setModalOpen(true);
                setMode('CHOOSER');
              }}
              className="p-2.5 sm:px-3.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer min-h-[44px] min-w-[44px]"
              aria-label={photoUrl ? 'Ganti Foto Profil' : 'Unggah Foto Profil'}
              title={photoUrl ? 'Ganti Foto' : 'Unggah Foto'}
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">{photoUrl ? 'Ganti Foto' : 'Unggah Foto'}</span>
            </button>

            {photoUrl && (
              <button
                type="button"
                onClick={handleDeletePhoto}
                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-rose-300 text-[11px] font-semibold border border-white/10 transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Hapus Foto Profil"
                aria-label="Hapus Foto Profil"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DIALOG: PHOTO CHOOSER / CAMERA / CROPPER */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm sm:max-w-md bg-white dark:bg-[#141418] border border-[#ECECEF] dark:border-white/10 rounded-[28px] p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#ECECEF] dark:border-white/10">
              <div className="min-w-0 pr-2">
                <h3 className="text-sm sm:text-base font-bold text-[#171717] dark:text-white truncate">
                  {mode === 'CHOOSER' && 'Pilih Sumber Foto Profil'}
                  {mode === 'CAMERA' && 'Ambil Foto dari Kamera'}
                  {mode === 'CROPPER' && 'Atur & Pangkas Foto (1:1)'}
                </h3>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                  {entityType} · {entityName}
                </span>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-[#171717] dark:hover:text-white transition-colors flex items-center justify-center cursor-pointer"
                title="Tutup Jendela"
                aria-label="Tutup Jendela"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* MODE 1: CHOOSER (Ambil Foto vs Pilih Galeri) */}
            {mode === 'CHOOSER' && (
              <div className="space-y-3.5 py-2">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Pilih cara untuk menambahkan foto profil resmi. Pastikan wajah terlihat jelas dan pencahayaan memadai.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={startCamera}
                    className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-600/10 border border-emerald-500/30 hover:border-emerald-500 text-left space-y-2 transition-all active:scale-95 group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow">
                      <Camera className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#171717] dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300">
                        Ambil Foto
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        Gunakan kamera depan perangkat
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-[#ECECEF] dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 text-left space-y-2 transition-all active:scale-95 group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-white/10 text-[#171717] dark:text-white flex items-center justify-center">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#171717] dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300">
                        Pilih dari Galeri
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        Upload berkas JPG, PNG, WEBP (maks 5MB)
                      </div>
                    </div>
                  </button>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-black/40 border border-[#ECECEF] dark:border-white/5 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <span>💡 Tips Foto Resmi:</span>
                  </div>
                  <div>• Foto setengah badan atau pas foto wajah</div>
                  <div>• Mengenakan seragam Pramuka / atribut kontingen</div>
                  <div>• Foto akan disimpan aman di Google Drive Kwartir</div>
                </div>
              </div>
            )}

            {/* MODE 2: CAMERA VIEWPORT */}
            {mode === 'CAMERA' && (
              <div className="space-y-3">
                {cameraError ? (
                  <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200 space-y-3 text-center">
                    <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
                    <p>{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow text-xs inline-flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Pilih Foto dari Galeri Saja</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative w-full aspect-square max-w-[280px] mx-auto rounded-3xl overflow-hidden bg-black border-2 border-emerald-500/60 shadow-lg">
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />

                      {/* Oval face guide overlay */}
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                        <div className="w-44 h-56 rounded-[50%] border-2 border-dashed border-emerald-400/70 shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center">
                          <span className="text-[10px] font-bold text-emerald-300 bg-black/60 px-2 py-0.5 rounded-full">
                            Posisikan wajah di tengah
                          </span>
                        </div>
                      </div>

                      {cameraLoading && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-xs text-slate-300">
                          Menghubungkan kamera...
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={captureFromCamera}
                        className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white font-bold text-xs rounded-2xl shadow-lg flex items-center gap-2 active:scale-95 cursor-pointer"
                      >
                        <Camera className="w-4 h-4 stroke-[2.5]" />
                        <span>Ambil Jepretan</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('CHOOSER')}
                        className="px-4 py-3 bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold rounded-2xl"
                      >
                        Kembali
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODE 3: CROPPER (Interactive 1:1) */}
            {mode === 'CROPPER' && rawImageSrc && (
              <div className="space-y-3.5">
                {/* Warning banners if any */}
                {resolutionWarning && (
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-[10px] text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{resolutionWarning}</span>
                  </div>
                )}
                {sizeWarning && (
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-[10px] text-amber-200 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{sizeWarning}</span>
                  </div>
                )}

                {/* Interactive Viewport Container */}
                <div
                  ref={cropperContainerRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className="relative w-60 h-60 sm:w-64 sm:h-64 mx-auto rounded-3xl overflow-hidden bg-black/90 border-2 border-emerald-500/50 shadow-inner cursor-move select-none"
                  title="Geser mouse atau sentuh untuk menggeser posisi foto"
                >
                  <div
                    style={{
                      transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg) scale(${zoom})`,
                      transformOrigin: 'center center',
                      transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                    }}
                    className="w-full h-full flex items-center justify-center pointer-events-none"
                  >
                    <img
                      src={rawImageSrc}
                      alt="Crop target"
                      className="max-w-none object-contain"
                      style={{
                        // Match the saved crop: cover the square viewport while
                        // preserving the source aspect ratio; overflow is cropped.
                        width: naturalDimensions.width >= naturalDimensions.height
                          ? `${(naturalDimensions.width / naturalDimensions.height) * 100}%`
                          : '100%',
                        height: naturalDimensions.height >= naturalDimensions.width
                          ? `${(naturalDimensions.height / naturalDimensions.width) * 100}%`
                          : '100%',
                        objectFit: 'fill',
                        flex: 'none',
                      }}
                    />
                  </div>

                  {/* Circular mask guide */}
                  <div className="absolute inset-0 pointer-events-none border-[3px] border-emerald-400/40 rounded-3xl flex items-center justify-center">
                    <div className="w-52 h-52 sm:w-56 sm:h-56 rounded-full border border-dashed border-emerald-300/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] flex items-end justify-center pb-2">
                      <span className="text-[9px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-full">
                        Area Foto 1:1
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transform Controls Toolbar */}
                <div className="p-3 bg-black/40 border border-white/5 rounded-2xl space-y-2 text-xs">
                  {/* Zoom Slider */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setZoom(Math.max(1, zoom - 0.2))}
                      className="p-2.5 rounded-lg text-slate-400 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
                      title="Perkecil Zoom"
                      aria-label="Perkecil Zoom"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.05"
                      value={zoom}
                      onChange={e => setZoom(parseFloat(e.target.value))}
                      className="flex-1 accent-emerald-500 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => setZoom(Math.min(3, zoom + 0.2))}
                      className="p-2.5 rounded-lg text-slate-400 hover:text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
                      title="Perbesar Zoom"
                      aria-label="Perbesar Zoom"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <span className="font-mono text-[10px] text-slate-400 w-8 text-right">
                      {zoom.toFixed(1)}x
                    </span>
                  </div>

                  {/* Rotate & Reset Buttons (Req 124) */}
                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRotation((rotation + 90) % 360)}
                        className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 flex items-center gap-1.5 transition-colors min-h-[44px] cursor-pointer"
                        title="Putar 90 Derajat"
                        aria-label="Putar Foto 90 Derajat"
                      >
                        <RotateCw className="w-4 h-4" />
                        <span className="hidden sm:inline">Putar 90°</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setZoom(1);
                          setRotation(0);
                          setOffset({ x: 0, y: 0 });
                        }}
                        className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 flex items-center gap-1.5 transition-colors min-h-[44px] cursor-pointer"
                        title="Reset Penyesuaian Foto"
                        aria-label="Reset Penyesuaian Foto"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span className="hidden sm:inline">Reset</span>
                      </button>
                    </div>

                    <span className="text-[10px] text-slate-500">
                      Output: 512×512 px
                    </span>
                  </div>
                </div>

                {/* Footer Save / Cancel (Req 124) */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setMode('CHOOSER')}
                    className="px-3 sm:px-4 py-2.5 bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold rounded-xl min-h-[44px] cursor-pointer"
                    title="Pilih Berkas Lain"
                    aria-label="Pilih Berkas Lain"
                  >
                    <span className="hidden sm:inline">Ganti Berkas</span>
                    <span className="sm:hidden">Ulangi</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveCrop}
                    disabled={isUploading}
                    className="px-4 sm:px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5 active:scale-95 cursor-pointer min-h-[44px]"
                    title="Simpan & Terapkan Foto"
                    aria-label="Simpan Foto"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isUploading ? 'Mengunggah…' : 'Simpan'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
