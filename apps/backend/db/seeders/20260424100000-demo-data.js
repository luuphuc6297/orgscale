'use strict';
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

module.exports = {
  async up(qi) {
    const userId = randomUUID();
    const passwordHash = await bcrypt.hash('password123', 10);
    await qi.bulkInsert('users', [
      { id: userId, email: 'demo@example.com', name: 'Demo Marketer', password_hash: passwordHash, created_at: new Date(), updated_at: new Date() },
    ]);

    const recipientIds = [];
    const recipients = [];
    for (let i = 1; i <= 20; i++) {
      const id = randomUUID();
      recipientIds.push(id);
      recipients.push({ id, email: `subscriber${i}@example.com`, name: `Subscriber ${i}`, created_at: new Date(), updated_at: new Date() });
    }
    await qi.bulkInsert('recipients', recipients);

    const now = new Date();
    const campaigns = [
      { id: randomUUID(), status: 'draft', name: 'Spring Sale Draft', subject: 'Spring deals coming soon', scheduled_at: null },
      { id: randomUUID(), status: 'scheduled', name: 'Newsletter #42', subject: 'Weekly roundup', scheduled_at: new Date(now.getTime() + 24 * 3600 * 1000) },
      { id: randomUUID(), status: 'sent', name: 'Welcome series', subject: 'Welcome aboard!', scheduled_at: new Date(now.getTime() - 7 * 24 * 3600 * 1000) },
    ];
    await qi.bulkInsert('campaigns', campaigns.map((c) => ({
      id: c.id, name: c.name, subject: c.subject, body: `Body for ${c.name}`,
      status: c.status, scheduled_at: c.scheduled_at, created_by: userId,
      created_at: now, updated_at: now,
    })));

    const crRows = [];
    for (const rid of recipientIds.slice(0, 10)) {
      crRows.push({ campaign_id: campaigns[0].id, recipient_id: rid, status: 'pending', sent_at: null, opened_at: null, created_at: now, updated_at: now });
    }
    for (const rid of recipientIds.slice(0, 15)) {
      crRows.push({ campaign_id: campaigns[1].id, recipient_id: rid, status: 'pending', sent_at: null, opened_at: null, created_at: now, updated_at: now });
    }
    for (let i = 0; i < recipientIds.length; i++) {
      const sent = i < 17;
      const opened = sent && i % 3 === 0;
      crRows.push({
        campaign_id: campaigns[2].id, recipient_id: recipientIds[i],
        status: sent ? 'sent' : 'failed',
        sent_at: sent ? now : null,
        opened_at: opened ? now : null,
        created_at: now, updated_at: now,
      });
    }
    await qi.bulkInsert('campaign_recipients', crRows);
  },

  async down(qi) {
    await qi.bulkDelete('campaign_recipients', null);
    await qi.bulkDelete('campaigns', null);
    await qi.bulkDelete('recipients', null);
    await qi.bulkDelete('users', null);
  },
};
