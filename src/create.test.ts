import { create } from './create';

describe('create', () => {
  it('it can produce a client', () => {
    type Rpcs = {
      putComment: (data: {
        id?: string;
        text: string;
      }) => Promise<
        | { status: 200; data: { id: string; text: string } }
        | { status: 201; data: { id: string; text: string } }
        | { status: 400; msg: string }
      >;
    };
    type State = {
      inputValue: string;
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
      onCommentChange: (e: { target: { value: string } }) => void;
      sendComment: () => Promise<void>;
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
        comments: {},
      },
      actions: {
        onCommentChange: (e: any) => {
          set({ inputValue: e.target.value });
        },
        sendComment: async () => {
          const {inputValue} = get()
          
        }
      },
    }));

    expect(client).toBeTruthy();
  });
});
