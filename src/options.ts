// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor = new (...args: any[]) => any;
export type ViewModelFactory = (ctor: Constructor) => unknown;

const defaultViewModelFactory: ViewModelFactory = (ctor) => new ctor();

export const options: {
  deferUpdates: boolean;
  onError: ((error: unknown) => void) | null;
  viewModelFactory: ViewModelFactory;
  customElementDisplayContents: boolean;
  svgCustomElements: boolean;
  observableRefs: boolean;
  interpolation: boolean;
  attributeInterpolation: boolean;
  namespacedBindings: boolean;
  filters: boolean;
} = {
  deferUpdates: false,
  onError: null,
  viewModelFactory: defaultViewModelFactory,
  customElementDisplayContents: true,
  svgCustomElements: true,
  observableRefs: false,
  interpolation: false,
  attributeInterpolation: false,
  namespacedBindings: false,
  filters: false,
};
