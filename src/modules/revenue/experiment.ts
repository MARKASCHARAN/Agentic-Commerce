export function getSessionExperimentGroup(sessionId: string): 'ASSISTED' | 'CONTROL' {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = sessionId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return (Math.abs(hash) % 2 === 0) ? 'ASSISTED' : 'CONTROL';
}
