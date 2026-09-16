export const generateToken = (user, message, statusCode, res) => {
  const token = user.generateJsonWebToken();
  // Determine the cookie name based on the user's role
  // Dashboard users (Admin, Doctor and Compounder) receive the adminToken; patients receive patientToken
  const cookieName = (user.role === 'Admin' || user.role === 'Doctor' || user.role === 'Compounder') ? 'adminToken' : 'patientToken';

  const isProduction = process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';

  // Cookie options: set secure & sameSite for cross-site cookies when in production (Render uses HTTPS)
  const cookieOptions = {
    expires: new Date(Date.now() + (process.env.COOKIE_EXPIRE || 7) * 24 * 60 * 60 * 1000),
    httpOnly: true,
    path: '/',
  };

  if (isProduction) {
    cookieOptions.secure = true; // send only over HTTPS
    // Allow cross-site cookie in production when frontend is on a different origin
    cookieOptions.sameSite = 'none';
  }

  res.status(statusCode).cookie(cookieName, token, cookieOptions).json({
    success: true,
    message,
    user,
    token,
  });
};
