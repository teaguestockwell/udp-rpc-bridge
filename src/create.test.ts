import { create } from './create';

describe('create', () => {
  it('it can produce a client', () => {
    type Events = {
      putComment: [
        { id?: string; text: string },
        {
          204: {};
          201: { id: string; text: string };
          400: { msg: string };
        }
      ];
    };

    const store: Record<string, any> = {};
    const client = create<Events>((api) => ({
      putComment: async (data) => {
        // validation error
        if (data.id && !data.id.trim()) {
          return { msg: 'no id' };
        }

        // update
        if (data.id) {
          store[data.id] = data;
          return { status: 200, data };
        }

        const res = await api('putComment', {id: '1', text: 'a'})

        // create
        const id = Date.now() + '';
        store[id] = { data };
        return { status: 200, data: { id, ...data } };
      },
    }));

    expect(client).toBeTruthy();
  });
});
