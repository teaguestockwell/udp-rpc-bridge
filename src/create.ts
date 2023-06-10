const s = () =>
  Math.floor((1 + Math.random()) * 0x10000)
    .toString(16)
    .substring(1);

export const guid = () =>
  `${s()}${s()}-${s()}-${s()}-${s()}-${s()}${s()}${s()}`;

// easy to serialize, and collision resistant enough
const idField = 'dac3b6f2-de95-4dc7-8767-c768a1f87ec2';
const procedureField = 'cf92b78a-183a-4e81-a214-632cfeaf6c0f';
const procedureVariantField = '25a25b76-ed4e-424b-8d27-55560b83a4cf';

export const create = <
  Rpcs extends {
    [rpc: string]: (arg: any) => Promise<object>;
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
    pipe: {
      receive: (e: any) => Promise<any>;
      send: (e: any) => void;
    };
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
  const inFlightRequest: { [id: string]: (e: any) => void } = {};
  let res: ReturnType<typeof produce> | undefined;
  const api: any = {
    rpc: {},
    lpc: {},
    set: (exp: any) => {
      state = {
        ...state,
        ...(typeof exp === 'function' ? exp(state) : exp),
      };
      subs.forEach(s => s(state));
    },
    get: () => state,
    sub: (cb: any) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    pipe: {
      send: null,
      receive: async (e: any) => {
        const id = e[idField];
        const procedure = e[procedureField];
        const procedureVariant = e[procedureVariantField];
        delete e[idField];
        delete e[procedureField];
        delete e[procedureVariantField];
        if (procedureVariant === 'res') {
          const resolver = inFlightRequest[id];
          if (!resolver) throw 'cant find request for response';
          resolver(e);
          return;
        }
        if (procedureVariant === 'req') {
          const handler = res?.rpcs?.[procedure];
          if (!handler) throw 'no handler for ' + procedure;
          // todo populate metadata
          const resData = (await handler(e, {} as any)) as any;
          resData[idField] = id;
          resData[procedureField] = procedure;
          resData[procedureVariantField] = 'res';
          api.pipe.send(resData);
          return;
        }
        throw 'cant handle events of unknown procedure';
      },
    },
  };

  res = produce(api);
  state = res.state ?? ({} as State);
  api.lpc = res.lpcs;
  Object.entries(res.rpcs).forEach(([k]) => {
    api.rpc[k] = (data: any) => {
      if (!api.pipe.send) {
        throw 'must set api.pipe.send before rpcs can be used';
      }
      const id = guid();
      data[idField] = id;
      data[procedureField] = k;
      data[procedureVariantField] = 'req';
      api.pipe.send(data);
      return new Promise(resolve => {
        inFlightRequest[id] = resolve;
      });
    };
  });

  return api as Api;
};
