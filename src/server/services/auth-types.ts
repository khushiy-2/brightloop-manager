import type { z } from "zod";
import type { loginSchema, signupSchema } from "@/lib/validation/auth";

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;