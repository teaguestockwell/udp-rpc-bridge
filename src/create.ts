type Meta = { callerId: string; requestId: string };

export const create = <
  Rpc extends {
    [rpc: string]: (data: any) => Promise<any>;
  },
  State,
  Actions extends {
    [name: string]: (arg?: any) => any;
  }
>(
  produce: <RPC extends keyof Rpc>(api: {
    call: (rpc: RPC, data: Parameters<Rpc[RPC]>) => ReturnType<Rpc[RPC]>;
    set: (next: Partial<State> | ((prev: State) => Partial<State>)) => void;
    get: () => State;
  }) => {
    rpc: Rpc;
    state?: State;
    actions?: Actions;
  }
) => {};
