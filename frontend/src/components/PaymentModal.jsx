import React, { useState } from 'react';
import { CreditCard, QrCode, Landmark, Landmark as CashIcon, ShieldCheck, X } from 'lucide-react';

export default function PaymentModal({ isOpen, onClose, totalAmount, onPaymentSuccess }) {
  const [activeTab, setActiveTab] = useState('card'); // card, upi, netbanking, cod
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState('');

  if (!isOpen) return null;

  const handlePay = () => {
    setIsProcessing(true);
    setProcessStep('Connecting to secure gateway...');
    
    setTimeout(() => {
      setProcessStep('Verifying account balance...');
      
      setTimeout(() => {
        setProcessStep('Authorizing secure transaction...');
        
        setTimeout(() => {
          setIsProcessing(false);
          onPaymentSuccess(activeTab === 'cod' ? 'COD' : 'Online');
        }, 1500);
      }, 1200);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-dark-card border border-dark-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-dark-border">
          <div>
            <h3 className="font-heading text-lg font-bold text-white">GoaSip Gateway</h3>
            <p className="text-xs text-dark-text-muted">Secure Sandbox Payment</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-dark-text-muted hover:text-white hover:bg-dark-border transition">
            <X size={20} />
          </button>
        </div>

        {/* Amount bar */}
        <div className="bg-dark-surface px-5 py-3 border-b border-dark-border flex justify-between items-center">
          <span className="text-sm text-dark-text-muted">Total Amount</span>
          <span className="text-lg font-bold text-gold-500">₹{totalAmount}</span>
        </div>

        {/* Content */}
        {!isProcessing ? (
          <div className="flex flex-col md:flex-row flex-1 min-h-[300px]">
            {/* Tabs */}
            <div className="w-full md:w-2/5 border-r border-dark-border flex md:flex-col overflow-x-auto md:overflow-x-visible">
              {[
                { id: 'card', name: 'Cards', icon: CreditCard },
                { id: 'upi', name: 'UPI / QR', icon: QrCode },
                { id: 'netbanking', name: 'Net Banking', icon: Landmark },
                { id: 'cod', name: 'Cash on Delivery', icon: CashIcon }
              ].map(tab => {
                const Icon = tab.icon;
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 px-5 py-4 text-sm font-medium text-left border-b md:border-b-0 md:border-l-2 transition shrink-0 ${
                      isSelected 
                        ? 'border-gold-500 bg-gold-500/5 text-gold-500' 
                        : 'border-transparent text-dark-text-muted hover:text-white hover:bg-dark-border/20'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Panels */}
            <div className="flex-1 p-5 flex flex-col justify-between">
              <div>
                {activeTab === 'card' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-dark-text-muted mb-1 uppercase tracking-wider">Card Number</label>
                      <input 
                        type="text" 
                        placeholder="4111 2222 3333 4444" 
                        defaultValue="4111 2222 3333 4444"
                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:border-gold-500 focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-dark-text-muted mb-1 uppercase tracking-wider">Expiry Date</label>
                        <input 
                          type="text" 
                          placeholder="MM/YY" 
                          defaultValue="12/29"
                          className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:border-gold-500 focus:outline-none text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-dark-text-muted mb-1 uppercase tracking-wider">CVV</label>
                        <input 
                          type="password" 
                          placeholder="•••" 
                          defaultValue="123"
                          className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:border-gold-500 focus:outline-none text-center"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'upi' && (
                  <div className="flex flex-col items-center justify-center text-center space-y-4">
                    <div className="p-3 bg-white rounded-xl border-4 border-gold-300">
                      {/* Simulated QR Code */}
                      <div className="w-28 h-28 bg-dark-bg flex items-center justify-center text-white border border-dark-border relative">
                        <QrCode size={80} className="text-gold-500" />
                        <span className="absolute bottom-1 text-[8px] tracking-widest text-gold-500 font-bold bg-dark-card px-1 rounded">GOASIP UPI</span>
                      </div>
                    </div>
                    <p className="text-xs text-dark-text-muted">Scan QR with Google Pay, PhonePe, or Paytm</p>
                    <div className="w-full">
                      <span className="text-xs text-dark-text-muted block mb-1">Or enter UPI ID</span>
                      <input 
                        type="text" 
                        placeholder="username@upi" 
                        defaultValue="goasip@ybl"
                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-white text-sm focus:border-gold-500 focus:outline-none text-center"
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'netbanking' && (
                  <div className="space-y-4">
                    <span className="text-xs text-dark-text-muted block">Select Your Bank</span>
                    <div className="grid grid-cols-2 gap-2">
                      {['HDFC Bank', 'ICICI Bank', 'SBI Bank', 'Axis Bank'].map(bank => (
                        <button key={bank} className="px-3 py-2 text-xs font-semibold text-center border border-dark-border rounded-lg text-dark-text-muted hover:text-white hover:border-gold-500 bg-dark-surface/50 hover:bg-gold-500/5 transition">
                          {bank}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'cod' && (
                  <div className="text-center py-6 space-y-3">
                    <div className="inline-flex items-center justify-center p-3 rounded-full bg-gold-500/10 text-gold-500 border border-gold-500/30">
                      <CashIcon size={32} />
                    </div>
                    <h4 className="text-sm font-bold text-white">Cash/UPI on Delivery</h4>
                    <p className="text-xs text-dark-text-muted max-w-[240px] mx-auto">
                      Pay using Cash or Scan delivery partner's QR code at your doorstep upon arrival.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-6">
                <button
                  onClick={handlePay}
                  className="w-full py-3 bg-gold-500 hover:bg-gold-600 active:scale-95 transition text-black font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-gold-500/20"
                >
                  <ShieldCheck size={18} />
                  <span>{activeTab === 'cod' ? 'Confirm Delivery Order' : 'Pay Safely via Sandbox'}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Processing State */
          <div className="p-10 min-h-[350px] flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative flex items-center justify-center">
              <span className="w-16 h-16 border-4 border-dark-border border-t-gold-500 rounded-full animate-spin" />
              <ShieldCheck className="absolute text-gold-500" size={24} />
            </div>
            <div>
              <h4 className="font-heading text-lg font-bold text-white">Securing Sandbox Transaction</h4>
              <p className="text-sm text-gold-500 mt-2 font-mono h-6">{processStep}</p>
            </div>
            <p className="text-xs text-dark-text-muted max-w-[300px]">
              This is a simulated transaction. Please do not close this modal or refresh the page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
