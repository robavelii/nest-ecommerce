import { DataSource } from "typeorm";
import { createTestConnection, closeTestConnection } from "./utils/test-db";

let dataSource: DataSource;

beforeAll(async () => {
  dataSource = await createTestConnection();
});

afterAll(async () => {
  await closeTestConnection(dataSource);
});

beforeEach(async () => {
  const tables = dataSource.entityMetadatas.map((meta) => meta.tableName);
  for (const table of tables) {
    await dataSource.query(`TRUNCATE TABLE "${table}" CASCADE`);
  }
});

global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};
