import { compare, hash } from "bcryptjs";

const PASSWORD_HASH_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return hash(password, PASSWORD_HASH_ROUNDS);
}

export function comparePassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}