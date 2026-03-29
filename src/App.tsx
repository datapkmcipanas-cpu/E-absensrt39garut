import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  signInAnonymously,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  limit
} from 'firebase/firestore';
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType 
} from './firebase';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Clock, 
  MapPin, 
  User, 
  LogOut, 
  LogIn, 
  History, 
  CheckCircle2, 
  AlertCircle,
  ShieldCheck,
  Loader2,
  Camera,
  X,
  RotateCcw,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { DEFAULT_EMPLOYEES, DefaultEmployee } from './constants';

// --- Types ---
interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: 'admin' | 'employee';
  nip?: string;
  position?: string;
}

interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  nip?: string;
  timestamp: string;
  type: 'clock-in' | 'clock-out';
  location: {
    latitude: number;
    longitude: number;
  };
  photoUrl?: string;
}

// --- Components ---

const CameraCapture = ({ onCapture, onCancel }: { onCapture: (base64: string) => void, onCancel: () => void }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' }, 
        audio: false 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Gagal mengakses kamera. Pastikan izin kamera telah diberikan.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        // Set canvas size to a smaller resolution to keep base64 string small for Firestore
        const width = 480;
        const height = (video.videoHeight / video.videoWidth) * width;
        canvas.width = width;
        canvas.height = height;
        
        context.drawImage(video, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        onCapture(base64);
        stopCamera();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-md aspect-[3/4] bg-gray-900 rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="font-medium">{error}</p>
            <button onClick={onCancel} className="mt-6 text-sm underline opacity-70">Kembali</button>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
            />
            <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-8 px-6">
              <button 
                onClick={onCancel}
                className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white"
              >
                <X className="w-6 h-6" />
              </button>
              <button 
                onClick={capture}
                className="w-20 h-20 rounded-full bg-white border-8 border-white/30 flex items-center justify-center shadow-xl active:scale-90 transition-transform"
              >
                <div className="w-14 h-14 rounded-full border-2 border-gray-200" />
              </button>
              <button 
                onClick={startCamera}
                className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white"
              >
                <RotateCcw className="w-6 h-6" />
              </button>
            </div>
          </>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <p className="text-white/60 text-sm mt-6 font-medium">Posisikan wajah Anda di tengah layar</p>
    </div>
  );
};

