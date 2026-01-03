export type FileItem = { key: string; size?: number; last_modified?: string };

export type ListFilesResponse = { files: FileItem[] };

export type SasResponse = {
  uploadUrl: string;
  objectKey: string;
};

export type AnalyzeResponse = {
  key: string;
  analysis: any;
};
