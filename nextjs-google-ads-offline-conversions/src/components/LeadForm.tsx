'use client';

import React, { useState } from 'react';

export interface HostSubmitResult {
  success: boolean;
  conversionPrepared?: boolean;
  error?: string;
}

export interface LeadFormProps {
  /** Pass a host-owned server action wrapper. The client never receives a provider payload. */
  onSubmit: (formData: FormData) => Promise<HostSubmitResult>;
}

export function LeadForm({ onSubmit }: LeadFormProps) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<HostSubmitResult | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');

    const form = event.currentTarget;
    const res = await onSubmit(new FormData(form));
    setResult(res);
    if (res.success) {
      setStatus('success');
      form.reset();
    } else {
      setStatus('error');
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Request a Demo</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Full Name</label>
          <input type="text" name="fullName" required className="w-full mt-1 px-3 py-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email Address</label>
          <input type="email" name="email" required className="w-full mt-1 px-3 py-2 border rounded-md" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Phone Number</label>
          <input type="tel" name="phone" className="w-full mt-1 px-3 py-2 border rounded-md" placeholder="+1 555 019 2834" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Company</label>
          <input type="text" name="company" className="w-full mt-1 px-3 py-2 border rounded-md" />
        </div>
        <button type="submit" disabled={status === 'submitting'} className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-md disabled:opacity-50">
          {status === 'submitting' ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>

      {status === 'success' && (
        <div className="mt-4 p-3 bg-green-50 text-green-800 rounded border border-green-200">
          Form accepted for host hand-off. Conversion preparation is server-owned and consent-gated.
          {result?.conversionPrepared ? ' A server-side queue entry was prepared.' : ' No provider payload was prepared.'}
        </div>
      )}

      {status === 'error' && (
        <div className="mt-4 p-3 bg-red-50 text-red-800 rounded border border-red-200">
          Error: {result?.error}
        </div>
      )}
    </div>
  );
}
