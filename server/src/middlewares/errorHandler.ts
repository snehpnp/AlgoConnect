import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // Log every error
  console.error(`[${new Date().toISOString()}] ERROR: ${err.message}`, {
    path: req.path,
    method: req.method,
    stack: err.stack,
  });

  // Operational / expected error (thrown via AppError)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    return res.status(409).json({
      status: 'error',
      message: 'A record with that value already exists.',
    });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({
      status: 'error',
      message: 'Record not found.',
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ status: 'error', message: 'Invalid token. Please log in again.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ status: 'error', message: 'Your session has expired. Please log in again.' });
  }

  // Generic unknown / programming error → do NOT leak details in production
  const isDev = process.env.NODE_ENV === 'development';
  return res.status(500).json({
    status: 'error',
    message: isDev ? err.message : 'Something went wrong. Please try again later.',
    ...(isDev && { stack: err.stack }),
  });
};
