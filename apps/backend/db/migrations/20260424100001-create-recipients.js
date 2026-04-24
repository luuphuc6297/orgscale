'use strict';
module.exports = {
  async up(qi, Sequelize) {
    await qi.createTable('recipients', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(120), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await qi.addIndex('recipients', ['email'], { unique: true, name: 'recipients_email_unique' });
  },
  async down(qi) {
    await qi.dropTable('recipients');
  },
};
