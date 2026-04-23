// Single source of truth for all Redis key namespaces
export const CacheKeys = {
  session: (token: string) => `ef:session:${token}`,
  examBySlug: (slug: string) => `ef:exam:${slug}`,
  examById: (id: string) => `ef:exam:id:${id}`,
  questions: (examFormId: string) => `ef:questions:${examFormId}`,
  sections: (examFormId: string) => `ef:sections:${examFormId}`,
  access: (examFormId: string) => `ef:access:${examFormId}`,
  hbTab: (sessionId: string) => `ef:hb:${sessionId}:tab`,
  hbFs: (sessionId: string) => `ef:hb:${sessionId}:fs`,
  hbLastFlush: (sessionId: string) => `ef:hb:${sessionId}:flush`,
  owner: (examFormId: string, studentId: string) => `ef:owner:${examFormId}:${studentId}`,
  rate: (key: string) => `ef:rate:${key}`,
  scoringPending: (sessionId: string) => `ef:scoring:${sessionId}`,
}
