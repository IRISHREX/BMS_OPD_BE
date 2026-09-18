import { logEvent } from "../utils/logger.js";

class ErrorHandler extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const errorMiddleware = (err, req, res, next) => {
  err.message = err.message || "Internal Server Error";
  err.statusCode = err.statusCode || 500;

  if (err.name === "CastError") {
    const message = `Resource not found. Invalid: ${err.path}`;
    err = new ErrorHandler(message, 400);
  }

  if (err.code === 11000) {
    const message = `Duplicate ${Object.keys(err.keyValue)} Entered`;
    err = new ErrorHandler(message, 400);
  }

  if (err.name === "JsonWebTokenError") {
    const message = `Json Web Token is invalid, Try again!`;
    err = new ErrorHandler(message, 400);
  }

  if (err.name === "TokenExpiredError") {
    const message = `Json Web Token is Expired, Try again!`;
    err = new ErrorHandler(message, 400);
  }

  // Asynchronously record error log
  const level = err.statusCode >= 500 ? "ERROR" : "WARN";
  logEvent({
    level,
    category: "System",
    action: err.name || "API_ERROR",
    message: err.message,
    req,
    statusCode: err.statusCode,
    metadata: {
      stack: err.stack ? err.stack.slice(0, 1000) : undefined,
      code: err.code,
    },
  });

  return res.status(err.statusCode).json({
    success: false,
    message: err.message,
  });
};

export default ErrorHandler;