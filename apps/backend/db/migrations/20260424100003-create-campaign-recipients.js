'use strict';
module.exports = {
  async up(qi, Sequelize) {
    await qi.sequelize.query(
      "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='recipient_status') THEN CREATE TYPE recipient_status AS ENUM ('pending','sent','failed'); END IF; END $$;"
    );
    await qi.createTable('campaign_recipients', {
      campaign_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'campaigns', key: 'id' },
        onDelete: 'CASCADE',
      },
      recipient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'recipients', key: 'id' },
        onDelete: 'RESTRICT',
      },
      status: { type: 'recipient_status', allowNull: false, defaultValue: 'pending' },
      sent_at: { type: Sequelize.DATE, allowNull: true },
      opened_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await qi.addIndex('campaign_recipients', ['campaign_id', 'status'], {
      name: 'cr_campaign_status_idx',
    });
    await qi.addIndex('campaign_recipients', ['recipient_id'], {
      name: 'cr_recipient_idx',
    });
  },
  async down(qi) {
    await qi.dropTable('campaign_recipients');
    await qi.sequelize.query('DROP TYPE IF EXISTS recipient_status;');
  },
};
