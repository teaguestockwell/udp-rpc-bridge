export const create = <
  Rpcs extends {
    [rpc: string]: (data: any) => Promise<any>;
  },
  State extends object,
  Lpcs extends {
    [name: string]: (arg?: any) => any;
  }
>(
  /**
   * produce a client for local and remove pub sub
   */
  produce: (api: {
    /**
     * call remote procedure with retry until acknowledgement
     */
    call: <Rpc extends keyof Rpcs>(
      rpc: Rpc,
      data: Parameters<Rpcs[Rpc]>[0]
    ) => ReturnType<Rpcs[Rpc]>;
    /**
     * set local state and notify local observers
     */
    set: (next: Partial<State> | ((prev: State) => Partial<State>)) => void;
    /**
     * get local state
     */
    get: () => State
  }) => {
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
) => {};
