export type ObservableContract = {
  factSource: string;
  selector: string;
  predicate: string;
  expected: string;
};

export type FactObservation = {
  kind: "observed";
  matches: boolean;
  observed: string;
};

export type UnsupportedFactBinding = {
  kind: "unsupported";
  code: string;
  message: string;
  expected: string;
  observed?: string;
  repair: string;
};

export type FactAdapterFailure = {
  kind: "operational-error";
  code: string;
  message: string;
  expected: string;
  repair: string;
};

export type FactAdapterOutcome =
  FactObservation | UnsupportedFactBinding | FactAdapterFailure;

export type CodeFactAdapter = {
  readonly capability: string;
  observe(observable: ObservableContract): Promise<FactAdapterOutcome>;
};
