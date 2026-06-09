import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AuthService } from './auth.service';
import { PasswordUtil } from './utils/password.util';
import { User, UserRole } from '../database/entities/User.entity';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockUser = (): User =>
  ({
    id: 'user-uuid',
    email: 'test@aquaflow.io',
    password: 'hashed_pw',
    firstname: 'Test',
    lastname: 'User',
    role: UserRole.OPERATOR,
    isActive: true,
  } as User);

const mockUserRepo = () => ({
  findOne: jest.fn() as jest.MockedFunction<any>,
  create: jest.fn() as jest.MockedFunction<any>,
  save: jest.fn() as jest.MockedFunction<any>,
});

const mockJwtService = () => ({
  sign: jest.fn(() => 'mock_token') as jest.MockedFunction<any>,
  verify: jest.fn() as jest.MockedFunction<any>,
});

const mockPasswordUtil = () => ({
  hashPassword: jest.fn() as jest.MockedFunction<any>,
  comparePasswords: jest.fn() as jest.MockedFunction<any>,
});

const mockConfigService = () => ({
  get: jest.fn((key: string) => {
    const cfg: Record<string, string> = {
      JWT_SECRET: 'test-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
    };
    return cfg[key];
  }) as jest.MockedFunction<any>,
});

const mockCacheManager = () => ({
  get: jest.fn() as jest.MockedFunction<any>,
  set: jest.fn() as jest.MockedFunction<any>,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: ReturnType<typeof mockUserRepo>;
  let jwtService: ReturnType<typeof mockJwtService>;
  let passwordUtil: ReturnType<typeof mockPasswordUtil>;
  let cacheManager: ReturnType<typeof mockCacheManager>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
        { provide: JwtService, useFactory: mockJwtService },
        { provide: PasswordUtil, useFactory: mockPasswordUtil },
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: CACHE_MANAGER, useFactory: mockCacheManager },
      ],
    }).compile();

    service = module.get(AuthService);
    userRepo = module.get(getRepositoryToken(User));
    jwtService = module.get(JwtService);
    passwordUtil = module.get(PasswordUtil);
    cacheManager = module.get(CACHE_MANAGER);

    // Default behaviours reset before each test
    cacheManager.get.mockResolvedValue(null);
    cacheManager.set.mockResolvedValue(undefined);
    passwordUtil.hashPassword.mockResolvedValue('hashed_pw');
    passwordUtil.comparePasswords.mockResolvedValue(true);
    jwtService.sign.mockReturnValue('mock_token');
  });

  // ── validateUser ─────────────────────────────────────────────────────────

  describe('validateUser', () => {
    it('returns user when found and active', async () => {
      const user = mockUser();
      userRepo.findOne.mockResolvedValue(user);
      await expect(service.validateUser('user-uuid')).resolves.toEqual(user);
    });

    it('throws UnauthorizedException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.validateUser('unknown')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when user is inactive', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser(), isActive: false });
      await expect(service.validateUser('user-uuid')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns tokens and user on valid credentials', async () => {
      const user = mockUser();
      userRepo.findOne.mockResolvedValue(user);
      passwordUtil.comparePasswords.mockResolvedValue(true);
      jwtService.sign.mockReturnValue('jwt_token');

      const result = await service.login({ email: user.email, password: 'pw' });

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.user.email).toBe(user.email);
      // password must NOT be in the response
      expect(result.user).not.toHaveProperty('password');
    });

    it('throws UnauthorizedException when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.login({ email: 'x@x.com', password: 'pw' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      passwordUtil.comparePasswords.mockResolvedValue(false);
      await expect(
        service.login({ email: 'test@aquaflow.io', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException when account is disabled', async () => {
      userRepo.findOne.mockResolvedValue({ ...mockUser(), isActive: false });
      await expect(
        service.login({ email: 'test@aquaflow.io', password: 'pw' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  // ── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    it('throws ConflictException when email already exists', async () => {
      userRepo.findOne.mockResolvedValue(mockUser());
      await expect(
        service.register({
          email: 'test@aquaflow.io',
          password: 'pw',
          firstname: 'A',
          lastname: 'B',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates user and returns tokens on success', async () => {
      const user = mockUser();
      userRepo.findOne.mockResolvedValue(null); // no duplicate
      userRepo.create.mockReturnValue(user);
      userRepo.save.mockResolvedValue(user);
      jwtService.sign.mockReturnValue('jwt_token');

      const result = await service.register({
        email: user.email,
        password: 'pw',
        firstname: 'Test',
        lastname: 'User',
      });

      expect(result).toHaveProperty('access_token');
      expect(result.user.email).toBe(user.email);
    });
  });

  // ── logout ────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('returns success message', async () => {
      const result = await service.logout(mockUser());
      expect(result.message).toMatch(/logged out/i);
    });

    it('denylists refresh token when provided', async () => {
      await service.logout(mockUser(), 'some_refresh_token');
      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.stringMatching(/^rt:deny:/),
        '1',
        expect.any(Number),
      );
    });
  });

  // ── refreshToken ──────────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('throws UnauthorizedException when token is denylisted', async () => {
      cacheManager.get.mockResolvedValue('1'); // token is in denylist
      await expect(service.refreshToken('denylisted_token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rotates tokens on valid refresh token', async () => {
      const user = mockUser();
      cacheManager.get.mockResolvedValue(null); // not denylisted
      jwtService.verify.mockReturnValue({ sub: user.id, email: user.email });
      userRepo.findOne.mockResolvedValue(user);
      jwtService.sign.mockReturnValue('new_token');

      const result = await service.refreshToken('valid_refresh_token');

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      // old token must be denylisted
      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.stringMatching(/^rt:deny:/),
        '1',
        expect.any(Number),
      );
    });
  });
});
