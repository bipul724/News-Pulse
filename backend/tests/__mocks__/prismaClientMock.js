import { jest } from '@jest/globals';

export const PrismaClient = class {
  constructor() {
    this.cluster = {
      findMany: jest.fn().mockResolvedValue([
        { id: '1', label: 'Tech Cluster', articles: [{ publishedAt: new Date().toISOString(), source: 'BBC' }, { publishedAt: new Date().toISOString(), source: 'NPR' }] }
      ]),
      findUnique: jest.fn()
    };
    this.article = {
      findMany: jest.fn()
    };
  }
};
export const Prisma = {};
