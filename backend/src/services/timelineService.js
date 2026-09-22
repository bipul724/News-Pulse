import * as clusterService from '../services/clusterService.js';

export const getTimelineData = async () => {
  const clusters = await clusterService.getAllClusters();
  
  const maxArticleCount = Math.max(...clusters.map(c => c.articles.length), 1);
  
  const timeline = clusters.map((cluster) => {
    const times = cluster.articles.map(a => new Date(a.publishedAt).getTime());
    const startTime = times.length ? new Date(Math.min(...times)).toISOString() : null;
    const endTime = times.length ? new Date(Math.max(...times)).toISOString() : null;
    
    // Calculate sources
    const sourceCounts = {};
    cluster.articles.forEach(a => {
      sourceCounts[a.source] = (sourceCounts[a.source] || 0) + 1;
    });
    const sources = Object.entries(sourceCounts).map(([name, count]) => ({ name, count }));

    return {
      id: cluster.id,
      label: cluster.label,
      start: startTime,
      end: endTime,
      articleCount: cluster.articles.length,
      intensity: cluster.articles.length / maxArticleCount,
      sources,
    };
  });
  
  timeline.sort((a, b) => new Date(b.end).getTime() - new Date(a.end).getTime());
  
  return timeline;
};
