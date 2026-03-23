// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor = new (...args: any[]) => any;
export type ViewModelFactory = (ctor: Constructor) => unknown;

const defaultViewModelFactory: ViewModelFactory = (ctor) => new ctor();

export const options: {
  deferUpdates: boolean;
  onError: ((error: unknown) => void) | null;
  viewModelFactory: ViewModelFactory;
} = {
  deferUpdates: false,
  onError: null,
  viewModelFactory: defaultViewModelFactory,
};
