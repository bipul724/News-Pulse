import * as clusterService from '../services/clusterService.js';

export const getClusters = async (req, res, next) => {
  try {
    const clusters = await clusterService.getAllClusters();

    const formattedClusters = clusters.map((cluster) => {
      const times = cluster.articles.map(a => new Date(a.publishedAt).getTime());
      const startTime = times.length ? new Date(Math.min(...times)).toISOString() : null;
      const endTime = times.length ? new Date(Math.max(...times)).toISOString() : null;
      
      return {
        id: cluster.id,
        label: cluster.label,
        articleCount: cluster.articles.length,
        start: startTime,
        end: endTime,
      };
    });

    // Sort by latest activity descending
    formattedClusters.sort((a, b) => new Date(b.end).getTime() - new Date(a.end).getTime());

    res.json({ clusters: formattedClusters });
  } catch (error) {
    next(error);
  }
};

export const getClusterById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // We assume uuid format, but Prisma will throw if invalid format. Let's just catch it or check it.
    if (!id.match(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/)) {
      return res.status(400).json({ error: { message: 'Invalid cluster ID format', code: 'INVALID_ID' } });
    }

    const cluster = await clusterService.getClusterWithArticles(id);

    if (!cluster) {
      return res.status(404).json({ error: { message: 'Cluster not found', code: 'NOT_FOUND' } });
    }

    const times = cluster.articles.map(a => new Date(a.publishedAt).getTime());
    const startTime = times.length ? new Date(Math.min(...times)).toISOString() : null;
    const endTime = times.length ? new Date(Math.max(...times)).toISOString() : null;

    res.json({
      cluster: {
        id: cluster.id,
        label: cluster.label,
        articleCount: cluster.articles.length,
        start: startTime,
        end: endTime,
      },
      articles: cluster.articles.map(article => ({
        id: article.id,
        headline: article.headline,
        summary: article.summary,
        source: article.source,
        publishedAt: article.publishedAt,
        url: article.url,
      }))
    });
  } catch (error) {
    next(error);
  }
};
