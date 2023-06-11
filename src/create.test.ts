import { create, guid } from './create';
import fs from 'fs';
import path from 'path';

const chunkSize = 1024 * 16;

const createMsgClient = () => {
  type RPC = { putMsg: (data: { msg: string }) => Promise<{ status: 200 }> };
  type State = { msgs: string[]; msg: string; isSending: boolean };
  type LPC = { typeMsg: (s: string) => void; sendMsg: () => Promise<void> };
  return create<RPC, State, LPC>(({ set, rpc, get }) => ({
    state: {
      msgs: [],
      msg: '',
      isSending: false,
    },
    rpcs: {
      putMsg: async data => {
        set(p => ({ msgs: [...p.msgs, data.msg] }));
        return { status: 200 };
      },
    },
    lpcs: {
      typeMsg: msg => {
        if (get().isSending) return;
        set({ msg });
      },
      sendMsg: async () => {
        const { msg } = get();
        set({ isSending: true });
        const res = await rpc.putMsg({ msg });
        set({ isSending: false });
        if (res.status === 200) {
          set(p => ({ msg: '', msgs: [...p.msgs, msg] }));
        }
      },
    },
  }));
};

const createFileClient = () => {
  type Rpcs = {
    getChunk: (arg: {
      id: string;
      left: number;
      right: number;
    }) => Promise<
      { status: 200; data: ArrayBuffer } | { status: 400 } | { status: 404 }
    >;
    putFileMetadata: (metadata: {
      id: string;
      name: string;
      bytes: number;
    }) => Promise<{ status: 200 } | { status: 429 }>;
  };
  type State = {
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
    sendFile: (file: File) => Promise<void>;
    setFileProgress: (id: string) => void;
  };

  return create<Rpcs, State, Actions>(({ rpc, lpc, set, get }) => ({
    rpcs: {
      getChunk: ({ id, left, right }) => {
        return new Promise(resolve => {
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
            f.left = left;
            lpc.setFileProgress(id);
            resolve({ status: 200, data: chunk as ArrayBuffer });
          };
          reader.readAsArrayBuffer(f.file!.slice(left, right));
        });
      },
      putFileMetadata: async ({ id, bytes, name }) => {
        const f = {
          left: 0,
          right: bytes,
          file: null as null | File,
        };
        get().files[id] = f;
        lpc.setFileProgress(id);
        let retryCount = 0;
        const chunks: ArrayBuffer[] = [];
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
          chunks.push(res.data);
          if (f.left === f.right) {
            f.file = new File(chunks, name);
          }
          lpc.setFileProgress(id);
        }
        return { status: 200 };
      },
    },
    state: {
      files: {},
      fileProgress: {},
    },
    lpcs: {
      sendFile: async file => {
        const id = guid();
        get().files[id] = {
          left: 0,
          right: file.size,
          file,
        };
        const res = await rpc.putFileMetadata({
          id,
          bytes: file.size,
          name: file.name,
        });
        if (res.status === 200) {
          get().files[id].left = get().files[id].right;
          lpc.setFileProgress(id);
        }
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
};

type Connectable = {
  pipe: {
    receive: (e: any) => Promise<any>;
    send: (e: any) => void;
  };
};

const connectClients = (a: Connectable, b: Connectable) => {
  a.pipe.send = e => b.pipe.receive(e);
  b.pipe.send = e => a.pipe.receive(e);
};

describe('create', () => {
  it('creates msg client', () => {
    const msgClient = createMsgClient();
    expect(msgClient).toBeTruthy();
  });
  it('connects msg clients', async () => {
    const a = createMsgClient();
    const b = createMsgClient();
    const receiveA = jest.spyOn(a.pipe, 'receive');
    const receiveB = jest.spyOn(b.pipe, 'receive');

    connectClients(a, b);

    expect(a.get().msgs).toEqual([]);
    expect(b.get().msgs).toEqual([]);
    expect(receiveA).toBeCalledTimes(0);
    expect(receiveB).toBeCalledTimes(0);
  });
  it('sets local state on a client', () => {
    const a = createMsgClient();
    const b = createMsgClient();
    connectClients(a, b);

    a.lpc.typeMsg('hello b');

    expect(a.get().msg).toBe('hello b');
    expect(b.get().msg).toBe('');
  });
  it('sends msgs between clients', async () => {
    const a = createMsgClient();
    const b = createMsgClient();
    connectClients(a, b);

    a.lpc.typeMsg('hello b');
    await a.lpc.sendMsg(undefined);

    expect(a.get().msg).toBe('');
    expect(a.get().isSending).toBe(false);
    expect(a.get().msgs).toEqual(['hello b']);
    expect(b.get().msg).toBe('');
    expect(b.get().isSending).toBe(false);
    expect(b.get().msgs).toEqual(['hello b']);
  });
  it('creates file client', () => {
    const fileClient = createFileClient();
    expect(fileClient).toBeTruthy();
  });
  it('sends files', async () => {
    const a = createFileClient();
    const b = createFileClient();
    connectClients(a, b);
    const f = new File(
      [fs.readFileSync(path.resolve(__dirname, '../telephone.jpg'))],
      'telephone.jpg'
    );

    await a.lpc.sendFile(f);

    expect(
      Object.values(a.get().files).reduce(
        (acc, cur) => acc + (cur.file?.size ?? 0),
        0
      )
    ).toBe(
      Object.values(b.get().files).reduce(
        (acc, cur) => acc + (cur.file?.size ?? 0),
        0
      )
    );
    expect(
      Object.values(a.get().files).every(f => f.left === f.right && !!f.file)
    ).toBe(true);
    expect(
      Object.values(b.get().files).every(f => f.left === f.right && !!f.file)
    ).toBe(true);
    expect(Object.values(a.get().fileProgress).every(p => p === 1)).toBe(true);
    expect(Object.values(b.get().fileProgress).every(p => p === 1)).toBe(true);
  });
});
