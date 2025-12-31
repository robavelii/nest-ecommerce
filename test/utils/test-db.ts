import { DataSource, DataSourceOptions } from "typeorm";
import * as dotenv from "dotenv";

dotenv.config();

export const testDbConfig: DataSourceOptions = {
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: "ecommerce_test",
  entities: ["src/database/entities/*.ts"],
  migrations: ["src/database/migrations/*.ts"],
  synchronize: false,
  logging: false,
};

export const createTestDataSource = async (): Promise<DataSource> => {
  const dataSource = new DataSource({
    ...testDbConfig,
    synchronize: true,
  });

  await dataSource.initialize();
  return dataSource;
};

export const createTestConnection = async () => {
  const dataSource = await createTestDataSource();
  await dataSource.query(`CREATE DATABASE IF NOT EXISTS ecommerce_test`);
  return dataSource;
};

export const closeTestConnection = async (dataSource: DataSource) => {
  await dataSource.query("DROP SCHEMA public CASCADE");
  await dataSource.query("CREATE SCHEMA public");
  await dataSource.destroy();
};

export const truncateDatabase = async (dataSource: DataSource) => {
  const tables = dataSource.entityMetadatas.map((meta) => meta.tableName);
  for (const table of tables) {
    await dataSource.query(`TRUNCATE TABLE "${table}" CASCADE`);
  }
};
