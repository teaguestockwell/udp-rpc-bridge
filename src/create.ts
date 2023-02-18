export const create = <
  Events extends { [rpc: string]: [Arg, Record<number, object>] },
  Arg = object,
  ReqMeta = { requestId: string; requestorId: string },
  Handlers = {
    [RPC in keyof Events]: (
      arg: Events[RPC][0] & ReqMeta
    ) => Promise<Events[RPC][1][number]>;
  }
>(
  produce: <RPC extends keyof Events>(
    get: <RPC extends keyof Events>(rpc: RPC,req: Events[RPC][0]) => Promise<Events[RPC][1][number]>
  ) => Handlers
) => {

};
