import { cacheDel } from "./redis"
import { CacheKeys } from "./cacheKeys"

/**
 * Call after any admin mutation that changes exam form, questions, or access rules.
 * This ensures students never see stale content mid-exam.
 */
export async function invalidateExamCaches(examFormId: string, slug?: string): Promise<void> {
  const keys: string[] = [
    CacheKeys.examById(examFormId),
    CacheKeys.questions(examFormId),
    CacheKeys.access(examFormId),
  ]
  if (slug) keys.push(CacheKeys.examBySlug(slug))
  await cacheDel(...keys)
}
