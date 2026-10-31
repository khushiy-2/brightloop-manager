import { z } from "zod";

const emailSchema = z.email().transform((email) => email.trim().toLowerCase());

export const passwordSchema = z
  .string()
  .min(9, "Password must be more than 8 characters.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character.");

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required."),
  password: passwordSchema,
});

export const createStaffSchema = signupSchema;