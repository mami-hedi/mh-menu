import { Router } from 'express';
import { asyncHandler } from '../../utils/errors.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../../middlewares/auth.js';
import { loginAccountLimiter, loginLimiter, registerLimiter, passwordResetLimiter } from '../../middlewares/rateLimit.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema, changePasswordSchema } from './auth.validation.js';
import * as auth from './auth.service.js';

const router = Router();

router.post(
  '/register',
  registerLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { confirmPassword, ...data } = req.body;
    res.status(201).json(await auth.registerRestaurant(data, req.ip));
  })
);

router.post(
  '/login',
  loginLimiter,
  loginAccountLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    res.json(await auth.login(req.body, req.ip));
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await auth.getProfile(req.user.id));
  })
);

router.patch(
  '/me',
  authenticate,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    res.json(await auth.updateProfile(req.user.id, req.user.restaurantId, req.body, req.ip));
  })
);

router.post(
  '/change-password',
  authenticate,
  loginLimiter,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    res.json(await auth.changePassword(req.user.id, req.user.restaurantId, req.body, req.ip));
  })
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    await auth.logout(req.user.id, req.user.restaurantId, req.ip);
    res.status(204).end();
  })
);

router.post(
  '/forgot-password',
  passwordResetLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    await auth.requestPasswordReset(req.body, req.ip);
    res.json({ message: 'Si un compte existe avec cet email, un lien de réinitialisation vient d\'être envoyé.' });
  })
);

router.post(
  '/reset-password',
  passwordResetLimiter,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    await auth.resetPassword(req.body, req.ip);
    res.json({ message: 'Mot de passe modifié. Vous pouvez vous connecter.' });
  })
);

export default router;
