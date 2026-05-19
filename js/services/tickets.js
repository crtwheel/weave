const sbTickets = {
  list: async () => {
    const user = await sbGetUser();
    if (!user) return [];
    return await sbSelect('tickets', { eq: ['user_id', user.id], order: 'created_at', orderDir: 'desc' });
  },
  listAll: async () => {
    return await sbSelect('tickets', { order: 'created_at', orderDir: 'desc' });
  },
  create: async (subject, priority = 'normal') => {
    const user = await sbGetUser();
    if (!user) throw new Error('Not authenticated');
    return await sbInsert('tickets', { user_id: user.id, subject, priority });
  },
  get: async (id) => {
    const ticket = await sbSelect('tickets', { eq: ['id', id], single: true });
    const messages = await sbSelect('ticket_messages', { eq: ['ticket_id', id], order: 'created_at', orderDir: 'asc' });
    return { ...ticket, messages };
  },
  addMessage: async (ticketId, content) => {
    const user = await sbGetUser();
    if (!user) throw new Error('Not authenticated');
    const msg = await sbInsert('ticket_messages', { ticket_id: ticketId, user_id: user.id, content });
    await sbUpdate('tickets', ticketId, { updated_at: new Date().toISOString() });
    return msg;
  },
  updateStatus: async (id, status) => {
    return await sbUpdate('tickets', id, { status });
  }
};
