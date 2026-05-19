const sbBusinesses = {
  list: async (approved = true) => {
    return await sbSelect('business_listings', { eq: ['approved', approved], order: 'created_at', orderDir: 'desc' });
  },
  get: async (slug) => {
    return await sbSelect('business_listings', { eq: ['slug', slug], single: true });
  },
  create: async (data) => {
    const user = await sbGetUser();
    if (!user) throw new Error('Not authenticated');
    return await sbInsert('business_listings', { ...data, user_id: user.id });
  },
  update: async (id, data) => {
    return await sbUpdate('business_listings', id, data);
  },
  approve: async (id) => {
    return await sbUpdate('business_listings', id, { approved: true });
  },
  listAll: async () => {
    return await sbSelect('business_listings', { order: 'created_at', orderDir: 'desc' });
  },
  myListings: async () => {
    const user = await sbGetUser();
    if (!user) return [];
    return await sbSelect('business_listings', { eq: ['user_id', user.id] });
  }
};
