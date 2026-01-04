import { access } from "node:fs/promises";
import path from "node:path";
import { NeuralNetworkError } from "./types";

export async function fileExists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function joinPosix(...parts: string[]) {
  return parts.join(path.sep);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[${operationName}] Attempt ${attempt}/${maxRetries} failed:`, lastError.message);

      if (attempt === maxRetries) {
        throw new NeuralNetworkError(
          `Operation ${operationName} failed after ${maxRetries} attempts`,
          operationName,
          lastError
        );
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`[${operationName}] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Unknown error in withRetry');
}
