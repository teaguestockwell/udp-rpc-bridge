import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/with-selector';

/**
 * https://github.com/teaguestockwell/observable-slice
 * @returns A slice of state that can be observed with react hooks, or callbacks.
 */
export const create = <
  State,
  Pubs extends Record<string, (state: State, payload: any) => State>,
  UseSubs extends Record<
    string,
    (
      arg: any
    ) => {
      select: (state: State) => unknown;
      isEqual?: (prev: any, next: any) => boolean;
    }
  >
>({
  initState,
  pubs,
  useSubs,
  notifyMiddleware,
}: {
  /**
   * The uncontrolled initial state of the slice.
   * This must be json serializable.
   */
  initState: State;
  /**
   * The publishers will replace the slice then notify the subscribers.
   *  It is recommended to wrap these reducers in immer's produce: https://immerjs.github.io/immer/update-patterns
   * If a publisher needs more than one parameter, it may be passed as an object.
   */
  pubs?: Pubs;
  /**
   * The subscribers will be available as react hooks and must be used inside of a react functional component:
   * @example subs: { useTodo: (id: string) => ({ select: s => s.todos[id] }) }
   * slice.useTodo('1')
   *
   * By default, all selectors will be memoized. If you would like to use a selector that is not memoized, try slice.useSub.
   */
  useSubs?: UseSubs;
  /**
   * You may choose to debounce subscriber notification.
   */
  notifyMiddleware?: (notify: () => void) => () => void;
}) => {
  let state = initState;
  const subscribers = new Set<() => void>();
  const _notify = () => subscribers.forEach(s => s());
  const notify = notifyMiddleware ? notifyMiddleware(_notify) : _notify;

  const res: any = {
    get: () => {
      return state;
    },
    pub: (replace: (state: State) => State) => {
      state = replace(state);
      notify();
    },
    sub: <T>(
      select: (state: State) => T,
      cb: (arg: T) => void,
      isEqual?: (prev: T, next: T) => boolean
    ) => {
      let prev = select(state);
      const sub = () => {
        const next = select(state);
        const update = isEqual ? !isEqual(prev, next) : prev !== next;
        if (update) {
          cb(next);
          prev = next;
        }
      };

      subscribers.add(sub);

      return () => {
        subscribers.delete(sub);
      };
    },
    useSub: <T>(
      select: (state: State) => T,
      isEqual?: (prev: T, next: T) => boolean
    ) => {
      return useSyncExternalStoreWithSelector(
        res.sub,
        res.get,
        undefined,
        select,
        isEqual
      );
    },
  };

  if (pubs) {
    Object.keys(pubs).forEach(k => {
      res[k] = (payload: any) =>
        res.pub((draft: any) => pubs[k](draft, payload));
    });
  }

  if (useSubs) {
    Object.keys(useSubs).forEach(k => {
      res[k] = (arg: any) => {
        const { select, isEqual } = useSubs[k](arg);
        return res.useSub(select, isEqual);
      };
    });
  }

  return res as {
    /**
     * Get the current state of the slice. This is immutable.
     */
    get: () => State;
    /**
     * This will update the slice then notify the subscribers.
     * It is recommended to wrap pubs in immer's produce: https://immerjs.github.io/immer/update-patterns
     */
    pub: (replace: (state: State) => State) => void;
    /**
     * Subscribe to the selected state of the slice.
     */
    sub: <T>(
      /**
       * The function that will select the state to subscribe to.
       */
      select: (state: State) => T,
      /**
       * Called with the selected arg when isEqual(previousSelected, nextSelected) is false.
       */
      cb: (arg: T) => unknown,
      /**
       * A function that will be called to determine if this subscriber should be notified (when isEqual(prev, next) === false). By default this is a strict equality check (===).
       */
      isEqual?: (prev: T, next: T) => boolean
    ) => () => void;
    /**
     * Subscribe to the selected state of the slice using a react hook.
     */
    useSub: <T>(
      select: (state: State) => T,
      isEqual?: (prev: T, next: T) => boolean
    ) => T;
  } & {
    [K in keyof Pubs]: (
      arg: Parameters<Pubs[K]>[1] extends undefined
        ? void
        : Parameters<Pubs[K]>[1]
    ) => void;
  } &
    {
      [K in keyof UseSubs]: (
        ...arg: Parameters<UseSubs[K]>
      ) => ReturnType<ReturnType<UseSubs[K]>['select']>;
    };
};

export default create;
