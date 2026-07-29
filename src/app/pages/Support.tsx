import { useState, useEffect } from 'react';
import { createTicket, getUserTickets, SupportTicket } from '@/lib/support';

export default function Support() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const data = await getUserTickets();
      setTickets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setFetchLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !message) return;
    setLoading(true);
    try {
      await createTicket(subject, message);
      setSubject('');
      setMessage('');
      await loadTickets();
      alert('Ticket submitted successfully!');
    } catch (err: any) {
      alert(err.message || 'Error submitting ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#111114] p-6 rounded-2xl border border-white/5">
        <h2 className="text-xl font-bold text-white mb-4">Contact Support</h2>
        <p className="text-slate-400 text-sm mb-6">
          Share your glitches, withdraw errors, deposit errors, or any other issues. Our admin will reply to you here.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Subject</label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              placeholder="e.g. Deposit not received"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Message</label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
              placeholder="Please describe your issue in detail..."
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </form>
      </div>

      <div className="bg-[#111114] p-6 rounded-2xl border border-white/5">
        <h2 className="text-xl font-bold text-white mb-6">Your Tickets</h2>
        
        {fetchLoading ? (
          <div className="text-slate-400">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="text-slate-400 text-center py-8 bg-black/20 rounded-xl">
            You haven't submitted any tickets yet.
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map(ticket => (
              <div key={ticket.id} className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white">{ticket.subject}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    ticket.status === 'Resolved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {ticket.status}
                  </span>
                </div>
                <p className="text-sm text-slate-300 bg-black/50 p-3 rounded-lg border border-white/5">
                  {ticket.message}
                </p>
                {ticket.admin_reply && (
                  <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <p className="text-xs font-semibold text-emerald-400 mb-1">Admin Reply:</p>
                    <p className="text-sm text-slate-200">{ticket.admin_reply}</p>
                  </div>
                )}
                <div className="text-xs text-slate-500">
                  {new Date(ticket.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
