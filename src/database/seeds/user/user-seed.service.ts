import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RoleEnum } from 'src/roles/roles.enum';
import { StatusEnum } from 'src/statuses/statuses.enum';
import { User } from 'src/modules/users/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UserSeedService {
  constructor(
    @InjectRepository(User)
    private repository: Repository<User>,
  ) {}

  async run() {
    const countAdmin = await this.repository.count({
      where: {
        role: {
          id: RoleEnum.admin,
        },
      },
    });

    if (countAdmin === 0) {
      await this.repository.save(
        this.repository.create({
          firstName: 'Super',
          lastName: 'Admin',
          email: 'admin@ecom.com',
          password: 'secret',
          role: {
            id: RoleEnum.admin,
            name: 'Admin',
          },
          status: {
            id: StatusEnum.active,
            name: 'Active',
          },
        }),
      );
    }

    const countCustomer = await this.repository.count({
      where: {
        role: {
          id: RoleEnum.customer,
        },
      },
    });

    if (countCustomer === 0) {
      await this.repository.save(
        this.repository.create({
          firstName: 'Customer',
          lastName: 'One',
          email: 'customer@ecom.com',
          password: 'secret',
          role: {
            id: RoleEnum.customer,
            name: 'Customer',
          },
          status: {
            id: StatusEnum.active,
            name: 'Active',
          },
        }),
      );
    }
    const countManager = await this.repository.count({
      where: {
        role: {
          id: RoleEnum.manager,
        },
      },
    });

    if (countManager === 0) {
      await this.repository.save(
        this.repository.create({
          firstName: 'Manager',
          lastName: 'One',
          email: 'manager@ecom.com',
          password: 'secret',
          role: {
            id: RoleEnum.manager,
            name: 'Manager',
          },
          status: {
            id: StatusEnum.active,
            name: 'Active',
          },
        }),
      );
    }
    const countSales = await this.repository.count({
      where: {
        role: {
          id: RoleEnum.sales,
        },
      },
    });

    if (countSales === 0) {
      await this.repository.save(
        this.repository.create({
          firstName: 'Sales',
          lastName: 'One',
          email: 'sales@ecom.com',
          password: 'secret',
          role: {
            id: RoleEnum.sales,
            name: 'Sales',
          },
          status: {
            id: StatusEnum.active,
            name: 'Active',
          },
        }),
      );
    }
  }
}
