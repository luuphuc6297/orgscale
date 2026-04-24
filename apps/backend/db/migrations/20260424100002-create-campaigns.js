'use strict';
module.exports = {
  async up(qi, Sequelize) {
    await qi.sequelize.query(
      "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='campaign_status') THEN CREATE TYPE campaign_status AS ENUM ('draft','scheduled','sending','sent'); END IF; END $$;"
    );
    await qi.createTable('campaigns', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      name: { type: Sequelize.STRING(200), allowNull: false },
      subject: { type: Sequelize.STRING(255), allowNull: false },
      body: { type: Sequelize.TEXT, allowNull: false },
      status: { type: 'campaign_status', allowNull: false, defaultValue: 'draft' },
      scheduled_at: { type: Sequelize.DATE, allowNull: true },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await qi.addIndex('campaigns', ['created_by', 'status'], { name: 'campaigns_owner_status_idx' });
    await qi.addIndex('campaigns', ['scheduled_at'], {
      name: 'campaigns_scheduled_at_idx',
      where: { status: 'scheduled' },
    });
  },
  async down(qi) {
    await qi.dropTable('campaigns');
    await qi.sequelize.query('DROP TYPE IF EXISTS campaign_status;');
  },
};
