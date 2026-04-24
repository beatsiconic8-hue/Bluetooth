/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Radar, Shield, Smartphone, Radio, Filter, Eye, MapPin, Activity, Wifi, ChevronRight, Lock, Unlock, Brain, AlertTriangle, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { analyzeDevices, DeviceInsight } from './services/geminiService';

// Types and Constants
type DeviceType = 'RPA' | 'RST' | 'STP';

interface Device {
  id: string;
  type: DeviceType;
  model: string;
  distance: number;
  angle: number;
  lastSeen: Date;
  isHome: boolean;
  isTarget: boolean;
  heading: number;
  rssi: number;
}

const MAC_TYPES: Record<DeviceType, { color: string; label: string; desc: string; bg: string; glow: string; border: string }> = {
  RPA: { color: 'text-[#FF4444]', bg: 'bg-[#FF4444]', glow: 'shadow-[0_0_10px_#FF4444]', border: 'border-[#FF4444]', label: 'RPA (Random)', desc: 'Likely iOS/AirTag' },
  RST: { color: 'text-amber-400', bg: 'bg-amber-400', glow: 'shadow-[0_0_10px_rgba(251,191,36,0.4)]', border: 'border-amber-400/50', label: 'RST (Private)', desc: 'Resolved Static' },
  STP: { color: 'text-[#66FCF1]', bg: 'bg-[#66FCF1]', glow: 'shadow-[0_0_10px_#66FCF1]', border: 'border-[#66FCF1]', label: 'STP (Static)', desc: 'Fixed Device' }
};

