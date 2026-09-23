import { jest } from '@jest/globals';

// One shared instance so tests can import `mockPrisma` and control what the
// app's Prisma client returns. No real database is involved.
export const mockPrisma = {};

export const resetMockPrisma = () => {
  mockPrisma.cluster = {
    findMany: jest.fn().mockResolvedValue([
      { id: '1', label: 'Tech Cluster', articles: [{ publishedAt: new Date().toISOString(), source: 'BBC' }, { publishedAt: new Date().toISOString(), source: 'NPR' }] }
    ]),
    findUnique: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  };
  mockPrisma.article = {
    findMany: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    groupBy: jest.fn().mockResolvedValue([]),
  };
  mockPrisma.ingestionJob = {
    create: jest.fn(),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  };
  mockPrisma.$queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
};

resetMockPrisma();

export const PrismaClient = class {
  constructor() {
    return mockPrisma;
  }
};
export const Prisma = {};
