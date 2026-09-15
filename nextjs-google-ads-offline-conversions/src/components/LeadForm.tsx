'use client';

import React, { useState } from 'react';
import { submitLeadAction, SubmitLeadResult } from '../app/actions/submit-lead.ts';

export function LeadForm() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<SubmitLeadResult | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');

    const form = event.currentTarget;
    const formData = new FormData(form);

    // Call Next.js Server Action
    const res = await submitLeadAction(formData, {
      cookieHeader: typeof document !== 'undefined' ? document.cookie : '',
    });

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
          <input
            type="text"
            name="fullName"
            required
            className="w-full mt-1 px-3 py-2 border rounded-md"
            placeholder="Ada Lovelace"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email Address</label>
          <input
            type="email"
            name="email"
            required
            className="w-full mt-1 px-3 py-2 border rounded-md"
            placeholder="ada@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Phone Number</label>
          <input
            type="tel"
            name="phone"
            className="w-full mt-1 px-3 py-2 border rounded-md"
            placeholder="+1 (555) 019-2834"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Company</label>
          <input
            type="text"
            name="company"
            className="w-full mt-1 px-3 py-2 border rounded-md"
            placeholder="Analytical Engine Corp"
          />
        </div>
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {status === 'submitting' ? 'Submitting...' : 'Submit Request'}
        </button>
      </form>

      {status === 'success' && (
        <div className="mt-4 p-3 bg-green-50 text-green-800 rounded border border-green-200">
          Lead captured! Google Ads offline conversion payload prepared.
          <pre className="mt-2 text-xs overflow-x-auto bg-green-100 p-2 rounded">
            {JSON.stringify(result?.conversionPayload, null, 2)}
          </pre>
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
