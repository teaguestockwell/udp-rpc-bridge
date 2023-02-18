import { create } from './create';

describe('create', () => {
  it('it can produce a client', () => {
    type Rpcs = {
      putComment: (data: {
        id?: string;
        text: string;
      }) => Promise<
        | { status: 200; data: State['comments'][string] }
        | { status: 201; data: State['comments'][string] }
        | { status: 400; msg: string }
      >;
    };
    type State = {
      inputValue: string;
      inputCommentId: string;
      comments: {
        [id: string]: {
          id: string;
          text: string;
          authorId: number;
          createdAt: number;
          updatedAt: number;
        };
      };
    };
    type Actions = {
      onInputChange: (e: { target: { value: string } }) => void;
      commitComment: () => Promise<void>;
      editComment: (c: State['comments'][string]) => void;
    };

    const client = create<Rpcs, State, Actions>(({ call, set, get }) => ({
      rpcs: {
        putComment: async (data, meta) => {
          if (data.text.length > 100000) {
            return { status: 400, msg: 'to long' };
          }
          const prevData = get().comments[data.id ?? ''];
          if (!prevData) {
            const id = Date.now() + '';
            const next = {
              id,
              authorId: meta.callerId,
              text: data.text,
              createdAt: meta.sentEPOC,
              updatedAt: meta.sentEPOC,
            };
            set(prev => ({
              ...prev,
              comments: { ...prev.comments, [id]: next },
            }));
            return { status: 201, data: next };
          }
          const next = {
            id: prevData.id,
            authorId: meta.callerId,
            text: data.text,
            createdAt: prevData.createdAt,
            updatedAt: meta.sentEPOC,
          };
          set(prev => ({
            ...prev,
            comments: {
              ...prev.comments,
              [prevData.id]: next,
            },
          }));
          return { status: 200, data: next };
        },
      },
      state: {
        inputValue: '',
        inputCommentId: '',
        comments: {},
      },
      lpcs: {
        onInputChange: (e: any) => {
          set({ inputValue: e.target.value });
        },
        editComment: c => {
          set({ inputCommentId: c.id, inputValue: c.text });
        },
        commitComment: async () => {
          const state = get();
          const res = await call('putComment', {
            text: state.inputValue,
            id: state.inputCommentId,
          });
          const { status } = res;
          if (status === 400) {
            return;
          }
          if (status === 200 || status === 201) {
            set(prev => ({
              ...prev,
              comments: {
                ...prev.comments,
                [res.data.id]: res.data,
              },
            }));
            return;
          }
          return status;
        },
      },
    }));

    expect(client).toBeTruthy();
  });
});
