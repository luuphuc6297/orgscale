import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '../users/user.model';
import { AppError, ErrorCodes } from '../common/errors/app.error';
import type { RegisterInput, LoginInput } from './auth.schemas';

const BCRYPT_SALT_ROUNDS = 10;

export class AuthService {
  constructor(
    private readonly userModel: typeof User,
    private readonly jwtSecret: string,
    private readonly jwtExpiresIn: string,
  ) {}

  async register(input: RegisterInput) {
    const existing = await this.userModel.findOne({ where: { email: input.email } });
    if (existing) {
      throw new AppError(ErrorCodes.CONFLICT, 'Email already registered', 409);
    }
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
    const user = await this.userModel.create({
      email: input.email,
      name: input.name,
      passwordHash,
    } as any);
    return this.excludePassword(user);
  }

  async login(input: LoginInput) {
    const user = await this.userModel
      .scope('withPassword')
      .findOne({ where: { email: input.email } });
    if (!user) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 'Invalid credentials', 401);
    }
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 'Invalid credentials', 401);
    }
    const token = jwt.sign(
      { sub: user.id, email: user.email },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn } as SignOptions,
    );
    return { token, user: this.excludePassword(user) };
  }

  private excludePassword(user: User): Record<string, unknown> {
    const plain = user.get({ plain: true }) as unknown as Record<string, unknown>;
    delete plain.passwordHash;
    return plain;
  }
}
