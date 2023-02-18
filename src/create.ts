export const create = <
  Rpcs extends {
    [rpc: string]: (arg: any) => Promise<any>;
  },
  State extends object,
  Lpcs extends {
    [name: string]: (arg: any) => any;
  },
  Api = {
    /**
     * call remote procedure with retry until acknowledgement
     */
    rpc: <Rpc extends keyof Rpcs>(
      rpc: Rpc,
      data: Parameters<Rpcs[Rpc]>[0],
      progress?: (e: {
        total: number;
        current: number;
        percent: number;
      }) => void
    ) => ReturnType<Rpcs[Rpc]>;
    /**
     * call local procedure
     */
    lpc: <Lpc extends keyof Lpcs>(
      lpc: Lpc,
      data: Parameters<Lpcs[Lpc]>[0]
    ) => ReturnType<Lpcs[Lpc]>;
    /**
     * set local state and notify local observers
     */
    set: (next: Partial<State> | ((prev: State) => Partial<State>)) => void;
    /**
     * get local state
     */
    get: () => State;
    /**
     * sub to the local store state
     */
    sub: (cb: (s: State) => void) => void;
  }
>(
  /**
   * produce a client for local and remove pub sub
   */
  produce: (
    api: Api
  ) => {
    /**
     * handlers for each remote procedure subscription
     */
    rpcs: {
      [K in keyof Rpcs]: (
        data: Parameters<Rpcs[K]>[0],
        meta: {
          callerId: number;
          requestId: number;
          receivedEPOC: number;
          sentEPOC: number;
        }
      ) => ReturnType<Rpcs[K]>;
    };
    /**
     * initial local state
     */
    state?: State;
    /**
     * handlers for each local procedure
     */
    lpcs?: Lpcs;
  }
) => {
  let state: any;
  const subs = new Set<any>();
  const api: any = {
    rpc: async (rpc: any, data: any) => {
      // todo: batching, encoding, acks, retry, progress cb, idempotency
    },
    lpc: null,
    set: (exp: any) => {
      if (typeof exp === 'function') {
        const partial = exp(state);
        state = { ...state, partial };
      } else {
        state = { ...state, ...exp };
      }
      subs.forEach(s => s(state));
    },
    get: () => state,
    sub: (cb: any) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
  };

  const res = produce(api);
  api.lpc = (k: any, data: any) => {
    return res.lpcs?.[k]?.(data);
  };
  return api as Api;
};
