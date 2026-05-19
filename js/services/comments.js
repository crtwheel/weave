const sbComments = {
  list: async (templateId) => {
    try {
      return await sbSelect('comments', { eq: ['template_id', templateId], select: '*,user:profiles(email)', order: 'created_at', orderDir: 'asc' });
    } catch (err) { sbLog.warn('Comments: list failed', err); return []; }
  },
  create: async (templateId, content) => {
    const user = await sbGetUser();
    if (!user) throw new Error('Not authenticated');
    return await sbInsert('comments', { user_id: user.id, template_id: templateId, content });
  },
  reply: async (parentId, content) => {
    const user = await sbGetUser();
    if (!user) throw new Error('Not authenticated');
    const parent = await sbSelect('comments', { eq: ['id', parentId], single: true });
    return await sbInsert('comments', { user_id: user.id, template_id: parent.template_id, parent_id: parentId, content });
  },
  delete: async (id) => {
    return await sbDelete('comments', id);
  }
};
