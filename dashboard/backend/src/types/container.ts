export type ContainerStatus = 'running' | 'stopped' | 'errored';

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: ContainerStatus;
  created: number;
}
