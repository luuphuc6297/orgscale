'use strict';
module.exports = {
  async up(qi, Sequelize) {
    await qi.sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
    await qi.createTable('users', {
      id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.literal('gen_random_uuid()') },
      email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(120), allowNull: false },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await qi.addIndex('users', ['email'], { unique: true, name: 'users_email_unique' });
  },
  async down(qi) {
    await qi.dropTable('users');
  },
};
