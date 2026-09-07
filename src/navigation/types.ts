export type RootStackParamList = {
  Home: undefined;
  Scanner: undefined;
  Review: {
    uri: string;
    name: string;
    mimeType?: string | null;
    size?: number | null;
    source: 'camera' | 'file';
  };
};
