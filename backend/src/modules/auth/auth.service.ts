import prisma from '../../config/database';
import { hashPassword, comparePassword } from '../../utils/hash';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, TokenPayload } from '../../utils/jwt';
import { AppError } from '../../middleware/errorHandler';
import { Role } from '../../constants/enums';
import { addEmailJob } from '../../jobs/queue';
import crypto from 'crypto';

class AuthService {
  async register(data: {
    email: string;
    password: string;
    role?: Role;
    firstName: string;
    lastName: string;
  }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new AppError('A user with this email already exists.', 409);
    }

    const passwordHash = await hashPassword(data.password);
    const role = Role.STUDENT;

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        role,
      },
    });

    const profile = await prisma.profile.create({
      data: {
        userId: user.id,
        firstName: data.firstName,
        lastName: data.lastName,
      },
    });

    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: profile,
      },
      accessToken,
      refreshToken,
    };
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      throw new AppError('Invalid email or password.', 401);
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      throw new AppError('Invalid email or password.', 401);
    }

    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        metadata: { ip: 'system' },
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        profile: user.profile,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    let payload: TokenPayload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError('Invalid or expired refresh token.', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || user.refreshToken !== refreshToken) {
      throw new AppError('Refresh token has been revoked.', 401);
    }

    const newTokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const newAccessToken = generateAccessToken(newTokenPayload);
    const newRefreshToken = generateRefreshToken(newTokenPayload);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal whether user exists
      return { message: 'If an account with that email exists, a reset link has been sent.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetUrl = `${process.env.FRONTEND_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    // Store hashed token in refreshToken field temporarily
    const hashedToken = await hashPassword(resetToken);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedToken },
    });

    await addEmailJob({
      to: email,
      subject: 'Password Reset Request',
      template: 'password_reset',
      context: { resetUrl, userName: email },
    });

    return { message: 'If an account with that email exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    // In a real app, you'd store the reset token separately with expiration
    // For now, we validate against refreshToken field
    const passwordHash = await hashPassword(newPassword);

    // Find user with matching reset token - simplified flow
    const users = await prisma.user.findMany({
      where: { refreshToken: { not: null } },
    });

    let matchedUser = null;
    for (const user of users) {
      if (user.refreshToken && await comparePassword(token, user.refreshToken)) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      throw new AppError('Invalid or expired reset token.', 400);
    }

    await prisma.user.update({
      where: { id: matchedUser.id },
      data: { passwordHash, refreshToken: null },
    });

    return { message: 'Password has been reset successfully.' };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      profile: user.profile,
    };
  }

  async updateProfile(userId: string, data: Record<string, unknown>) {
    const profile = await prisma.profile.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        firstName: (data.firstName as string) || '',
        lastName: (data.lastName as string) || '',
        ...data,
      },
    });
    return profile;
  }
}

export const authService = new AuthService();
