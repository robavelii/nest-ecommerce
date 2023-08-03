import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Roles } from 'src/roles/entities/role.entity';
import { RoleEnum } from 'src/roles/roles.enum';
import { Repository } from 'typeorm';

@Injectable()
export class RoleSeedService {
  constructor(
    @InjectRepository(Roles)
    private repository: Repository<Roles>,
  ) {}

  async run() {
    const countCustomer = await this.repository.count({
      where: {
        id: RoleEnum.customer,
      },
    });

    if (countCustomer === 0) {
      await this.repository.save(
        this.repository.create({
          id: RoleEnum.customer,
          name: 'Customer',
        }),
      );
    }
    const countManager = await this.repository.count({
      where: {
        id: RoleEnum.manager,
      },
    });

    if (countManager === 0) {
      await this.repository.save(
        this.repository.create({
          id: RoleEnum.manager,
          name: 'Manager',
        }),
      );
    }
    const countSales = await this.repository.count({
      where: {
        id: RoleEnum.sales,
      },
    });

    if (countSales === 0) {
      await this.repository.save(
        this.repository.create({
          id: RoleEnum.sales,
          name: 'Sales',
        }),
      );
    }

    const countAdmin = await this.repository.count({
      where: {
        id: RoleEnum.admin,
      },
    });

    if (countAdmin === 0) {
      await this.repository.save(
        this.repository.create({
          id: RoleEnum.admin,
          name: 'Admin',
        }),
      );
    }
  }
}
