import { plainToInstance } from 'class-transformer';
import { IsIn, IsNumberString, IsOptional, IsString, MinLength, validateSync } from 'class-validator';

export class EnvVars {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @IsOptional()
  @IsNumberString()
  PORT?: string;

  @IsString()
  DATABASE_URL!: string;

  @IsOptional()
  @IsString()
  TEST_DATABASE_URL?: string;

  @IsString()
  @MinLength(8)
  JWT_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;

  @IsOptional()
  @IsNumberString()
  SEND_SUCCESS_RATE?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;
}

export function validateEnv(raw: Record<string, unknown>): EnvVars {
  const validated = plainToInstance(EnvVars, raw, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid env: ${errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('; ')}`);
  }
  return validated;
}
