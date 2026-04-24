require('dotenv').config();

const common = {
  dialect: 'postgres',
  use_env_variable: 'DATABASE_URL',
  logging: false,
  define: {
    underscored: true,
    timestamps: true,
  },
};

module.exports = {
  development: { ...common },
  test: {
    ...common,
    use_env_variable: 'TEST_DATABASE_URL',
  },
  production: { ...common },
};
