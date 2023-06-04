type Chunk = { i: number; eof: boolean; data: any; rpc: string };

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
    rpc: {
      [Rpc in keyof Rpcs]: (
        data: Parameters<Rpcs[Rpc]>[0]
      ) => ReturnType<Rpcs[Rpc]>;
    };
    /**
     * call local procedure
     */
    lpc: {
      [Lpc in keyof Lpcs]: (
        data: Parameters<Lpcs[Lpc]>[0]
      ) => ReturnType<Lpcs[Lpc]>;
    };
    /*
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
  let pipe:
    | undefined
    | {
        emit: (chunk: Chunk, callback: (data: any) => void) => void;
        subscribe: (cb: (chunk: Chunk) => void) => void;
      };
  const subs = new Set<any>();
  const api: any = {
    rpc: null,
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
  state = res.state ?? ({} as State);
  api.setPipe = (_pipe: any) => {
    pipe = _pipe;
  };
  api.lpc = res.lpcs
  api.rpc = {};
  Object.entries(res.rpcs).forEach(([k, v]) => {
    api.rpc[k] = (data: any) => {};
  });

  return api as Api;
};
