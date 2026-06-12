/**
 * TEST D'INTÉGRATION #2 — Flux d'authentification complet
 *
 * Ce test vérifie que AuthService, PasswordUtil et JwtService
 * collaborent correctement sans aucun mock de la logique métier.
 *
 * Composants RÉELS :
 *   ✅ AuthService   — logique login/register/logout/refresh
 *   ✅ PasswordUtil  — hachage et comparaison bcrypt réels
 *   ✅ JwtService    — génération et vérification JWT réels
 *
 * Composants mockés :
 *   🔧 Repository<User> — pas de vraie DB
 *   🔧 CACHE_MANAGER    — in-memory
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service';
import { PasswordUtil } from '../../src/auth/utils/password.util';
import { User, UserRole } from '../../src/database/entities/User.entity';

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('[Intégration] AuthService + PasswordUtil + JwtService', () => {
  let module: TestingModule;
  let authService: AuthService;
  let jwtService: JwtService;

  // Base de données simulée en mémoire
  const usersDb: Map<string, User> = new Map();

  const userRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      for (const u of usersDb.values()) {
        if (where.email && u.email === where.email) return u;
        if (where.id    && u.id    === where.id)    return u;
      }
      return null;
    }),
    create: jest.fn((dto: any) => ({ ...dto, id: `user-${Date.now()}`, isActive: true, role: UserRole.OPERATOR } as User)),
    save: jest.fn(async (u: any) => { usersDb.set(u.id ?? u.email, u); return u; }),
  };

  // Cache en mémoire simple
  const cache: Map<string, any> = new Map();
  const cacheManager = {
    get: jest.fn(async (k: string) => cache.get(k) ?? null),
    set: jest.fn(async (k: string, v: any) => { cache.set(k, v); }),
    del: jest.fn(async (k: string) => { cache.delete(k); }),
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        // ✅ Vrai JwtModule avec secret de test — génère de vrais JWT
        JwtModule.register({ secret: 'jwt-integration-test-secret', signOptions: { expiresIn: '15m' } }),
      ],
      providers: [
        // ✅ Services RÉELS
        AuthService,
        PasswordUtil,   // bcrypt réel — hash et compare réels

        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: CACHE_MANAGER,            useValue: cacheManager },
      ],
    }).compile();

    module.useLogger(false);

    authService = module.get(AuthService);
    jwtService  = module.get(JwtService);
  });

  afterAll(() => module.close());

  beforeEach(() => {
    usersDb.clear();
    cache.clear();
    jest.clearAllMocks();
    // Réinitialiser le comportement des mocks après clearAllMocks
    userRepo.findOne.mockImplementation(async ({ where }: any) => {
      for (const u of usersDb.values()) {
        if (where.email && u.email === where.email) return u;
        if (where.id    && u.id    === where.id)    return u;
      }
      return null;
    });
    userRepo.create.mockImplementation((dto: any) => ({
      ...dto, id: `user-${Date.now()}`, isActive: true, role: UserRole.OPERATOR,
    } as User));
    userRepo.save.mockImplementation(async (u: any) => { usersDb.set(u.id ?? u.email, u); return u; });
    cacheManager.get.mockImplementation(async (k: string) => cache.get(k) ?? null);
    cacheManager.set.mockImplementation(async (k: string, v: any) => { cache.set(k, v); });
    cacheManager.del.mockImplementation(async (k: string) => { cache.delete(k); });
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('register → mot de passe haché en bcrypt (jamais stocké en clair)', async () => {
    const result = await authService.register({
      email: 'alice@aquaflow.io',
      password: 'MonMotDePasse123',
      firstname: 'Alice',
      lastname: 'Dupont',
    });

    expect(result.access_token).toBeDefined();

    // Vérification que le mot de passe est haché dans la "DB"
    const userSaved = userRepo.save.mock.calls[0][0];
    expect(userSaved.password).not.toBe('MonMotDePasse123');
    expect(userSaved.password).toMatch(/^\$2b\$\d+\$/);  // format bcrypt réel
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('register → email dupliqué lance ConflictException', async () => {
    await authService.register({
      email: 'bob@aquaflow.io', password: 'Pass123',
      firstname: 'Bob', lastname: 'Martin',
    });

    await expect(authService.register({
      email: 'bob@aquaflow.io', password: 'AutrePass',
      firstname: 'Bob', lastname: 'Martin',
    })).rejects.toBeInstanceOf(ConflictException);
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('register → login → JWT décodable avec les bons claims', async () => {
    await authService.register({
      email: 'charlie@aquaflow.io', password: 'SecurePass456',
      firstname: 'Charlie', lastname: 'Doe',
    });

    // ✅ bcrypt.compare() réel — login avec vrai mot de passe
    const loginResult = await authService.login({
      email: 'charlie@aquaflow.io',
      password: 'SecurePass456',
    });

    expect(loginResult.access_token).toBeDefined();
    expect(loginResult.refresh_token).toBeDefined();

    // ✅ Le JWT est vrai — vérifiable et décodable
    const payload = jwtService.verify(loginResult.access_token, {
      secret: 'jwt-integration-test-secret',
    });
    expect(payload.email).toBe('charlie@aquaflow.io');
    expect(payload.role).toBe(UserRole.OPERATOR);
    expect(payload.sub).toBeDefined();

    // Le mot de passe ne doit jamais apparaître dans la réponse
    expect(loginResult.user).not.toHaveProperty('password');
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('login avec mauvais mot de passe → UnauthorizedException (bcrypt.compare réel)', async () => {
    await authService.register({
      email: 'diana@aquaflow.io', password: 'BonMotDePasse',
      firstname: 'Diana', lastname: 'Prince',
    });

    // ✅ Le vrai bcrypt.compare() retourne false → service doit lever l'exception
    await expect(authService.login({
      email: 'diana@aquaflow.io',
      password: 'MauvaisMotDePasse',
    })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('logout → refresh token mis en liste noire dans le cache', async () => {
    await authService.register({
      email: 'eve@aquaflow.io', password: 'MyPass789',
      firstname: 'Eve', lastname: 'Online',
    });
    const login = await authService.login({ email: 'eve@aquaflow.io', password: 'MyPass789' });
    const user  = login.user as unknown as User;

    await authService.logout(user, login.refresh_token);

    // ✅ Le token est dans la liste noire (cache)
    expect(cacheManager.set).toHaveBeenCalledWith(
      expect.stringMatching(/^rt:deny:/),
      '1',
      expect.any(Number),
    );
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('refreshToken avec token en liste noire → UnauthorizedException', async () => {
    await authService.register({
      email: 'frank@aquaflow.io', password: 'Pass999',
      firstname: 'Frank', lastname: 'Test',
    });
    const login = await authService.login({ email: 'frank@aquaflow.io', password: 'Pass999' });
    const user  = login.user as unknown as User;

    // Mettre le token en liste noire
    await authService.logout(user, login.refresh_token);

    // ✅ Refresh avec token révoqué doit être refusé
    await expect(authService.refreshToken(login.refresh_token))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });
});
