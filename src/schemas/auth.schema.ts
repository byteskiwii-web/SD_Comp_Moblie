import { z } from 'zod';
import { OTP_LENGTH } from '../constants/config';

export const loginSchema = z.object({
  employee_id: z.string().trim().min(1, { error: 'Employee ID is required' }),
  password: z.string().min(1, { error: 'Password is required' }),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordRequestSchema = z.object({
  employee_id: z.string().trim().min(1, { error: 'Employee ID is required' }),
});
export type ForgotPasswordRequestInput = z.infer<typeof forgotPasswordRequestSchema>;

export const forgotPasswordVerifySchema = z.object({
  employee_id: z.string().trim().min(1),
  otp: z.string().length(OTP_LENGTH, { error: `Enter the ${OTP_LENGTH}-digit code` }),
});
export type ForgotPasswordVerifyInput = z.infer<typeof forgotPasswordVerifySchema>;

export const resetPasswordSchema = z
  .object({
    resetToken: z.string().min(1),
    new_password: z.string().min(8, { error: 'Password must be at least 8 characters' }),
    confirm_password: z.string().min(1, { error: 'Please confirm your password' }),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    error: 'Passwords do not match',
    path: ['confirm_password'],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
