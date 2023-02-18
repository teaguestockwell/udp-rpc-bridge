export const create = <
  Rpcs extends {
    [rpc: string]: (data: any) => Promise<any>;
  },
  State,
  Actions extends {
    [name: string]: (arg?: any) => any;
  }
>(
  produce: <Rpc extends keyof Rpcs>(api: {
    call: (rpc: Rpc, data: Parameters<Rpcs[Rpc]>[0]) => ReturnType<Rpcs[Rpc]>;
    set: (next: Partial<State> | ((prev: State) => Partial<State>)) => void;
    get: () => State;
  }) => {
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
    state?: State;
    actions?: Actions;
  }
) => {};
