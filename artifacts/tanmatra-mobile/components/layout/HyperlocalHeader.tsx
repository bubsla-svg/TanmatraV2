import React, {useState} from 'react';

export const HyperlocalHeader: React.FC = () => {
  const [address, setAddress] = useState('Sector 62, Noida NCR');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() || postalCode.trim()) {
      setAddress(searchQuery || `PIN: ${postalCode}, Noida`);
      setIsModalOpen(false);
    }
  };

  return (
    <>
      <header className="w-full bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-emerald-500/20 sticky top-0 z-50">
        <div className="flex items-center space-x-2">
          <svg
            className="w-5 h-5 text-emerald-400 animate-pulse"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <div>
            <p className="text-[9px] text-slate-400 font-bold tracking-wider uppercase">
              DELIVERING TO
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-xs font-semibold flex items-center focus:outline-none text-slate-100 hover:text-emerald-400 transition-colors duration-150">
              <span>{address}</span>
              <svg
                className="w-3.5 h-3.5 ml-1 text-emerald-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 mr-1.5 bg-emerald-400 rounded-full animate-ping"></span>
            32 MINS
          </span>
        </div>
      </header>

      {/* Hyperlocal Address Verification Escape Hatch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 transform transition-all scale-100">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Verify Your Delivery Location
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Tanmatra delivers fresh in 25–40 mins from ISO 22000 sterile
                    cloud kitchens. Verify your sector below.
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors duration-150">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveAddress} className="space-y-4">
                <div>
                  <label
                    htmlFor="searchQuery"
                    className="text-[10px] font-bold uppercase text-slate-500 block mb-1.5">
                    Enter Delivery Address / Sector
                  </label>
                  <input
                    type="text"
                    id="searchQuery"
                    value={searchQuery}
                    onChange={(e: any) => setSearchQuery(e.target.value)}
                    placeholder="e.g. Sector 62, Noida"
                    className="w-full px-4 py-3 border border-slate-200 focus:border-emerald-500 rounded-xl text-sm font-semibold outline-none transition-all duration-150 text-slate-900 placeholder:text-slate-400 bg-slate-50"
                  />
                </div>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    or
                  </span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <div>
                  <label
                    htmlFor="postalCode"
                    className="text-[10px] font-bold uppercase text-slate-500 block mb-1.5">
                    Postal PIN Code
                  </label>
                  <input
                    type="text"
                    id="postalCode"
                    maxLength={6}
                    value={postalCode}
                    onChange={(e: any) =>
                      setPostalCode(e.target.value.replace(/\D/g, ''))
                    }
                    placeholder="e.g. 201301"
                    className="w-full px-4 py-3 border border-slate-200 focus:border-emerald-500 rounded-xl text-sm font-bold tracking-widest outline-none transition-all duration-150 text-slate-900 placeholder:text-slate-400 bg-slate-50"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAddress('Sector 62, Noida NCR');
                    setIsModalOpen(false);
                  }}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center space-x-2 text-xs font-bold text-slate-700 transition-colors duration-150">
                  <svg
                    className="w-4 h-4 text-emerald-500"
                    fill="currentColor"
                    viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Use Live Device GPS Location</span>
                </button>

                <div className="pt-2 border-t border-slate-100 flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 text-slate-600 font-bold text-xs hover:bg-slate-50 rounded-xl transition-colors duration-150">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-slate-900 text-white font-bold text-xs rounded-xl shadow-lg hover:bg-slate-800 transition-colors duration-150">
                    Confirm Location
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
