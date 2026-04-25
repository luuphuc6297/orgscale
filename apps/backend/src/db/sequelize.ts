import { Sequelize } from 'sequelize-typescript';
import type { Env } from '../config/env';

export function createSequelize(env: Env): Sequelize {
  const url = env.NODE_ENV === 'test' && env.TEST_DATABASE_URL
    ? env.TEST_DATABASE_URL
    : env.DATABASE_URL;

  return new Sequelize(url, {
    dialect: 'postgres',
    logging: env.NODE_ENV === 'test' ? false : (sql) => process.env.DB_DEBUG && console.log(sql),
    define: {
      underscored: true,
      timestamps: true,
    },
  });
}
