import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
  Inject,
} from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { User, UserRole } from '../database/entities/User.entity';
import { PasswordUtil } from './utils/password.util';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/** Refresh tokens are valid for 7 days — denylist entries live the same duration */
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 604800

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly passwordUtil: PasswordUtil,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstname, lastname } = registerDto;

    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await this.passwordUtil.hashPassword(password);

    const newUser = this.userRepository.create({
      email,
      password: hashedPassword,
      firstname,
      lastname,
      role: UserRole.OPERATOR,
      isActive: true,
    });

    try {
      const savedUser = await this.userRepository.save(newUser);
      this.logger.log(`New user registered: ${email}`);

      const { access_token, refresh_token } = await this.generateTokens(savedUser);
      return { access_token, refresh_token, user: this.getUserResponse(savedUser) };
    } catch (error) {
      this.logger.error(`User registration failed: ${email}`, error);
      throw new BadRequestException('Failed to create user');
    }
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid email or password');
    if (!user.isActive) throw new UnauthorizedException('User account is disabled');

    const isPasswordValid = await this.passwordUtil.comparePasswords(password, user.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid email or password');

    this.logger.log(`User logged in: ${email}`);
    const { access_token, refresh_token } = await this.generateTokens(user);
    return { access_token, refresh_token, user: this.getUserResponse(user) };
  }

  async validateUser(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or account disabled');
    }
    return user;
  }

  async logout(user: User, refreshToken?: string) {
    if (refreshToken) {
      await this.denylistToken(refreshToken);
    }
    this.logger.log(`User logged out: ${user.email}`);
    return { message: 'Logged out successfully' };
  }

  async refreshToken(refreshToken: string) {
    // Check denylist before trusting the token
    const isDenylisted = await this.cacheManager.get<string>(
      this.denylistKey(refreshToken),
    );
    if (isDenylisted) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.getRefreshSecret(),
      });
      const user = await this.validateUser(payload.sub);

      // Rotate: denylist the used token, issue a new pair
      await this.denylistToken(refreshToken);
      const tokens = await this.generateTokens(user);

      return { ...tokens, user: this.getUserResponse(user) };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // ─── Profile update ────────────────────────────────────────────────────────

  async updateProfile(user: User, dto: UpdateProfileDto) {
    if (dto.firstname !== undefined) user.firstname = dto.firstname;
    if (dto.lastname !== undefined) user.lastname = dto.lastname;
    if (dto.password !== undefined) {
      user.password = await this.passwordUtil.hashPassword(dto.password);
    }
    const saved = await this.userRepository.save(user);
    this.logger.log(`Profile updated: ${user.email}`);
    return this.getUserResponse(saved);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async generateTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };

    const access_token = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refresh_token = this.jwtService.sign(payload, {
      secret: this.getRefreshSecret(),
      expiresIn: '7d',
    });

    return { access_token, refresh_token };
  }

  private async denylistToken(token: string): Promise<void> {
    await this.cacheManager.set(
      this.denylistKey(token),
      '1',
      REFRESH_TOKEN_TTL_SECONDS * 1000,
    );
  }

  private denylistKey(token: string): string {
    const hash = createHash('sha256').update(token).digest('hex');
    return `rt:deny:${hash}`;
  }

  private getRefreshSecret(): string {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      this.configService.get<string>('JWT_SECRET') ||
      'your-secret-key'
    );
  }

  private getUserResponse(user: User) {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}
