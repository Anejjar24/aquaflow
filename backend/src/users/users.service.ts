import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User, UserRole } from '../database/entities/User.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';

/** User shape returned by every endpoint — password hash never exposed */
export type SafeUser = Omit<User, 'password'>;

function stripPassword({ password: _pw, ...safe }: User): SafeUser {
  return safe as SafeUser;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ─── List (paginated) ────────────────────────────────────────────────────────

  async findAll(query: UserQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.userRepo.createQueryBuilder('u').orderBy('u.lastname', 'ASC').addOrderBy('u.firstname', 'ASC');

    if (query.role) {
      qb.andWhere('u.role = :role', { role: query.role });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('u.is_active = :isActive', { isActive: query.isActive });
    }

    if (query.search) {
      const term = `%${query.search}%`;
      qb.andWhere(
        '(u.email ILIKE :term OR u.firstname ILIKE :term OR u.lastname ILIKE :term)',
        { term },
      );
    }

    const [users, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: users.map(stripPassword),
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  // ─── Flat list for dropdowns (no pagination, filtered by role) ───────────────

  async findForDropdown(role?: string): Promise<SafeUser[]> {
    const where: Partial<User> = { isActive: true };
    if (role && Object.values(UserRole).includes(role as UserRole)) {
      where.role = role as UserRole;
    }

    const users = await this.userRepo.find({
      where,
      order: { lastname: 'ASC', firstname: 'ASC' },
    });

    return users.map(stripPassword);
  }

  // ─── Single ──────────────────────────────────────────────────────────────────

  async findOne(id: string): Promise<SafeUser> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return stripPassword(user);
  }

  // ─── Update (admin: role + isActive) ─────────────────────────────────────────

  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;

    const saved = await this.userRepo.save(user);
    return stripPassword(saved);
  }
}