const BLERadarSimulation = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'target' | 'non-home'>('all');
  const [view, setView] = useState<'list' | 'radar'>('list');
  const [logs, setLogs] = useState<{ id: number; message: string; timestamp: string }[]>([]);
  const [scanningTime, setScanningTime] = useState(0);

  const generateDevice = () => {
    const types: DeviceType[] = ['RPA', 'RPA', 'STP', 'RST'];
    const type = types[Math.floor(Math.random() * types.length)];
    const models: Record<DeviceType, string[]> = {
      RPA: ['iPhone 15 Pro', 'Apple AirTag', 'Apple Watch U2', 'Unknown iOS', 'iPad Pro M4'],
      STP: ['Smart Hub 4', 'Amazon Echo Dot', 'Sony TV Bravia', 'Nuki Smart Lock'],
      RST: ['Bose QC-45', 'Tile Pro Tracker', 'Tesla KeyFob', 'Garmin Fenix 7']
    };
    
    const id = Array.from({ length: 6 }, () => 
      Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()
    ).join(':');
    
    const distance = Math.floor(Math.random() * 120) + 5; 
    const angle = Math.random() * 360;

    return {
      id,
      type,
      model: models[type][Math.floor(Math.random() * models[type].length)],
      distance,
      angle,
      lastSeen: new Date(),
      isHome: false,
      isTarget: false,
      heading: Math.floor(Math.random() * 360),
      rssi: -(Math.floor(Math.random() * 40) + 40)
    };
  };

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<Record<string, DeviceInsight>>({});
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [isNeuralizing, setIsNeuralizing] = useState(false);
  const [saturationLevel, setSaturationLevel] = useState(45);
  const analysisTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnalyzedCountRef = useRef(0);

  // Saturation Calculation
  useEffect(() => {
    const criticalZones = devices.filter(d => d.distance < 15).length;
    const baseSat = (criticalZones / 20) * 100;
    const rssiImpact = Math.abs(devices.reduce((acc, d) => acc + d.rssi, 0) / (devices.length || 1)) / 100 * 20;
    setSaturationLevel(Math.min(100, baseSat + rssiImpact + (isScanning ? 20 : 0)));
  }, [devices, isScanning]);

  // AI Analysis Trigger
  useEffect(() => {
    const runAnalysis = async () => {
      // Don't run if: scanning is off, already analyzing, no devices, OR if we've already analyzed this exact number of devices recently
      if (!isScanning || isAiAnalyzing || devices.length === 0 || (devices.length === lastAnalyzedCountRef.current && !quotaExceeded)) return;
      
      setIsAiAnalyzing(true);
      setQuotaExceeded(false);
      
      try {
        const insights = await analyzeDevices(devices);
        
        if (insights.length === 0 && devices.length > 0) {
          // Check if it was a quota error (this depends on service returning [] on error)
          // We'll handle this more robustly in the service
        }

        const newInsightsMap: Record<string, DeviceInsight> = {};
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        insights.forEach(insight => {
          newInsightsMap[insight.deviceId] = insight;
          
          if (insight.riskLevel === 'CRITICAL' || insight.riskLevel === 'HIGH') {
            setLogs(prev => [
              {
                id: Date.now() + Math.random(),
                message: `AI_ALERT: [${insight.riskLevel}] ${insight.observation}`,
                timestamp
              },
              ...prev
            ].slice(0, 15));
          }
        });

        setAiInsights(prev => ({ ...prev, ...newInsightsMap }));
        lastAnalyzedCountRef.current = devices.length;
      } catch (err: any) {
        if (err.message?.includes('429') || err.message?.includes('quota')) {
          setQuotaExceeded(true);
        }
      } finally {
        setIsAiAnalyzing(false);
      }
    };

    if (isScanning) {
      analysisTimerRef.current = setInterval(runAnalysis, 45000); // Reduce frequency to 45s
      runAnalysis(); 
    }
    
    return () => {
      if (analysisTimerRef.current) clearInterval(analysisTimerRef.current);
    };
  }, [isScanning]); // Only restart interval if scan state toggles

  // Simulation logic stays the same...
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isScanning) {
      interval = setInterval(() => {
        setScanningTime(prev => prev + 1);
        if (Math.random() > 0.8) {
          const newDev = generateDevice();
          setDevices(prev => {
            const exists = prev.find(d => d.id === newDev.id);
            if (exists) return prev;
            return [newDev, ...prev].slice(0, 20);
          });
          
          setLogs(prev => [
            { 
              id: Date.now(), 
              message: `SIGNAL_ACQUIRED: ${newDev.model} (${newDev.id})`, 
              timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
            }, 
            ...prev
          ].slice(0, 10));
        }

        setDevices(prev => prev.map(d => ({
          ...d,
          distance: Math.max(1, d.distance + (Math.random() * 5 - 2.5)),
          rssi: -(Math.floor(Math.random() * 60) + 30)
        })));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isScanning]);

  useEffect(() => {
    if (selectedDeviceId) {
      const timer = setTimeout(() => setSelectedDeviceId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [selectedDeviceId]);

  const handleNeuralize = () => {
    setIsNeuralizing(true);
    setLogs(prev => [
      {
        id: Date.now(),
        message: "SYSTEM_SIGNAL: EXECUTING_NEURAL_RECALIBRATION...",
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      },
      ...prev
    ].slice(0, 15));
    
    setTimeout(() => {
      setIsNeuralizing(false);
      setLogs(prev => [
        {
          id: Date.now(),
          message: "NEURAL_LINK: SENSOR_SATURATION_STABILIZED // NOISE_FLOOR_RESET",
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
        },
        ...prev
      ].slice(0, 15));
    }, 1000);
  };

  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      if (filterMode === 'target') return d.isTarget;
      if (filterMode === 'non-home') return !d.isHome;
      return true;
    });
  }, [devices, filterMode]);

  const toggleHome = (id: string) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, isHome: !d.isHome } : d));
  };

  const toggleTarget = (id: string) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, isTarget: !d.isTarget } : d));
  };

  const handleExportData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      scanningTime,
      activeDevicesCount: devices.length,
      devices: devices.map(d => ({
        id: d.id,
        model: d.model,
        type: d.type,
        distance: d.distance.toFixed(2),
        rssi: d.rssi,
        risk: aiInsights[d.id]?.riskLevel || 'N/A',
        classification: aiInsights[d.id]?.classification || 'N/A',
        observation: aiInsights[d.id]?.observation || 'N/A'
      })),
      logs: logs.map(l => ({
        timestamp: l.timestamp,
        message: l.message
      }))
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ble_radar_export_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setLogs(prev => [
      {
        id: Date.now(),
        message: "SYSTEM_SIGNAL: TELEMETRY_EXPORT_COMPLETED // ARCHIVE_CREATED",
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      },
      ...prev
    ].slice(0, 15));
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0B0C10] text-[#C5C6C7] font-mono select-none overflow-hidden relative">
      {/* Neuralize Flash Overlay */}
      <AnimatePresence>
        {isNeuralizing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 z-[100] bg-white pointer-events-none mix-blend-screen"
          />
        )}
      </AnimatePresence>

      {/* Saturation Interference Overlay */}
      <AnimatePresence>
        {saturationLevel > 85 && !isNeuralizing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: (saturationLevel - 80) / 40 }}
            className="absolute inset-0 z-[50] pointer-events-none overflow-hidden opacity-20"
          >
            <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] animate-pulse"></div>
            <div className="absolute inset-0 bg-red-900/10 mix-blend-overlay"></div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Top Navigation & Status */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#1F2833] bg-[#0B0C10] shadow-xl z-20">
        <div className="flex items-center gap-4">
          <div className="relative">
            <motion.div 
              animate={isScanning ? { scale: [1, 1.3, 1], opacity: [1, 0.4, 1] } : { opacity: 0.2 }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-3 h-3 bg-[#66FCF1] rounded-full shadow-[0_0_8px_#66FCF1]"
            />
            <div className="absolute -inset-1 border border-[#66FCF1] rounded-full opacity-20"></div>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-widest text-[#66FCF1]">BLE_SURVEILLANCE_RADAR_V2.4</h1>
            <p className="text-[10px] opacity-50 uppercase tracking-tighter">KERNEL: 5.15.0-89-GENERIC // SCAN_MODE: AGGRESSIVE</p>
          </div>
        </div>
          <div className="flex gap-6 items-center">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] text-[#45A29E] uppercase tracking-widest font-bold flex items-center justify-end gap-2">
                {isAiAnalyzing && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}><Brain className="w-3 h-3 text-[#66FCF1]" /></motion.div>}
                {quotaExceeded && <AlertTriangle className="w-3 h-3 text-red-500 animate-pulse" />}
                SIGINT AI Analysis
              </div>
              <div className={`text-[10px] font-bold ${quotaExceeded ? 'text-red-500' : isAiAnalyzing ? 'text-[#66FCF1]' : 'text-white/20'}`}>
                {quotaExceeded ? 'QUOTA_EXHAUSTED' : isAiAnalyzing ? 'COMPUTING_INVARIANTS...' : 'NEURAL_LINK_STABLE'}
              </div>
            </div>
            <div className="h-10 w-px bg-[#1F2833] hidden sm:block"></div>
            <div className="text-right hidden sm:block">
              <div className="text-[10px] text-[#45A29E] uppercase tracking-widest font-bold">Signal Intensity</div>
              <div className="text-sm font-bold bg-gradient-to-l from-[#66FCF1] to-blue-400 bg-clip-text text-transparent">-{ Math.floor(60 + Math.random() * 10) }.4 dBm AVG</div>
            </div>
          <div className="h-10 w-px bg-[#1F2833]"></div>
          <div className="flex gap-3">
            <button 
              onClick={handleExportData}
              className="px-4 py-2 border border-[#66FCF1]/30 text-[#66FCF1] text-[10px] font-bold hover:bg-[#66FCF1] hover:text-[#0B0C10] transition-colors uppercase tracking-widest flex items-center gap-2"
            >
              <Download className="w-3 h-3" />
              Export_Archive
            </button>
            <button 
              onClick={() => setLogs([])}
              className="px-4 py-2 border border-[#45A29E] text-[#45A29E] text-[10px] font-bold hover:bg-[#45A29E] hover:text-[#0B0C10] transition-colors uppercase tracking-widest"
            >
              Reset_Buffer
            </button>
            <button 
              onClick={() => setIsScanning(!isScanning)}
              className={`px-6 py-2 text-[10px] font-bold shadow-[0_0_15px_rgba(102,252,241,0.2)] transition-all active:scale-95 uppercase tracking-widest ${isScanning ? 'bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500 hover:text-white' : 'bg-[#66FCF1] text-[#0B0C10] hover:bg-[#45A29E]'}`}
            >
              {isScanning ? 'Stop_Scan' : 'Initialize_Pulse'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar / Filters */}
        <aside className="w-64 border-r border-[#1F2833] bg-[#0B0C10] flex flex-col shrink-0">
          <div className="p-4 border-b border-[#1F2833]">
            <div className="text-[10px] text-[#45A29E] font-bold uppercase mb-3 tracking-widest">Filtering Parameters</div>
            <div className="space-y-2">
              <button 
                onClick={() => setFilterMode('all')}
                className={`w-full flex items-center justify-between p-2 border transition-all text-left ${filterMode === 'all' ? 'bg-[#1F2833]/50 border-[#45A29E]/30 text-[#66FCF1]' : 'border-transparent opacity-60 hover:opacity-100 hover:bg-white/5'}`}
              >
                <span className="text-xs tracking-tighter">ALL_SIGNALS</span>
                <span className="text-[10px] opacity-40 italic">{devices.length}</span>
              </button>
              <button 
                onClick={() => setFilterMode('target')}
                className={`w-full flex items-center justify-between p-2 border transition-all text-left ${filterMode === 'target' ? 'bg-red-900/20 border-red-500/30 text-red-400' : 'border-transparent opacity-60 hover:opacity-100 hover:bg-white/5'}`}
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-3 h-3 text-red-500" />
                  <span className="text-xs tracking-tighter">TARGETS_ONLY</span>
                </div>
                <span className="text-[10px] font-bold">{devices.filter(d => d.isTarget).length}</span>
              </button>
              <button 
                onClick={() => setFilterMode('non-home')}
                className={`w-full flex items-center justify-between p-2 border transition-all text-left ${filterMode === 'non-home' ? 'bg-[#1F2833]/50 border-[#45A29E]/30 text-[#66FCF1]' : 'border-transparent opacity-60 hover:opacity-100 hover:bg-white/5'}`}
              >
                <span className="text-xs tracking-tighter">NON_HOME_DEVICES</span>
                <span className="text-[10px] opacity-40 italic">{devices.filter(d => !d.isHome).length}</span>
              </button>
            </div>
          </div>
          
          <div className="p-4 border-b border-[#1F2833] flex-1">
            <div className="text-[10px] text-[#45A29E] font-bold uppercase mb-3 tracking-widest">Atmosphere Heatmap</div>
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: 12 }).map((_, i) => (
                <motion.div 
                  key={i}
                  animate={{ opacity: [0.1, 0.4, 0.2, 0.6, 0.1] }}
                  transition={{ repeat: Infinity, duration: 2 + Math.random() * 3, delay: i * 0.1 }}
                  className="h-8 bg-[#66FCF1] border border-white/5"
                />
              ))}
            </div>
            <div className="mt-4 p-2 bg-white/5 rounded border border-[#1F2833]">
              <div className="text-[8px] opacity-30 uppercase font-black mb-1">Signal Saturation</div>
              <div className="h-1 bg-[#1F2833] rounded-full overflow-hidden">
                <motion.div 
                  animate={{ 
                    width: `${saturationLevel}%`,
                    backgroundColor: saturationLevel > 80 ? '#FF4444' : saturationLevel > 60 ? '#f59e0b' : '#3b82f6'
                  }}
                  className="h-full"
                />
              </div>
            </div>
            {saturationLevel > 75 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleNeuralize}
                className="w-full mt-4 flex items-center justify-center gap-2 py-2 bg-[#66FCF1]/10 border border-[#66FCF1]/40 text-[#66FCF1] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-[#66FCF1] hover:text-[#0B0C10] transition-all animate-pulse"
              >
                <Brain className="w-3 h-3" />
                Neuralize_Saturation
              </motion.button>
            )}
          </div>

          <div className="p-4 border-t border-[#1F2833] bg-[#1F2833]/20">
            <div className="text-[10px] opacity-40 mb-1 font-bold uppercase tracking-widest">Sensor_Temp</div>
            <div className="text-sm font-bold tracking-widest text-white">42.8°C <span className="text-[10px] text-emerald-500">[STABLE]</span></div>
          </div>
        </aside>

        {/* Device Grid */}
        <section className="flex-1 border-r border-[#1F2833] overflow-hidden flex flex-col">
          <div className="bg-[#1F2833]/30 p-2 px-4 text-[9px] flex justify-between border-b border-[#1F2833]">
            <span className="opacity-50 uppercase tracking-widest font-bold">Active Signal List (n={filteredDevices.length})</span>
            <span className="text-[#66FCF1] font-bold tracking-tighter uppercase">Sort_Distance: Descending</span>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="text-[10px] text-[#45A29E] bg-[#0B0C10] sticky top-0 uppercase tracking-widest font-black">
                <tr>
                  <th className="p-4 border-b border-[#1F2833]">Type</th>
                  <th className="p-4 border-b border-[#1F2833]">Identification / MAC</th>
                  <th className="p-4 border-b border-[#1F2833]">Distance</th>
                  <th className="p-4 border-b border-[#1F2833]">RSSI</th>
                  <th className="p-4 border-b border-[#1F2833] text-right">Ops</th>
                </tr>
              </thead>
              <tbody className="text-[11px] divide-y divide-[#1F2833]">
                {filteredDevices.map(device => {
                  const insight = aiInsights[device.id];
                  const riskColor = insight?.riskLevel === 'CRITICAL' ? 'text-red-600' : 
                                   insight?.riskLevel === 'HIGH' ? 'text-red-400' : 
                                   insight?.riskLevel === 'MEDIUM' ? 'text-amber-400' : 'text-[#45A29E]';

                  return (
                    <motion.tr 
                      layout
                      key={device.id} 
                      className={`hover:bg-[#1F2833]/20 transition-all ${device.isTarget ? 'bg-[#FF4444]/10' : ''} ${selectedDeviceId === device.id ? 'bg-[#66FCF1]/20 ring-1 ring-inset ring-[#66FCF1]/50' : ''}`}
                    >
                      <td className="p-4">
                        <span className={`font-bold ${MAC_TYPES[device.type].color}`}>{device.type}</span>
                        {insight && (
                          <div className={`text-[8px] font-black uppercase mt-1 px-1 py-0.5 rounded border border-current w-fit bg-black/40 ${riskColor}`}>
                            {insight.riskLevel}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-[#C5C6C7] tracking-tighter flex items-center gap-2">
                          {device.model}
                          {insight && <span className="text-[8px] opacity-40 px-1 py-0.5 border border-white/5 rounded">AI: {insight.classification}</span>}
                        </div>
                        <div className="text-[9px] opacity-30 font-mono tracking-widest uppercase">{device.id}</div>
                        {insight && insight.riskLevel !== 'LOW' && (
                          <div className="text-[8px] text-[#66FCF1] mt-1 italic opacity-80 max-w-[150px] leading-tight">
                            &gt; {insight.observation}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                      <div className="font-bold tabular-nums text-white/90">{device.distance.toFixed(1)}m</div>
                      <div className="w-20 h-0.5 bg-white/5 mt-1 rounded-full overflow-hidden">
                        <motion.div 
                          animate={{ width: `${Math.max(5, 100 - (device.distance / 1.5))}%` }}
                          className={`h-full ${device.isTarget ? 'bg-red-500' : 'bg-[#45A29E]'}`}
                        />
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`font-bold tabular-nums ${device.rssi > -60 ? 'text-[#66FCF1]' : device.rssi < -90 ? 'text-red-500/50' : 'text-[#45A29E]'}`}>
                        {device.rssi} dBm
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => toggleHome(device.id)} 
                          className={`px-2 py-0.5 text-[9px] font-bold border transition-all uppercase tracking-tighter ${device.isHome ? 'bg-emerald-500 text-[#0B0C10] border-emerald-500' : 'border-[#45A29E]/30 text-[#45A29E] hover:border-[#45A29E] hover:text-[#66FCF1]'}`}
                        >
                          {device.isHome ? 'Defined' : 'Set_Home'}
                        </button>
                        <button 
                          onClick={() => toggleTarget(device.id)} 
                          className={`px-2 py-0.5 text-[9px] font-bold transition-all uppercase tracking-tighter ${device.isTarget ? 'bg-[#FF4444] text-[#0B0C10]' : 'border-[#FF4444]/30 text-[#FF4444] hover:bg-[#FF4444]/10 border'}`}
                        >
                          Target
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
                {filteredDevices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-32 text-center text-white/10 text-[10px] font-black uppercase tracking-[0.4em]">
                      Awaiting Neural Handshake...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Radar Visualization Area */}
        <section className="w-[400px] flex flex-col shrink-0">
          <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
            <div className="text-[10px] text-[#45A29E] absolute top-4 left-4 font-black tracking-widest uppercase">Local_Spatial_Map</div>
            
            {/* Circular Radar */}
            <div className="w-[280px] h-[280px] rounded-full border border-[#45A29E]/30 relative flex items-center justify-center shadow-[inset_0_0_50px_rgba(102,252,241,0.05)] bg-[#0B0C10]/50 backdrop-blur-sm z-10">
              {/* Rings */}
              <div className="absolute w-[200px] h-[200px] rounded-full border border-[#45A29E]/20"></div>
              <div className="absolute w-[120px] h-[120px] rounded-full border border-[#45A29E]/10"></div>
              <div className="absolute w-[40px] h-[40px] rounded-full border border-[#45A29E]/10"></div>
              
              {/* Crosshairs */}
              <div className="absolute w-px h-full bg-[#45A29E]/20"></div>
              <div className="absolute w-full h-px bg-[#45A29E]/20"></div>
              
              {/* Sweep */}
              {isScanning && (
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full overflow-hidden"
                >
                   <div className="w-1/2 h-1/2 absolute bottom-1/2 right-1/2 origin-bottom-right bg-gradient-to-tr from-[#66FCF1]/20 to-transparent"></div>
                </motion.div>
              )}

              {/* Blips */}
              <AnimatePresence>
                {filteredDevices.map(device => {
                  const radius = (device.distance / 150) * 140; 
                  const x = Math.cos((device.angle * Math.PI) / 180) * radius;
                  const y = Math.sin((device.angle * Math.PI) / 180) * radius;
                  
                  return (
                    <motion.div 
                      key={device.id}
                      layout
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ 
                        opacity: 1, 
                        scale: selectedDeviceId === device.id ? 1.5 : 1, 
                        left: `calc(50% + ${x}px)`, 
                        top: `calc(50% + ${y}px)` 
                      }}
                      exit={{ opacity: 0, scale: 0 }}
                      className="absolute z-20 cursor-pointer"
                      onClick={() => setSelectedDeviceId(device.id)}
                      style={{ margin: '-4px' }}
                    >
                      <div 
                        className={`w-2 h-2 rounded-full border border-white/10 ${device.isTarget ? 'bg-[#FF4444] shadow-[0_0_10px_#FF4444]' : MAC_TYPES[device.type].bg + ' shadow-[0_0_5px_currentColor]'} ${selectedDeviceId === device.id ? 'ring-2 ring-white scale-110 opacity-100' : 'opacity-50'}`}
                      />
                      {device.isTarget && (
                        <motion.div 
                          animate={{ scale: [1, 3], opacity: [0.5, 0] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                          className="absolute inset-0 rounded-full bg-red-400"
                        />
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              
              {/* Center */}
              <div className="w-3 h-3 bg-[#66FCF1] rounded-full z-30 border-2 border-[#0B0C10] shadow-[0_0_10px_#66FCF1]"></div>
            </div>

            <div className="mt-12 w-full grid grid-cols-2 gap-4 text-[10px]">
              <div className="p-3 border border-[#1F2833] bg-[#1F2833]/20 rounded group">
                <div className="opacity-40 uppercase font-black mb-1 group-hover:opacity-70 transition-opacity">North Heading</div>
                <div className="text-sm font-bold text-[#66FCF1] flex items-center gap-2">
                  <motion.div 
                    animate={{ rotate: scanningTime * 10 }}
                    transition={{ type: 'spring', damping: 10 }}
                  >
                    <Activity className="w-3 h-3" />
                  </motion.div>
                  342° NW
                </div>
              </div>
              <div className="p-3 border border-[#1F2833] bg-[#1F2833]/20 rounded group">
                <div className="opacity-40 uppercase font-black mb-1 group-hover:opacity-70 transition-opacity">Signal Floor</div>
                <div className="text-sm font-bold text-[#66FCF1]">-94.2 dBm</div>
              </div>
            </div>
          </div>
          
          {/* Console Log */}
          <div className="h-48 border-t border-[#1F2833] bg-black p-4 font-mono text-[9px] text-[#45A29E] flex flex-col">
            <div className="flex justify-between items-center mb-3 border-b border-[#1F2833] pb-2">
              <span className="uppercase font-black tracking-[0.2em] opacity-80 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#45A29E]/30 animate-pulse"></div>
                Terminal Feedback
              </span>
              <span className="text-[#66FCF1] font-bold tabular-nums">0.0.0.0:8080</span>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5">
              <AnimatePresence>
                {logs.map((log) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 0.8, x: 0 }}
                    key={log.id} 
                    className={`flex gap-2 items-start ${log.message.includes('AI_ALERT') ? 'text-[#FF4444] border-l-2 border-[#FF4444] pl-2 bg-[#FF4444]/5 py-0.5' : ''}`}
                  >
                    <span className={`${log.message.includes('AI_ALERT') ? 'text-red-300' : 'text-[#66FCF1]/50'} shrink-0 font-bold tracking-tighter`}>[{log.timestamp}]</span>
                    <span className={`${log.message.includes('AI_ALERT') ? 'text-red-200 font-bold' : 'text-white'} break-words lowercase`}>{log.message}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {logs.length === 0 && (
                <div className="h-full flex items-center justify-center opacity-10 font-bold uppercase tracking-[0.5em] italic">
                  Buffers Empty
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Micro-Bar */}
      <footer className="h-8 bg-[#1F2833] flex items-center px-6 justify-between text-[10px] uppercase tracking-[0.2em] font-black text-[#45A29E] shrink-0 border-t border-white/5">
        <div className="flex gap-6 items-center">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_5px_#10b981]"></div>
            <span>Sensors: Online</span>
          </div>
          <div className="h-3 w-px bg-white/5"></div>
          <span>Buffer_Use: { Math.min(100, Math.floor(devices.length * 5)) }%</span>
          <div className="h-3 w-px bg-white/5"></div>
          <span className={devices.some(d => d.isTarget && d.distance < 20) ? 'text-red-500' : ''}>
            Threat_Level: {devices.some(d => d.isTarget && d.distance < 20) ? 'Critical' : devices.some(d => d.isTarget) ? 'Moderate' : 'Low'}
          </span>
        </div>
        <div className="hidden md:block opacity-50">© 2024 CYBER_SURV_LABS // ENCRYPTED_LINK_ESTABLISHED</div>
      </footer>
    </div>
  );
};

export default function App() {
  return <BLERadarSimulation />;
}


