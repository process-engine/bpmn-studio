export type Tutorial = {
  name: string;
  start: () => Promise<void>;
  cancel: () => void;
};
