import { supabase } from './supabase';

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  admin_reply: string | null;
  status: 'Open' | 'Resolved';
  created_at: string;
  // Joins
  users?: {
    name: string;
    email: string;
  };
}

// User: Create a new ticket
export async function createTicket(subject: string, message: string) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const { error } = await supabase.from('support_tickets').insert({
    user_id: userData.user.id,
    subject,
    message,
  });

  if (error) throw error;
}

// User: Get their own tickets
export async function getUserTickets() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as SupportTicket[];
}

// Admin: Get all tickets
export async function getAllTickets() {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*, users(name, email)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as SupportTicket[];
}

// Admin: Reply to ticket
export async function replyToTicket(ticketId: string, reply: string, status: 'Open' | 'Resolved' = 'Resolved') {
  const { error } = await supabase
    .from('support_tickets')
    .update({ admin_reply: reply, status })
    .eq('id', ticketId);

  if (error) throw error;
}
