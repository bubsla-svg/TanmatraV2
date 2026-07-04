import React, {useEffect, useState} from 'react';

export type ProtocolType = 'Wellness' | 'Performance' | 'Clinical';

interface ProtocolSwitcherProps {
  onProtocolChange: (protocol: ProtocolType) => void;
  activeProtocol: ProtocolType;
}

export const ProtocolSwitcher: React.FC<ProtocolSwitcherProps> = ({
  onProtocolChange,
  activeProtocol,
}) => {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibratedTheme, setCalibratedTheme] = useState(
    'border-emerald-500 bg-emerald-50/50 text-emerald-800',
  );

  useEffect(() => {
    // CRO-07: Trigger visible visual load feedback indicating menu recalibration
    setIsCalibrating(true);
    const timer = setTimeout(() => {
      setIsCalibrating(false);
    }, 850);

    switch (activeProtocol) {
      case 'Wellness':
        setCalibratedTheme(
          'border-emerald-500 bg-emerald-50/50 text-emerald-800',
        );
        break;
      case 'Performance':
        setCalibratedTheme('border-orange-500 bg-orange-50/50 text-orange-800');
        break;
      case 'Clinical':
        setCalibratedTheme('border-blue-500 bg-blue-50/50 text-blue-800');
        break;
    }

    return () => clearTimeout(timer);
  }, [activeProtocol]);

  return (
    <div className="w-full bg-white border-b border-slate-100 py-3 sticky top-14 z-40 shadow-sm transition-all duration-200">
      <div className="flex justify-between px-4 space-x-2">
        {/* Wellness Tab */}
        <button
          onClick={() => onProtocolChange('Wellness')}
          className={`flex-1 py-2.5 px-2 rounded-xl border flex flex-col items-center justify-center transition-all duration-200 ${
            activeProtocol === 'Wellness'
              ? calibratedTheme
              : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/20'
          }`}>
          <span className="text-[10px] font-bold tracking-wider uppercase">
            Wellness
          </span>
          <span className="text-[8px] text-slate-400 font-semibold mt-0.5">
            Longevity & Gut
          </span>
        </button>

        {/* Performance Tab */}
        <button
          onClick={() => onProtocolChange('Performance')}
          className={`flex-1 py-2.5 px-2 rounded-xl border flex flex-col items-center justify-center transition-all duration-200 ${
            activeProtocol === 'Performance'
              ? calibratedTheme
              : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50/20'
          }`}>
          <span className="text-[10px] font-bold tracking-wider uppercase">
            Performance
          </span>
          <span className="text-[8px] text-slate-400 font-semibold mt-0.5">
            Recovery & Build
          </span>
        </button>

        {/* Clinical Tab */}
        <button
          onClick={() => onProtocolChange('Clinical')}
          className={`flex-1 py-2.5 px-2 rounded-xl border flex flex-col items-center justify-center transition-all duration-200 ${
            activeProtocol === 'Clinical'
              ? calibratedTheme
              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/20'
          }`}>
          <span className="text-[10px] font-bold tracking-wider uppercase">
            Clinical
          </span>
          <span className="text-[8px] text-slate-400 font-semibold mt-0.5">
            Therapeutic Care
          </span>
        </button>
      </div>

      {/* Connected Sync Status Bar */}
      <div className="mt-2.5 mx-4 flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200/50 rounded-lg">
        <div className="flex items-center space-x-1.5">
          <div className="relative">
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
            Garmin & Apple Watch Sync Active
          </span>
        </div>
        <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
          Biometrics Updated: 11:00 AM
        </span>
      </div>

      {/* Recalibration Pulse Loader */}
      {isCalibrating && (
        <div className="absolute inset-x-0 bottom-[-4px] h-[4px] bg-slate-100 overflow-hidden">
          <div
            className={`h-full ${
              activeProtocol === 'Wellness'
                ? 'bg-emerald-500'
                : activeProtocol === 'Performance'
                  ? 'bg-orange-500'
                  : 'bg-blue-500'
            } animate-pulse w-full`}
            style={{animationDuration: '0.85s'}}></div>
        </div>
      )}
    </div>
  );
};
