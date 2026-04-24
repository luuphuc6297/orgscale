import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/user.model';
import { AppError, ErrorCodes } from '../common/errors/app.error';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userModel.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new AppError(ErrorCodes.CONFLICT, 'Email already registered', 409);
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userModel.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    } as any);
    const safe = user.get({ plain: true }) as any;
    delete safe.passwordHash;
    return safe;
  }

  async login(dto: LoginDto) {
    const user = await this.userModel.scope('withPassword').findOne({ where: { email: dto.email } });
    if (!user) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 'Invalid credentials', 401);
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 'Invalid credentials', 401);
    }
    const token = await this.jwt.signAsync(
      { sub: user.id, email: user.email },
      { expiresIn: this.config.get<string>('JWT_EXPIRES_IN') ?? '7d' },
    );
    const safe = user.get({ plain: true }) as any;
    delete safe.passwordHash;
    return { token, user: safe };
  }
}
