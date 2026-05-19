const sbAds = {
  list: async (placement) => {
    try {
      const data = await sbSelect('ads', { eq: [['active', true], ['placement', placement]], limit: 5 });
      return data || [];
    } catch (err) { sbLog.warn('Ads: list failed', err); return []; }
  },
  create: async (data) => {
    return await sbInsert('ads', data);
  },
  update: async (id, data) => {
    return await sbUpdate('ads', id, data);
  },
  delete: async (id) => {
    return await sbDelete('ads', id);
  },
  trackImpression: async (id) => {
    const ad = await sbSelect('ads', { eq: ['id', id], single: true });
    if (ad) await sbUpdate('ads', id, { impressions: (ad.impressions || 0) + 1 });
  },
  trackClick: async (id) => {
    const ad = await sbSelect('ads', { eq: ['id', id], single: true });
    if (ad) await sbUpdate('ads', id, { clicks: (ad.clicks || 0) + 1 });
  },
  adminList: async () => {
    return await sbSelect('ads', { order: 'created_at', orderDir: 'desc' });
  }
};
