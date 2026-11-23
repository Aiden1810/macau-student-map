
export function discoveryErrorKey(code: string | null) {
  switch (code) {
    case 'QUOTA': return 'quota';
    case 'TIMEOUT': return 'timeout';
    case 'NOT_CONFIGURED': return 'notConfigured';
    case 'POI_PERSISTENCE_DISABLED': return 'persistenceDisabled';
    case 'PLACE_UNAVAILABLE': return 'placeUnavailable';
    case 'SIGN_IN': return 'signInRequired';
    default: return 'requestFailed';
  }
}
