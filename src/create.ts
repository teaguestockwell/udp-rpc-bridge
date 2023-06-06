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
  const inFlightRequest: { [id: string]: { resolve: (e: any) => void } } = {};
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
          const req = inFlightRequest[id];
          if (!req) throw 'cant find request for response';
          req.resolve(e);
        }
        if (procedure === 'req') {
          const handler = api.rpc[procedure];
          if (!handler) throw 'no handler for ' + procedure;
          const resData = await handler(e);
          resData[idField] = id;
          resData[procedure] = procedure;
          resData[procedureVariant] = 'res';
          api.pipe.send(resData);
        }
        throw 'cant handle events of unknown procedure variant';
      },
    },
  };

  const res = produce(api);
  state = res.state ?? ({} as State);
  api.lpc = res.lpcs;
  api.rpc = {};
  Object.entries(res.rpcs).forEach(([k, v]) => {
    api.rpc[k] = (data: any) => {
      if (!api._pipe) {
        throw 'must set api._pipe before rpcs can be used';
      }
      const id = guid();
      data[idField] = id;
      data[procedureField] = k;
      data[procedureVariantField] = 'req';
      api._pipe(data);
      return new Promise(resolve => {
        inFlightRequest[id] = { resolve };
      });
    };
  });

  return api as Api;
};
