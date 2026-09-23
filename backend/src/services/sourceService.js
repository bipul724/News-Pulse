import prisma from '../config/prisma.js';

// One GROUP BY query: source names come from real Article rows, never a hardcoded list.
export const getSources = async () => {
  const groups = await prisma.article.groupBy({
    by: ['source'],
    _count: { _all: true },
  });

  return groups
    .map(group => ({ name: group.source, articleCount: group._count._all }))
    .sort((a, b) => b.articleCount - a.articleCount || a.name.localeCompare(b.name));
};
