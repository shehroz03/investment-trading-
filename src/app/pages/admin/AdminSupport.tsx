import { useState, useEffect } from 'react';
import { getAllTickets, replyToTicket, SupportTicket } from '@/lib/support';
import { RefreshCcw, CheckCircle, MessageSquare } from 'lucide-react';

export default function AdminSupport() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [submitting, setSubmitting] = useState<{ [key: string]: boolean }>({});

  const loadTickets = async () => {
    setLoading(true);
    try {
      const data = await getAllTickets();
      setTickets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleReply = async (ticketId: string) => {
    const text = replyText[ticketId];
    if (!text) return;

    setSubmitting(prev => ({ ...prev, [ticketId]: true }));
    try {
      await replyToTicket(ticketId, text, 'Resolved');
      alert('Reply sent and ticket resolved!');
      await loadTickets();
    } catch (err: any) {
      alert(err.message || 'Error replying to ticket');
    } finally {
      setSubmitting(prev => ({ ...prev, [ticketId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Support Tickets</h2>
          <p className="text-slate-400 text-sm">Manage user issues, glitches, and requests</p>
        </div>
        <button 
          onClick={loadTickets}
          disabled={loading}
          className="p-2 bg-black/50 hover:bg-white/5 border border-white/10 rounded-lg text-slate-300 transition-colors disabled:opacity-50"
        >
          <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-[#111114] border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No support tickets found.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {tickets.map(ticket => (
              <div key={ticket.id} className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-white text-lg">{ticket.subject}</h3>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full ${
                        ticket.status === 'Resolved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {ticket.status}
                      </span>
                    </div>
                    <div className="text-sm text-slate-400 flex items-center gap-2">
                      <span className="text-white/70">{ticket.users?.name}</span>
                      <span>•</span>
                      <span>{ticket.users?.email}</span>
                      <span>•</span>
                      <span>{new Date(ticket.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-black/50 p-4 rounded-xl border border-white/5 text-slate-300">
                  <div className="flex items-center gap-2 mb-2 text-slate-400">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">User Message</span>
                  </div>
                  {ticket.message}
                </div>

                {ticket.admin_reply ? (
                  <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-2 text-emerald-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs font-medium uppercase tracking-wider">Admin Reply</span>
                    </div>
                    <p className="text-emerald-50/90">{ticket.admin_reply}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      rows={3}
                      value={replyText[ticket.id] || ''}
                      onChange={(e) => setReplyText(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                      placeholder="Type your reply to resolve this ticket..."
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 text-sm"
                    />
                    <button
                      onClick={() => handleReply(ticket.id)}
                      disabled={!replyText[ticket.id] || submitting[ticket.id]}
                      className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors text-sm"
                    >
                      {submitting[ticket.id] ? 'Sending...' : 'Send Reply & Resolve'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
