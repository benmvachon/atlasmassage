import { api } from './api.js';

export const giftCardService = {
  async purchase({ purchaserEmail, purchaserName, recipientEmail, recipientName, message, amountCents }) {
    const res = await api.post('/gift-cards/purchase', {
      purchaserEmail,
      purchaserName,
      recipientEmail,
      recipientName,
      message,
      amountCents,
    });
    return res.data;
  },

  async validate(code) {
    const res = await api.get(`/gift-cards/${encodeURIComponent(code)}/validate`);
    return res.data;
  },
};
