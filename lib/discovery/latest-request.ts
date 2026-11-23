
/** Keep requests cancellable and prevent late provider responses from updating the screen. */
export function createLatestDiscoveryRequest() {
  let active: {key: string; controller: AbortController} | null = null;
  return {
    begin(key: string) {
      if (active?.key === key) return null;
      active?.controller.abort();
      const request = {key, controller: new AbortController()};
      active = request;
      return {
        signal: request.controller.signal,
        current: () => active === request && !request.controller.signal.aborted,
        finish: () => {if (active === request) active = null;}
      };
    },
    cancel() {
      active?.controller.abort();
      active = null;
    }
  };
}
