import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../database/entities/User.entity';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
