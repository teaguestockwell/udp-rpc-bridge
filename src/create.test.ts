import { create } from './create';

const chunkSize = 1024 * 16;

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
      onType: (data: undefined) => Promise<{ status: 200 }>;
      getChunk: (arg: {
        id: string;
        left: number;
        right: number;
      }) => Promise<
        { status: 200; data: ArrayBuffer } | { status: 400 } | { status: 404 }
      >;
      putFileMetadata: (metadata: {
        id: string;
        bytes: number;
      }) => Promise<{ status: 200 } | { status: 429 }>;
    };
    type State = {
      peerLastTypeEPOCH: number;
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
      files: {
        [id: string]: {
          left: number;
          right: number;
          file: File | null;
        };
      };
      fileProgress: {
        [id: string]: number;
      };
    };
    type Actions = {
      onInputChange: (e: { target: { value: string } }) => void;
      commitComment: () => Promise<void>;
      editComment: (c: State['comments'][string]) => void;
      resetComment: () => void;
      sendFile: (file: File) => void;
      setFileProgress: (id: string) => void;
    };

    const client = create<Rpcs, State, Actions>(({ rpc, lpc, set, get }) => ({
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
        onType: async (_, meta) => {
          set({ peerLastTypeEPOCH: meta.sentEPOC });
          return { status: 200 };
        },
        getChunk: ({ id, left, right }) => {
          return new Promise((resolve) => {
            const f = get().files[id];
            if (!f || !f.file) {
              resolve({ status: 404 });
            }
            const reader = new FileReader();
            reader.onload = e => {
              const chunk = e?.target?.result;
              if (!chunk) {
                resolve({ status: 400 });
              }
              // assuming there is only one peer that reads in order
              f.left = left
              lpc.setFileProgress(id)
              resolve({status: 200, data: chunk as ArrayBuffer})
            };
            reader.readAsArrayBuffer(f.file!.slice(left, right))
          });
        },
        putFileMetadata: async ({ id, bytes }) => {
          const f = {
            left: 0,
            right: bytes,
            file: null,
          };
          get().files[id] = f;
          lpc.setFileProgress(id);
          let retryCount = 0;
          while (f.left !== f.right) {
            if (retryCount > 30) {
              return { status: 429 };
            }
            const until = Math.min(f.left + chunkSize, f.right);
            const res = await rpc.getChunk({ id, left: f.left, right: until });
            if (res.status !== 200) {
              await new Promise(r => setTimeout(r, 500));
              continue;
            }
            f.left = until;
            lpc.setFileProgress(id);
          }
          return { status: 200 };
        },
      },
      state: {
        inputValue: '',
        inputCommentId: '',
        comments: {},
        peerLastTypeEPOCH: 0,
        files: {},
        fileProgress: {},
      },
      lpcs: {
        onInputChange: (e: any) => {
          set({ inputValue: e.target.value });
        },
        editComment: c => {
          set({ inputCommentId: c.id, inputValue: c.text });
        },
        resetComment: () => {
          set({ inputCommentId: '', inputValue: '' });
        },
        commitComment: async () => {
          const state = get();
          const res = await rpc.putComment({
            text: state.inputValue,
            id: state.inputCommentId,
          });
          const { status } = res;
          if (status === 400) {
            return;
          }
          if (status === 200 || status === 201) {
            lpc.resetComment(undefined);
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
        sendFile: file => {
          const id = file.name + Date.now();
          get().files[id] = {
            left: 0,
            right: file.size,
            file,
          };
          rpc.putFileMetadata({ id, bytes: file.size });
        },
        setFileProgress: id => {
          const meta = get().files[id];
          if (!meta) return;
          const percent = meta.left / meta.right;
          set(prev => ({
            fileProgress: { ...prev.fileProgress, [id]: percent },
          }));
        },
      },
    }));

    expect(client).toBeTruthy();
  });
  it("sends simple messages", async () => {
    type RPC = {putMsg: (data: {msg: string}) => Promise<{status: 200}>}
    type State = {msgs: string[]}
    type LPC = {onType: (s: string) => void}
    const getClient = () => create<RPC, State, LPC>(({set}) => ({
      state: {
        msgs: []
      },
      rpcs: {
        putMsg: async (data) => {
          set(p => ({msgs: [...p.msgs, data.msg]}))
          return {status: 200}
        }
      },
      lpcs: {
        onType: () => {}
      }
    }))

    const client0 = getClient()
    const client1 = getClient()
    client0.pipe.send = client1.pipe.receive
    client1.pipe.send = client0.pipe.receive
    expect(client1.get().msgs.length).toBe(0)
    await client0.rpc.putMsg({msg: 'hey'})

    expect(client1.get().msgs.length).toBe(1)
  })
});
