export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  
  res.status(statusCode).json({
    error: {
      message: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_SERVER_ERROR',
      // Never expose stack traces in production
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};
