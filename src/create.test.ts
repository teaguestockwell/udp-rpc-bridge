import { create } from './create';

describe('create', () => {
  it('it can produce a client', () => {
    type RPC = {

    }


    const client = create(({ call, set, get }) => ({
      rpc: {
        putComment: async (data: number) => {},
      },
      state: {
        commentValue: '',
      },
      actions: {
        onCommentChange: (e: any) => {
          set({ commentId: '' });
        },
      },
    }));

    // const client = create((api) => ({
    //   putComment: async (data) => {
    //     // validation error
    //     if (data.id && !data.id.trim()) {
    //       return { msg: 'no id' };
    //     }

    //     // update
    //     if (data.id) {
    //       store[data.id] = data;
    //       return { status: 200, data };
    //     }

    //     const res = await api('putComment', {id: '1', text: 'a'})

    //     // create
    //     const id = Date.now() + '';
    //     store[id] = { data };
    //     return { status: 200, data: { id, ...data } };
    //   },
    // }));

    expect(client).toBeTruthy();
  });
});
