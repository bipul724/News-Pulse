import prisma from '../config/prisma.js';

export const getAllClusters = async () => {
  return await prisma.cluster.findMany({
    include: {
      articles: true,
    },
  });
};

export const getClusterWithArticles = async (id) => {
  return await prisma.cluster.findUnique({
    where: { id },
    include: {
      articles: {
        orderBy: { publishedAt: 'asc' },
      },
    },
  });
};
