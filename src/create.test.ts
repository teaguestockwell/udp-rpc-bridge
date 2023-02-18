import { act, renderHook } from '@testing-library/react';
import { create } from './create';

jest.mock('lodash.debounce', () => ({
  __esModule: true,
  default: (fn: any) => fn,
}));

describe('create', () => {
  it('creates a slice', () => {
    const slice = create({
      initState: {
        counter: 0,
      },
    });
    expect(slice).toBeDefined();
  });
  it('has initial state', () => {
    const slice = create({
      initState: {
        counter: 0,
      },
    });
    expect(slice.get()).toEqual({
      counter: 0,
    });
  });
  it('updates state', () => {
    const slice = create({
      initState: {
        counter: 0,
      },
      pubs: {
        increment: (prev, by: number) => ({
          counter: prev.counter + by,
        }),
      },
    });

    slice.increment(1);

    expect(slice.get()).toEqual({
      counter: 1,
    });
  });
  it('notifies subscribers', () => {
    const slice = create({
      initState: {
        counter: 0,
      },
      pubs: {
        increment: (prev, by: number) => ({
          counter: prev.counter + by,
        }),
      },
    });

    let subbed;
    slice.sub(
      s => s.counter,
      c => (subbed = c)
    );

    expect(subbed).toBe(undefined);
    slice.increment(1);
    expect(subbed).toBe(1);
  });
  it('unsubscribes', () => {
    const slice = create({
      initState: {
        counter: 0,
      },
      pubs: {
        increment: (prev, by: number) => ({
          counter: prev.counter + by,
        }),
      },
    });

    let subbed;
    const unSub = slice.sub(
      s => s.counter,
      c => (subbed = c)
    );
    unSub();
    slice.increment(1);

    expect(subbed).toBe(undefined);
  });
  it('does not notify subscribers that are not selected', () => {
    const slice = create({
      initState: {
        counter: 0,
        counter2: 0,
      },
      pubs: {
        increment: (prev, by: number) => ({
          ...prev,
          counter: prev.counter + by,
        }),
      },
    });

    let subbed;
    slice.sub(
      s => s.counter2,
      c => (subbed = c)
    );

    expect(subbed).toBe(undefined);
    slice.increment(1);
    expect(subbed).toBe(undefined);
  });
  it('does not notify subscribers when is equal is true', () => {
    const slice = create({
      initState: {
        counter: 0,
      },
      pubs: {
        increment: (prev, by: number) => ({
          counter: prev.counter + by,
        }),
      },
    });

    let subbed;
    slice.sub(
      s => s.counter,
      c => (subbed = c),
      () => true
    );

    expect(subbed).toBe(undefined);
    slice.increment(1);
    expect(subbed).toBe(undefined);
  });
  it('publishes', () => {
    const slice = create({
      initState: {
        counter: 0,
      },
    });

    slice.pub(p => ({ counter: p.counter + 1 }));

    slice.pub(s => {
      return {
        counter: s.counter + 1,
      };
    });
    expect(slice.get().counter).toBe(2);
  });
  it('has initial state inside of a hook', () => {
    const slice = create({
      initState: {
        counter: 0,
      },
      useSubs: {
        useCounter: () => ({
          select: s => s.counter,
        }),
      },
    });

    const { result } = renderHook(slice.useCounter);

    expect(result.current).toBe(0);
  });
  it('notifies subscribed hooks', () => {
    const slice = create({
      initState: {
        counter: 0,
      },
      pubs: {
        increment: (prev, by: number) => ({
          counter: prev.counter + by,
        }),
      },
      useSubs: {
        useCount: () => ({
          select: s => s.counter,
        }),
      },
    });
    const { result } = renderHook(slice.useCount);

    act(() => {
      slice.increment(1);
    });

    expect(result.current).toBe(1);
  });
  it('does not notify subscribed hooks that are not selected', () => {
    const slice = create({
      initState: {
        counter: 0,
        counter2: 0,
      },
      pubs: {
        increment: (prev, by: number) => ({
          ...prev,
          counter2: prev.counter2 + by,
        }),
      },
      useSubs: {
        useCount: () => ({
          select: s => s.counter,
        }),
      },
    });
    const { result } = renderHook(slice.useCount);

    act(() => {
      slice.increment(1);
    });

    expect(result.current).toBe(0);
  });
  it('does not notify subscribed hooks that have a is equal of true', () => {
    const slice = create({
      initState: {
        counter: 0,
      },
      pubs: {
        increment: (prev, by: number) => ({
          counter: prev.counter + by,
        }),
      },
      useSubs: {
        useCount: () => ({
          select: s => s.counter,
          isEqual: () => true,
        }),
      },
    });
    const { result } = renderHook(slice.useCount);

    act(() => {
      slice.increment(1);
    });

    expect(result.current).toBe(0);
  });
  it('useSub has initial state', () => {
    const slice = create({
      initState: {
        counter: 0,
      },
    });

    const { result } = renderHook(() => slice.useSub(s => s.counter));

    expect(result.current).toBe(0);
  });
  it('useSub is notified', () => {
    const slice = create({
      initState: {
        counter: 0,
      },
    });
    const { result } = renderHook(() => slice.useSub(s => s.counter));

    act(() => {
      slice.pub(p => ({ counter: p.counter + 1 }));
    });

    expect(result.current).toBe(1);
  });
  it('useSub is not notified when it is not selected', () => {
    const slice = create({
      initState: {
        counter: 0,
        counter2: 0,
      },
    });
    const { result } = renderHook(() => slice.useSub(s => s.counter2));

    act(() => {
      slice.pub(p => ({ ...p, counter: p.counter + 1 }));
    });

    expect(result.current).toBe(0);
  });
  it('useSub is not notified when is equal is true', () => {
    const slice = create({
      initState: {
        counter: 0,
      },
    });
    const { result } = renderHook(() =>
      slice.useSub(
        s => s.counter,
        () => true
      )
    );

    act(() => {
      slice.pub(p => ({ counter: p.counter + 1 }));
    });

    expect(result.current).toBe(0);
  });
  it('can use primitives as state', () => {
    const slice = create({
      initState: 0,
    });

    expect(slice.get()).toBe(0);
    slice.pub(() => 1);
    expect(slice.get()).toBe(1);
  });
  it('creates pubs that do not need args', () => {
    const slice = create({
      initState: false,
      pubs: {
        toggle: p => !p,
      },
    });

    slice.toggle();

    expect(slice.get()).toBe(true);
  });
});