const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setErrorMessage(event.message);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Oops! Terjadi Kesalahan</h2>
          <p className="text-gray-600 mb-4 text-sm break-words">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-500 text-white px-6 py-2 rounded-full font-medium hover:bg-red-600 transition-colors"
          >
            Muat Ulang Halaman
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [isClocking, setIsClocking] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [nipInput, setNipInput] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [pendingType, setPendingType] = useState<'clock-in' | 'clock-out' | null>(null);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auth Listener
  useEffect(() => {
    let unsubscribeAttendance: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      // Clean up previous subscription if it exists
      if (unsubscribeAttendance) {
        unsubscribeAttendance();
        unsubscribeAttendance = null;
      }

      if (firebaseUser) {
        const userProfile = await fetchProfile(firebaseUser.uid);
        
        // If Google user and no profile, create a basic one
        if (!userProfile && firebaseUser.providerData.some(p => p.providerId === 'google.com')) {
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || 'User',
            email: firebaseUser.email || '',
            role: firebaseUser.email === 'datapkmcipanas@gmail.com' ? 'admin' : 'employee',
            position: firebaseUser.email === 'datapkmcipanas@gmail.com' ? 'Administrator' : 'Pegawai'
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
          setProfile(newProfile);
          unsubscribeAttendance = subscribeToAttendance(firebaseUser.uid, newProfile.role, firebaseUser.email);
        } else {
          setProfile(userProfile);
          unsubscribeAttendance = subscribeToAttendance(firebaseUser.uid, userProfile?.role, firebaseUser.email);
        }
      } else {
        setProfile(null);
        setAttendanceHistory([]);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeAttendance) {
        unsubscribeAttendance();
      }
    };
  }, []);

  const fetchProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setProfile(data);
        return data;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    }
    return null;
  };

  const handleNipLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nipInput.trim()) return;
    
    setIsLoggingIn(true);
    setStatus(null);

    const employee = DEFAULT_EMPLOYEES.find(emp => emp.nip === nipInput.trim());
    
    if (!employee) {
      setStatus({ type: 'error', message: 'NIP tidak terdaftar. Silakan hubungi admin.' });
      setIsLoggingIn(false);
      return;
    }

    try {
      // Sign in anonymously to get a UID
      const cred = await signInAnonymously(auth);
      const uid = cred.user.uid;

      // Create/Update profile
      const newProfile: UserProfile = {
        uid,
        displayName: employee.name,
        email: `nip_${employee.nip}@srt39garut.com`, // Simulated email
        role: employee.nip === '198402192025211061' ? 'admin' : 'employee',
        nip: employee.nip,
        position: employee.position
      };

      await setDoc(doc(db, 'users', uid), newProfile);
      setProfile(newProfile);
    } catch (error: any) {
      console.error('Login error:', error);
      let message = 'Gagal masuk. Silakan coba lagi.';
      
      if (error.code === 'auth/operation-not-allowed') {
        message = 'Login NIP (Anonymous Auth) belum diaktifkan di Firebase Console. Silakan hubungi admin untuk mengaktifkan provider "Anonymous" di tab Authentication.';
      } else if (error.code === 'auth/network-request-failed') {
        message = 'Koneksi internet bermasalah. Silakan periksa koneksi Anda.';
      } else if (error.message) {
        message = `Error: ${error.message}`;
      }
      
      setStatus({ type: 'error', message });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const subscribeToAttendance = (uid: string, role?: string, email?: string | null) => {
    let q;
    const isAdminUser = role === 'admin' || email === 'datapkmcipanas@gmail.com';
    
    if (isAdminUser) {
      q = query(
        collection(db, 'attendance'),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
    } else {
      q = query(
        collection(db, 'attendance'),
        where('userId', '==', uid),
        orderBy('timestamp', 'desc'),
        limit(10)
      );
    }

    return onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AttendanceRecord[];
      setAttendanceHistory(records);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
    });
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setNipInput('');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleAttendance = (type: 'clock-in' | 'clock-out') => {
    if (!user) return;
    setPendingType(type);
    setShowCamera(true);
  };

  const processAttendance = async (photoBase64: string) => {
    if (!user || !pendingType) return;
    
    setIsClocking(true);
    setStatus(null);
    setShowCamera(false);

    try {
      // Get location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const record = {
        userId: user.uid,
        userName: profile?.displayName || user.displayName || 'Pegawai',
        nip: profile?.nip || '',
        timestamp: new Date().toISOString(),
        type: pendingType,
        location: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        },
        photoUrl: photoBase64
      };

      await addDoc(collection(db, 'attendance'), record);
      setStatus({ 
        type: 'success', 
        message: `Berhasil ${pendingType === 'clock-in' ? 'Masuk' : 'Pulang'}!` 
      });
    } catch (error) {
      console.error('Attendance error:', error);
      setStatus({ 
        type: 'error', 
        message: error instanceof GeolocationPositionError 
          ? 'Gagal mendapatkan lokasi. Pastikan GPS aktif.' 
          : 'Gagal mencatat absensi. Silakan coba lagi.' 
      });
    } finally {
      setIsClocking(false);
      setPendingType(null);
      setTimeout(() => setStatus(null), 5000);
    }
  };

  const exportToPDF = () => {
    if (!user || attendanceHistory.length === 0) return;

    const doc = new jsPDF();
    const logoUrl = 'https://lh3.googleusercontent.com/d/1DxJ4F1pD144PPnKsZyKrOUqOT6_983-8';
    const isAdminUser = profile?.role === 'admin' || user?.email === 'datapkmcipanas@gmail.com';
    
    // Header with Logo
    doc.addImage(logoUrl, 'PNG', 14, 10, 20, 20);
    
    doc.setFontSize(18);
    doc.setTextColor(220, 38, 38); // Red-600
    doc.text('LAPORAN KEHADIRAN PEGAWAI', 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(100);
    doc.text('SRT 39 GARUT', 105, 30, { align: 'center' });
    
    // Divider
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.5);
    doc.line(14, 35, 196, 35);

    // Employee Info
    doc.setFontSize(11);
    doc.setTextColor(0);
    if (isAdminUser) {
      doc.text(`Laporan Oleh`, 14, 45);
      doc.text(`: ${profile?.displayName || user?.displayName || 'Administrator'}`, 50, 45);
      doc.text(`Cakupan Data`, 14, 52);
      doc.text(`: Seluruh Pegawai`, 50, 52);
    } else {
      doc.text(`Nama Pegawai`, 14, 45);
      doc.text(`: ${profile?.displayName || user?.displayName || '-'}`, 50, 45);
      doc.text(`NIP`, 14, 52);
      doc.text(`: ${profile?.nip || '-'}`, 50, 52);
    }
    
    doc.text(`Jabatan`, 14, 59);
    doc.text(`: ${profile?.position || 'Pegawai'}`, 50, 59);
    
    doc.text(`Tanggal Cetak`, 14, 66);
    doc.text(`: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: id })}`, 50, 66);

    // Table
    const tableData = attendanceHistory.map(record => [
      record.userName || 'Pegawai',
      record.nip || '-',
      record.type === 'clock-in' ? 'Masuk' : 'Pulang',
      format(new Date(record.timestamp), 'dd/MM/yyyy', { locale: id }),
      format(new Date(record.timestamp), 'HH:mm', { locale: id }),
      `${record.location.latitude.toFixed(6)}, ${record.location.longitude.toFixed(6)}`
    ]);

    const tableHead = [['Nama Pegawai', 'NIP', 'Tipe', 'Tanggal', 'Jam', 'Koordinat']];

    autoTable(doc, {
      startY: 75,
      head: tableHead,
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [220, 38, 38],
        textColor: [255, 255, 255],
        fontSize: 10,
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 35 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 25 },
        4: { halign: 'center', cellWidth: 20 },
        5: { halign: 'center' }
      },
      styles: {
        fontSize: 8,
        cellPadding: 3
      }
    });

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Halaman ${i} dari ${pageCount} - Dicetak secara otomatis oleh Sistem Absensi SRT 39 GARUT`,
        105,
        285,
        { align: 'center' }
      );
    }

    doc.save(`Absensi_${profile.displayName}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {showCamera && (
        <CameraCapture 
          onCapture={processAttendance} 
          onCancel={() => {
            setShowCamera(false);
            setPendingType(null);
          }} 
        />
      )}
      <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center overflow-hidden shadow-sm border border-gray-100">
                <img 
                  src="https://lh3.googleusercontent.com/d/1DxJ4F1pD144PPnKsZyKrOUqOT6_983-8" 
                  alt="Logo SRT" 
                  className="w-full h-full object-contain p-1"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h1 className="text-sm font-bold leading-tight uppercase">Absen SRT 39 GARUT</h1>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Kabupaten Garut</p>
              </div>
            </div>
            {user && (
              <button 
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Keluar"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-6 pb-24">
          {!user ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-8"
            >
              <div className="mb-8">
                <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg overflow-hidden">
                  <img 
                    src="https://lh3.googleusercontent.com/d/1DxJ4F1pD144PPnKsZyKrOUqOT6_983-8" 
                    alt="Logo SRT" 
                    className="w-full h-full object-contain p-2"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <h2 className="text-2xl font-bold mb-2">Selamat Datang</h2>
                <p className="text-gray-500 text-sm">Silakan masukkan NIP Anda untuk memulai absensi.</p>
              </div>

              <AnimatePresence>
                {status && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`mb-6 p-4 rounded-2xl flex items-start gap-3 text-left ${
                      status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {status.type === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    )}
                    <p className="text-sm font-medium">{status.message}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleNipLogin} className="space-y-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={nipInput}
                    onChange={(e) => {
                      setNipInput(e.target.value);
                      if (status) setStatus(null);
                    }}
                    placeholder="Masukkan NIP Anda"
                    className="block w-full pl-11 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all shadow-sm font-medium"
                    required
                  />
                </div>
                
                <button 
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full bg-red-600 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-red-700 transition-all shadow-lg shadow-red-100 active:scale-95 disabled:opacity-50"
                >
                  {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                  Masuk Sekarang
                </button>
              </form>

              <div className="mt-12 pt-8 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-4">Atau masuk sebagai Administrator</p>
                <button 
                  onClick={handleGoogleLogin}
                  className="w-full bg-white border border-gray-200 text-gray-600 px-6 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="Google" />
                  Admin Login
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-6">
              {/* User Card */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="w-14 h-14 bg-gray-100 rounded-full overflow-hidden border-2 border-white shadow-sm">
                  <img 
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}&background=random`} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 leading-tight">
                    {profile?.email === 'datapkmcipanas@gmail.com' ? 'DATA SRT 39 GARUT' : profile?.displayName}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-medium mb-1">{profile?.position || 'Pegawai'}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <ShieldCheck className="w-3 h-3 text-red-600" />
                    <span>{profile?.role === 'admin' ? 'Administrator' : 'Pegawai'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 font-medium">{format(currentTime, 'EEEE', { locale: id })}</p>
                  <p className="text-xs font-bold text-gray-900">{format(currentTime, 'dd MMM yyyy')}</p>
                </div>
              </div>

              {/* Clock Card */}
              <div className="bg-gradient-to-br from-red-600 to-red-700 p-8 rounded-3xl text-white text-center shadow-xl shadow-red-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                <div className="relative z-10">
                  <p className="text-red-100 text-sm font-medium mb-1 uppercase tracking-widest">Waktu Sekarang</p>
                  <h2 className="text-5xl font-black tracking-tighter mb-4">
                    {format(currentTime, 'HH:mm:ss')}
                  </h2>
                  <div className="flex items-center justify-center gap-2 text-red-100 text-xs">
                    <MapPin className="w-3 h-3" />
                    <span>Garut, Jawa Barat</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button 
                  disabled={isClocking}
                  onClick={() => handleAttendance('clock-in')}
                  className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50 group"
                >
                  <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-green-600 group-hover:text-white transition-colors">
                    <LogIn className="w-6 h-6" />
                  </div>
                  <span className="block font-bold text-sm">Masuk</span>
                  <span className="text-[10px] text-gray-400 font-medium">Clock In</span>
                </button>
                <button 
                  disabled={isClocking}
                  onClick={() => handleAttendance('clock-out')}
                  className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50 group"
                >
                  <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                    <LogOut className="w-6 h-6" />
                  </div>
                  <span className="block font-bold text-sm">Pulang</span>
                  <span className="text-[10px] text-gray-400 font-medium">Clock Out</span>
                </button>
              </div>

              {/* Status Message */}
              <AnimatePresence>
                {status && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`p-4 rounded-xl flex items-center gap-3 ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}
                  >
                    {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                    <p className="text-sm font-medium">{status.message}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* History Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h4 className="font-bold text-gray-900 flex items-center gap-2">
                    <History className="w-4 h-4 text-red-600" />
                    Riwayat Terbaru
                  </h4>
                  <div className="flex items-center gap-2">
                    {attendanceHistory.length > 0 && (
                      <button 
                        onClick={exportToPDF}
                        className="flex items-center gap-1 text-[10px] font-bold bg-green-600 text-white px-2 py-1 rounded-md hover:bg-green-700 transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        PDF
                      </button>
                    )}
                    <button className="text-xs font-bold text-red-600 hover:underline">Lihat Semua</button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {attendanceHistory.length === 0 ? (
                    <div className="bg-white p-8 rounded-2xl border border-dashed border-gray-200 text-center">
                      <p className="text-gray-400 text-sm">Belum ada riwayat absensi</p>
                    </div>
                  ) : (
                    attendanceHistory.map((record) => (
                      <motion.div 
                        key={record.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${record.type === 'clock-in' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                            {record.photoUrl ? (
                              <img src={record.photoUrl} alt="Bukti" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              record.type === 'clock-in' ? <LogIn className="w-5 h-5" /> : <LogOut className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {record.userName || 'Pegawai'}
                            </p>
                            <p className="text-[10px] text-gray-500 font-medium">
                              <span className={record.type === 'clock-in' ? 'text-green-600' : 'text-orange-600'}>
                                {record.type === 'clock-in' ? 'Masuk' : 'Pulang'}
                              </span>
                              {' • '}
                              {format(new Date(record.timestamp), 'dd MMMM yyyy, HH:mm', { locale: id })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-[10px] text-gray-400 justify-end">
                            <MapPin className="w-2 h-2" />
                            <span>Lokasi Tercatat</span>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Bottom Navigation (Mobile Style) */}
        {user && (
          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-around max-w-md mx-auto shadow-2xl z-20">
            <button className="flex flex-col items-center gap-1 text-red-600">
              <Clock className="w-6 h-6" />
              <span className="text-[10px] font-bold">Absen</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-red-600 transition-colors">
              <History className="w-6 h-6" />
              <span className="text-[10px] font-bold">Riwayat</span>
            </button>
            <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-red-600 transition-colors">
              <User className="w-6 h-6" />
              <span className="text-[10px] font-bold">Profil</span>
            </button>
          </nav>
        )}
      </div>
    </ErrorBoundary>
  );
}
