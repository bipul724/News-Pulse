import prisma from '../config/prisma.js';

export const getStats = async () => {
  // Independent queries run in parallel.
  const [articles, clusters, sourceGroups, lastCompletedJob] = await Promise.all([
    prisma.article.count(),
    prisma.cluster.count(),
    prisma.article.groupBy({ by: ['source'] }),
    prisma.ingestionJob.findFirst({
      where: { status: 'completed' },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    }),
  ]);

  return {
    articles,
    clusters,
    sources: sourceGroups.length,
    lastIngestion: lastCompletedJob?.completedAt ?? null,
  };
};
